import types

import pytest

from app.services.task_generator import TaskGenerator


@pytest.mark.asyncio
async def test_generate_task_prefers_explicit_task_type_for_skill_enforcement(monkeypatch):
    captured = {}

    async def fake_get_unified_profile(user_id, db):
        return {
            "user_domain": "Technology",
            "user_level": "B1",
            "interests": "AI",
            "target_goal": "Fluency",
            "last_errors": [],
            "legacy_data": [],
            "current_skills": {"reading": 0.9, "speaking": 0.2},
        }

    async def fake_get_recent_user_vocabulary(db, user_id):
        return []

    async def fake_generate_architect_task(**kwargs):
        captured.update(kwargs)
        return ({"task_metadata": {"type": "SPEAKING"}, "content": {}}, "MODEL")

    async def fake_log_vocabulary_exposure(*args, **kwargs):
        return None

    monkeypatch.setattr("app.services.task_generator.aggregator.get_unified_profile", fake_get_unified_profile)
    monkeypatch.setattr("app.services.task_generator.VocabLogService.get_recent_user_vocabulary", fake_get_recent_user_vocabulary)
    monkeypatch.setattr("app.services.task_generator.generate_architect_task", fake_generate_architect_task)
    monkeypatch.setattr("app.services.task_generator.VocabLogService.log_vocabulary_exposure", fake_log_vocabulary_exposure)

    class DummyDb:
        pass

    await TaskGenerator.generate_task(
        user_id="11111111-1111-1111-1111-111111111111",
        task_type="SPEAKING",
        db=DummyDb(),
        skill_type="",
        target_level="B1",
        chosen_domain="Technology",
    )

    assert captured["skill_type"] == "SPEAKING"
    assert captured["focus_skill"] == "SPEAKING"
