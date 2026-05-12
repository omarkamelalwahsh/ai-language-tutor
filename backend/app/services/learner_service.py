from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_
from uuid import UUID
import logging
from datetime import datetime, timedelta, timezone

from app.models.domain import LearnerProfile, UserSkill, UserErrorProfile, UserErrorAnalysis, AssessmentLog, UserProficiency, ErrorProfile, JourneyProgress

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

            # 2. Fetch Skills (UserProficiency - NEW)
            prof_data_stmt = select(UserProficiency).where(UserProficiency.user_id == user_id)
            proficiency = (await self.db.execute(prof_data_stmt)).scalar_one_or_none()

            # 3. Fetch Error Profile (NEW)
            err_prof_stmt = select(ErrorProfile).where(ErrorProfile.user_id == user_id)
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
            def get_effective_score(s):
                if s.xp_points and s.xp_points > 0:
                    return s.xp_points
                return min(500, s.current_score or 0) 

            mastery_sum = sum(get_effective_score(s) for s in skills) if skills else 0
            mastery_percentage = min(100, round((mastery_sum / (len(skills) * 500)) * 100)) if mastery_sum > 0 and skills else 0
            
            feed_stmt = select(UserErrorAnalysis).where(UserErrorAnalysis.user_id == user_id).order_by(desc(UserErrorAnalysis.created_at)).limit(5)
            feed_result = await self.db.execute(feed_stmt)
            recent_errors = feed_result.scalars().all()

            # Due Reviews: Count of fragility
            due_reviews = sum(1 for s in skills if (s.proficiency_confidence or s.confidence or 0) < 0.5)

            # Momentum: Base (Streak * 10) + (Weekly Minutes / 60 * 5) capped at 100
            profile_streak = profile.streak if (profile and profile.streak) else 0
            momentum = min(100, (profile_streak * 10) + (weekly_minutes // 12))

            # 8. Best Next Move (Action Panel)
            weakest_skill = "Speaking"
            if skills:
                ws = min(skills, key=lambda x: x.xp_points or x.current_score or 0)
                weakest_skill = (ws.skill or "Speaking").capitalize()

            # 9. Construct Response
            skills_list = []
            if proficiency:
                for s_name in ['reading', 'listening', 'writing', 'speaking']:
                    lvl = getattr(proficiency, f"{s_name}_level", "A1")
                    xp = getattr(proficiency, f"{s_name}_xp", 0)
                    skills_list.append({
                        "name": s_name.capitalize(),
                        "skill": s_name,
                        "score": min(100, xp // 10), # Simple mapping for now
                        "level": lvl,
                        "confidence": 0.85 # Default for new system
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
                    "active_errors": len(err_profile.chronic_errors) if err_profile else 0,
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
                        } for i, err in enumerate(err_profile.chronic_errors[:3])
                    ] if err_profile else []
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

            prof_data_stmt = select(UserProficiency).where(UserProficiency.user_id == user_id)
            proficiency = (await self.db.execute(prof_data_stmt)).scalar_one_or_none()

            err_prof_stmt = select(ErrorProfile).where(ErrorProfile.user_id == user_id)
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

            # 2. Skill Model Processing (NEW)
            skill_matrix = []
            target_skills = ['reading', 'listening', 'writing', 'speaking']
            if proficiency:
                for s_name in target_skills:
                    lvl = getattr(proficiency, f"{s_name}_level", "A1")
                    xp = getattr(proficiency, f"{s_name}_xp", 0)
                    skill_matrix.append({
                        "name": s_name.capitalize(),
                        "score": min(100, xp // 10),
                        "level": lvl,
                        "confidence": 0.88,
                        "stability": "Stable" if xp > 500 else "Fragile",
                        "trend": "Improving",
                        "support": "Maintain" if xp > 500 else "High Need"
                    })
            else:
                for s_name in target_skills:
                    skill_matrix.append({
                        "name": s_name.capitalize(),
                        "score": 0,
                        "level": "A1",
                        "confidence": 0,
                        "stability": "Fragile",
                        "trend": "Latent",
                        "support": "High Need"
                    })

            # 3. Error Model Processing (Chronic Errors)
            error_patterns = []
            if err_profile and err_profile.chronic_errors:
                for err in err_profile.chronic_errors:
                    error_patterns.append({
                        "type": "Chronic Pattern",
                        "count": 2, # Flagged as chronic
                        "severity": "High",
                        "status": "Recurring",
                        "insight": err
                    })
            
            # 4. Retention & Pacing
            due_items = []
            # ... simplified for new system

            # 4. Retention & Pacing
            due_items = []
            if proficiency:
                for s_name in target_skills:
                    xp = getattr(proficiency, f"{s_name}_xp", 0)
                    if xp < 100:
                        due_items.append(s_name.capitalize())

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
