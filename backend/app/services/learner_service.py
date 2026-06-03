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
            # 0. Ensure Data Consistency (Healing Logic)
            await self._ensure_data_consistency(user_id)

            # 1. Fetch Profile
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()

            # 2. Fetch Skills (UserSkill / skill_states)
            skills_stmt = select(UserSkill).where(UserSkill.user_id == user_id)
            skills = (await self.db.execute(skills_stmt)).scalars().all()
            logging.info(f"[LearnerService] Found {len(skills)} skills for user {user_id}")
            for s in skills:
                logging.info(f"  - Skill: {s.skill}, XP: {s.xp_points}, Score: {s.current_score}, Level: {s.current_level}")

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
            profile_streak = profile.current_streak if (profile and profile.current_streak) else 0
            momentum = min(100, (profile_streak * 10) + (weekly_minutes // 12))

            # 8. Best Next Move (Action Panel)
            weakest_skill = "Speaking"
            if skills:
                weakest_s = min(skills, key=lambda x: x.xp_points or 0)
                weakest_skill = weakest_s.skill.capitalize()

            # 9. Fetch Level Config for Reservoir UI
            from app.models.domain import LevelConfig
            config_stmt = select(LevelConfig).where(LevelConfig.level_name == (profile.current_proficiency_level or "A1"))
            level_config = (await self.db.execute(config_stmt)).scalar_one_or_none()
            required_xp = level_config.required_xp if level_config else 1000

            # 10. Construct Response
            skills_list = []
            for s in skills:
                # Reverting to legacy score calculation: 9800 -> 98%
                score_val = int((s.current_score or 0) / 100) if (s.current_score or 0) > 100 else int((s.current_score or 0) * 100)
                score_val = min(100, score_val)
                
                skills_list.append({
                    "name": s.skill.capitalize(),
                    "skill": s.skill,
                    "score": score_val,
                    "level": s.current_level or s.level or "A1",
                    "confidence": s.confidence or 0.85
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
                    "current_level_xp": profile.current_level_xp if profile else 0,
                    "required_xp": required_xp,
                    "is_gateway_unlocked": profile.is_gateway_unlocked if profile else False,
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
            # 0. Ensure Data Consistency (Healing Logic)
            await self._ensure_data_consistency(user_id)

            # 1. Core Data Retrieval
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()

            prof_data_stmt = select(UserSkill).where(UserSkill.user_id == user_id)
            skills = (await self.db.execute(prof_data_stmt)).scalars().all()
            logging.info(f"[LearnerService] Intelligence Profile: Found {len(skills)} skills")

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
                    # Legacy score mapping
                    score_val = int((skill_obj.current_score or 0) / 100) if (skill_obj.current_score or 0) > 100 else int((skill_obj.current_score or 0) * 100)
                    score_val = min(100, score_val)
                    
                    skill_matrix.append({
                        "name": s_name.capitalize(),
                        "score": score_val,
                        "level": skill_obj.current_level or skill_obj.level or "A1",
                        "confidence": skill_obj.confidence or 0.88,
                        "stability": "Stable" if (skill_obj.current_score or 0) > 5000 else "Fragile",
                        "trend": "Improving",
                        "support": "Maintain" if (skill_obj.current_score or 0) > 5000 else "High Need"
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

            # 3. Error Model Processing (Real Data from full_report)
            error_patterns = []
            if err_profile and err_profile.full_report:
                # full_report is a dict like: {"Present Simple": {"count": 3, "last_failed": "..."}}
                for rule, data in err_profile.full_report.items():
                    count = data.get("count", 0)
                    if count > 0:
                        # Fetch actual examples from UserErrorAnalysis
                        ex_stmt = select(UserErrorAnalysis).where(
                            and_(
                                UserErrorAnalysis.user_id == user_id,
                                (UserErrorAnalysis.category == rule) | (UserErrorAnalysis.category == rule.split(':')[0].lower()),
                                UserErrorAnalysis.is_correct == False
                            )
                        ).order_by(desc(UserErrorAnalysis.created_at)).limit(3)
                        ex_result = await self.db.execute(ex_stmt)
                        examples_rows = ex_result.scalars().all()
                        
                        examples = [
                            {
                                "user_answer": ex.user_answer,
                                "correct_answer": ex.correct_answer,
                                "insight": ex.deep_insight or ex.ai_interpretation or "Linguistic friction detected in this context."
                            } for ex in examples_rows
                        ]

                        error_patterns.append({
                            "type": "Grammar Pattern" if "Grammar" in rule or rule in ["Present Simple", "Articles"] else "Linguistic Pattern",
                            "subject": rule,
                            "count": count,
                            "severity": "High" if count >= 3 else "Medium",
                            "status": "Recurring" if count >= 2 else "Emerging",
                            "insight": rule,
                            "examples": examples
                        })
            
            # Sort by count descending to show most critical errors first
            error_patterns.sort(key=lambda x: x['count'], reverse=True)
            error_patterns = error_patterns[:5] # Top 5
            
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
                "best_next_move": best_move,
                "profile": {
                    "xp_points": profile.xp_points if profile else 0,
                    "current_level_xp": profile.current_level_xp if profile else 0,
                    "required_xp": 1000, # Fallback, could be fetched from LevelConfig if needed
                    "current_level": (profile.overall_level or profile.current_proficiency_level or "A1") if profile else "A1",
                    "streak": profile.current_streak if profile else 0
                }
            }
        except Exception as e:
            logging.error(f"[LearnerService] Intelligence Profile Error: {str(e)}")
            raise e

    async def _ensure_data_consistency(self, user_id: UUID):
        """
        Heals data consistency for skills and error profiles.
        """
        try:
            # 1. Sync Skills (already handled in previous step, ensuring it's robust)
            skills_stmt = select(UserSkill).where(UserSkill.user_id == user_id)
            skills = (await self.db.execute(skills_stmt)).scalars().all()
            
            needs_update = False
            for s in skills:
                legacy_score = s.current_score or 0
                current_xp = s.xp_points or 0
                if (legacy_score > current_xp and legacy_score > 100) or (current_xp == 0 and legacy_score > 0):
                    s.xp_points = int(legacy_score) if legacy_score > 100 else int(legacy_score * 1000)
                    needs_update = True
                if not s.current_proficiency_level and (s.current_level or s.level):
                    s.current_proficiency_level = s.current_level or s.level
                    needs_update = True

            # 2. Sync Error Profile from Analysis Logs
            err_prof_stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
            err_profile = (await self.db.execute(err_prof_stmt)).scalar_one_or_none()

            analysis_stmt = select(UserErrorAnalysis.category).where(
                UserErrorAnalysis.user_id == user_id,
                UserErrorAnalysis.is_correct == False
            )
            error_results = (await self.db.execute(analysis_stmt)).scalars().all()
            from collections import Counter
            actual_counts = Counter(error_results)
            
            report_keys = set(err_profile.full_report.keys()) if err_profile and err_profile.full_report else set()
            actual_keys = set(actual_counts.keys())
            
            if not err_profile or report_keys != actual_keys:
                if error_results:
                    counts = Counter(error_results)
                    # Any error appearing more than once is "chronic"
                    chronic = [category for category, count in counts.items() if count >= 1]
                    
                    # Reconstruct full_report
                    full_report = {}
                    for category, count in counts.items():
                        full_report[category] = {"count": count, "last_failed": datetime.now(timezone.utc).isoformat()}
                    
                    if not err_profile:
                        err_profile = UserErrorProfile(user_id=user_id, common_mistakes=chronic, full_report=full_report)
                        self.db.add(err_profile)
                    else:
                        err_profile.common_mistakes = chronic
                        err_profile.full_report = full_report
                    needs_update = True

            if needs_update:
                await self.db.commit()
                logging.info(f"Successfully healed data for user {user_id}")

            # 3. Heal LearnerProfile progression fields
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
            if profile:
                profile_needs_update = False
                if profile.xp_points is None:
                    profile.xp_points = 0
                    profile_needs_update = True
                if profile.current_level_xp is None:
                    profile.current_level_xp = 0
                    profile.current_proficiency_level = profile.overall_level or "A1"
                    profile_needs_update = True
                
                # 4. Strict Streak Reset Check (Dynamic healing)
                if profile.last_interaction_date:
                    today = datetime.now(timezone.utc).date()
                    days_since_last = (today - profile.last_interaction_date).days
                    if days_since_last > 1:
                        profile.current_streak = 0
                        profile_needs_update = True
                        logging.info(f"[LearnerService] Reset streak to 0 for user {user_id} due to {days_since_last} days of inactivity.")
                
                if profile_needs_update:
                    await self.db.commit()
                    logging.info(f"Successfully healed LearnerProfile for user {user_id}")
        except Exception as e:
            await self.db.rollback()
            logging.error(f"Consistency Error: {str(e)}")

    async def update_daily_interaction(self, user_id: UUID, xp_reward: int = 10):
        """
        Increments streak if it's a new day of interaction.
        Grants specified XP for daily engagement.
        Streak follows a strict reset policy: if a calendar day is missed, it resets to 0.
        """
        try:
            prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
            profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
            if not profile:
                logging.error(f"[LearnerService] Profile not found for streak update: {user_id}")
                return

            today = datetime.now(timezone.utc).date()
            
            # 1. Update Streak (Only once per day)
            if profile.last_interaction_date != today:
                # Check if they missed a day (not consecutive)
                if profile.last_interaction_date:
                    days_since_last = (today - profile.last_interaction_date).days
                    if days_since_last > 1:
                        # Reset streak to 0 before starting a new one
                        profile.current_streak = 0
                        logging.info(f"[LearnerService] Reset streak to 0 for user {user_id} in update_daily_interaction due to missed day.")

                profile.current_streak = (profile.current_streak or 0) + 1
                if profile.current_streak > (profile.longest_streak or 0):
                    profile.longest_streak = profile.current_streak
                profile.last_interaction_date = today

            # 2. Grant Engagement XP (Always grant if called, e.g. for card completion)
            profile.xp_points = (profile.xp_points or 0) + xp_reward
            profile.current_level_xp = (profile.current_level_xp or 0) + xp_reward
            
            await self.db.commit()
            logging.info(f"[LearnerService] Updated streak for user {user_id}: {profile.current_streak}")
            return True
        except Exception as e:
            logging.error(f"[LearnerService] Error updating streak: {str(e)}")
            await self.db.rollback()
            raise e
