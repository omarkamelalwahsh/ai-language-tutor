from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_
from uuid import UUID
import logging
from datetime import datetime, timedelta, timezone

from app.models.domain import LearnerProfile, UserSkill, UserErrorProfile, UserErrorAnalysis, AssessmentLog

class LearnerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard_data(self, user_id: UUID) -> dict:
        """
        Aggregates all data needed for the AI Command Center Dashboard.
        """
        try:
            # 1. Fetch Profile
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()

            # 2. Fetch Skills (UserSkill / skill_states)
            skills_stmt = select(UserSkill).where(UserSkill.user_id == user_id)
            skills = (await self.db.execute(skills_stmt)).scalars().all()

            # 3. Fetch Error Profile (UserErrorProfile / user_error_profiles)
            err_prof_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
            err_profile = (await self.db.execute(err_prof_stmt)).scalar_one_or_none()

            # 4. Fetch History for Trends (Speaking/Writing) - Timezone Aware
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            log_stmt = select(AssessmentLog).where(
                and_(
                    AssessmentLog.user_id == user_id,
                    AssessmentLog.created_at >= thirty_days_ago
                )
            ).order_by(AssessmentLog.created_at.asc())
            logs_result = await self.db.execute(log_stmt)
            logs = logs_result.scalars().all()

            # 5. Calculate Weekly Minutes (Last 7 days) - Timezone Aware
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            weekly_ms = sum(l.duration_ms or 0 for l in logs if l.created_at >= seven_days_ago)
            weekly_minutes = round(weekly_ms / 60000)

            # 6. Trend Processing (Group by date and skill)
            trends = []
            date_map = {}
            for l in logs:
                d = l.created_at.date().isoformat()
                if d not in date_map:
                    date_map[d] = {
                        "speaking": 0, "writing": 0, "reading": 0, "listening": 0,
                        "count_s": 0, "count_w": 0, "count_r": 0, "count_l": 0
                    }
                
                s_name = (l.skill or "").lower()
                if s_name == "speaking":
                    date_map[d]["speaking"] += (l.score or 0)
                    date_map[d]["count_s"] += 1
                elif s_name == "writing":
                    date_map[d]["writing"] += (l.score or 0)
                    date_map[d]["count_w"] += 1
                elif s_name == "reading":
                    date_map[d]["reading"] += (l.score or 0)
                    date_map[d]["count_r"] += 1
                elif s_name == "listening":
                    date_map[d]["listening"] += (l.score or 0)
                    date_map[d]["count_l"] += 1
            
            for d, vals in sorted(date_map.items()):
                trends.append({
                    "date": d,
                    "speaking": round((vals["speaking"] / vals["count_s"]) * 100) if vals["count_s"] > 0 else 0,
                    "writing": round((vals["writing"] / vals["count_w"]) * 100) if vals["count_w"] > 0 else 0,
                    "reading": round((vals["reading"] / vals["count_r"]) * 100) if vals["count_r"] > 0 else 0,
                    "listening": round((vals["listening"] / vals["count_l"]) * 100) if vals["count_l"] > 0 else 0
                })
            
            # Fill gaps if empty (Now for last 6 days including today)
            if not trends:
                trends = [{
                    "date": (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat(), 
                    "speaking": 0, "writing": 0, "reading": 0, "listening": 0
                } for i in range(5, -1, -1)]

            # 7. Aggregate Real Metrics
            # Mastery Calculation (using UserSkill)
            total_xp = sum(s.xp_points or 0 for s in skills) if skills else 0
            mastery_percentage = min(100, round((total_xp / 4000) * 100)) # 1000 XP per skill for max mastery
            
            feed_stmt = select(UserErrorAnalysis).where(UserErrorAnalysis.user_id == user_id).order_by(desc(UserErrorAnalysis.created_at)).limit(5)
            feed_result = await self.db.execute(feed_stmt)
            recent_errors = feed_result.scalars().all()

            # Due Reviews: Count of fragility (XP < 200)
            due_reviews = sum(1 for s in skills if (s.xp_points or 0) < 200) if skills else 0

            # Momentum: Base (Streak * 10) + (Weekly Minutes / 60 * 5) capped at 100
            profile_streak = profile.streak if (profile and profile.streak) else 0
            momentum = min(100, (profile_streak * 10) + (weekly_minutes // 12))

            # 8. Best Next Move (Action Panel)
            weakest_skill = "Speaking"
            if skills:
                weakest_s = min(skills, key=lambda x: x.xp_points or 0)
                weakest_skill = weakest_s.skill.capitalize()

            # 9. Construct Response
            skills_list = []
            for s in skills:
                skills_list.append({
                    "name": s.skill.capitalize(),
                    "skill": s.skill,
                    "score": min(100, (s.xp_points or 0) // 10),
                    "level": s.current_proficiency_level or "A1",
                    "confidence": s.proficiency_confidence or 0.85
                })
            
            # Ensure all 4 core skills are present (fallback)
            core_skills = ['reading', 'listening', 'writing', 'speaking']
            existing_skills = [s.skill.lower() for s in skills]
            for cs in core_skills:
                if cs not in existing_skills:
                    skills_list.append({
                        "name": cs.capitalize(),
                        "skill": cs,
                        "score": 0,
                        "level": "A1",
                        "confidence": 0.5
                    })

            return {
                "profile": {
                    "full_name": profile.full_name if (profile and profile.full_name) else "Learner",
                    "current_level": (profile.overall_level or profile.current_proficiency_level or "A1") if profile else "A1",
                    "xp_points": profile.xp_points if profile else 0,
                    "streak": profile_streak,
                },
                "kpis": {
                    "momentum": momentum,
                    "weekly_minutes": weekly_minutes,
                    "active_errors": len(err_profile.common_mistakes) if err_profile and err_profile.common_mistakes else 0,
                    "due_reviews": due_reviews
                },
                "action_panel": {
                    "hero": {
                        "title": f"Guided {weakest_skill} Session",
                        "why": f"Your {weakest_skill} stability is currently based on {len(logs)} historic markers. This session focuses on repair.",
                        "duration": "12 min",
                        "type": "Diagnostic Review"
                    },
                    "queue": [
                        {
                            "id": "remediation_1", 
                            "title": "Review Chronic Errors", 
                            "type": "Error Repair"
                        }
                    ]
                },
                "skills": skills_list,
                "trends": trends,
                "intelligence_feed": {
                    "action_plan": "Focus on chronic errors detected in your recent sessions.",
                    "recent_insights": [
                        {
                            "id": f"insight_{i}",
                            "category": "Grammar",
                            "insight": f"Detected recurring pattern: {err}",
                            "timestamp": datetime.now().isoformat()
                        } for i, err in enumerate(err_profile.common_mistakes[:3])
                    ] if err_profile and err_profile.common_mistakes else []
                }
            }
        except Exception as e:
            logging.error(f"[LearnerService] Dashboard Error: {str(e)}")
            raise e

    async def get_intelligence_profile(self, user_id: UUID) -> dict:
        """
        Calculates the 5-model synthesis (Skill, Error, Retention, Pacing, Confidence).
        """
        try:
            # 1. Core Data Retrieval
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()

            prof_data_stmt = select(UserSkill).where(UserSkill.user_id == user_id)
            skills = (await self.db.execute(prof_data_stmt)).scalars().all()

            err_prof_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
            err_profile = (await self.db.execute(err_prof_stmt)).scalar_one_or_none()

            # 1.5 Fetch History for Trends (Speaking/Writing) - Timezone Aware
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            log_stmt = select(AssessmentLog).where(
                and_(
                    AssessmentLog.user_id == user_id,
                    AssessmentLog.created_at >= thirty_days_ago
                )
            ).order_by(AssessmentLog.created_at.asc())
            logs_result = await self.db.execute(log_stmt)
            logs = logs_result.scalars().all()

            # 2. Skill Model Processing (using UserSkill rows)
            skill_matrix = []
            target_skills = ['reading', 'listening', 'writing', 'speaking']
            
            for s_name in target_skills:
                skill_obj = next((s for s in skills if s.skill.lower() == s_name), None)
                if skill_obj:
                    skill_matrix.append({
                        "name": s_name.capitalize(),
                        "score": min(100, (skill_obj.xp_points or 0) // 10),
                        "level": skill_obj.current_proficiency_level or "A1",
                        "confidence": skill_obj.proficiency_confidence or 0.88,
                        "stability": "Stable" if (skill_obj.xp_points or 0) > 500 else "Fragile",
                        "trend": "Improving",
                        "support": "Maintain" if (skill_obj.xp_points or 0) > 500 else "High Need"
                    })
                else:
                    skill_matrix.append({
                        "name": s_name.capitalize(),
                        "score": 0,
                        "level": "A1",
                        "confidence": 0.5,
                        "stability": "Fragile",
                        "trend": "Latent",
                        "support": "High Need"
                    })

            # 3. Error Model Processing (Chronic Errors)
            error_patterns = []
            # 3. Error Model Processing (Common Mistakes)
            error_patterns = []
            if err_profile and err_profile.common_mistakes:
                for err in err_profile.common_mistakes:
                    error_patterns.append({
                        "type": "Chronic Pattern",
                        "count": 2, 
                        "severity": "High",
                        "status": "Recurring",
                        "insight": err
                    })
            
            # 4. Retention & Pacing
            due_items = []
            if skills:
                for s in skills:
                    if (s.xp_points or 0) < 100:
                        due_items.append(s.skill.capitalize())

            # 5. Best Next Move (Synthesis)
            weakest_skill = min(skill_matrix, key=lambda x: x['score']) if skill_matrix else None
            best_move = "Focus on fundamental grammar patterns."
            if weakest_skill and weakest_skill['score'] < 80:
                best_move = f"8-minute guided {weakest_skill['name'].lower()} practice on high-frequency scenarios."
            elif error_patterns:
                best_move = f"Review {error_patterns[0]['type']} patterns to fix recurring habits."

            return {
                "identity": {
                    "name": profile.full_name.split()[0] if (profile and profile.full_name) else "Learner",
                    "summary": f"Your {(profile.overall_level if profile else 'A1') or 'A1'} trajectory is stable. {weakest_skill['name'] if weakest_skill else 'Grammar'} shows the most growth potential today.",
                    "model_confidence": round(((profile.proficiency_confidence if profile else 0.88) or 0.88) * 100),
                    "last_updated": datetime.now().strftime("%I:%M %p")
                },
                "skill_matrix": skill_matrix,
                "error_model": error_patterns,
                "cognitive_state": {
                    "retention_queue": {
                        "due_count": len(due_items),
                        "high_risk": due_items[:3]
                    },
                    "pacing": {
                        "tolerance_score": (profile.pacing_score if profile else 0.75) or 0.75,
                        "session_advice": "You are currently learning best with short, 8-minute high-intensity sessions."
                    },
                    "confidence_trend": [round(l.score * 100) for l in logs[-7:]] if logs else [0]
                },
                "best_next_move": best_move
            }
        except Exception as e:
            logging.error(f"[LearnerService] Intelligence Profile Error: {str(e)}")
            raise e
