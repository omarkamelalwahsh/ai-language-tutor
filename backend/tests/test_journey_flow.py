import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
import sys
import os

# Add backend directory to sys path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.models.domain import JourneyTask, JourneyNode, ErrorProfile, LearnerProfile

# Mock data
fake_user_id = uuid4()
fake_task_id = uuid4()
fake_node_id = uuid4()

class MockContextManager:
    async def __aenter__(self):
        pass
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

class MockSession:
    def __init__(self):
        self.execute = AsyncMock()
        self.add = MagicMock()
        self.flush = AsyncMock()
        
    def begin(self):
        return MockContextManager()

@pytest.fixture
def mock_db_session():
    return MockSession()

@pytest.fixture
def override_get_db(mock_db_session):
    from app.api.deps import get_db
    app.dependency_overrides[get_db] = lambda: mock_db_session
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
def override_get_current_user_id():
    from app.api.deps import get_current_user_id
    app.dependency_overrides[get_current_user_id] = lambda: fake_user_id
    yield
    app.dependency_overrides.pop(get_current_user_id, None)

@pytest.mark.asyncio
async def test_attempt_1_failure(override_get_db, override_get_current_user_id, mock_db_session):
    """
    Test Attempt 1 Failure (Hint Generation)
    """
    # Mocking the task in db
    mock_task = MagicMock(spec=JourneyTask)
    mock_task.id = fake_task_id
    mock_task.node_id = fake_node_id
    mock_task.alternative_attempts = 0
    mock_task.skill_type = "writing"
    mock_task.status = "active"
    
    mock_node = MagicMock(spec=JourneyNode)
    mock_node.id = fake_node_id
    mock_node.type = "core"
    
    # Setup mock returns for db.execute
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.side_effect = [mock_task, mock_node]
    mock_db_session.execute.return_value = mock_result
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/tasks/{fake_task_id}/submit", json={
            "has_error": True,
            "score": 40,
            "raw_input": "I goes to school"
        })
        
    assert response.status_code == 200
    data = response.json()
    
    assert data["has_error"] is True
    assert "hint" in data
    assert mock_task.alternative_attempts == 1
    assert mock_task.status == "active"
    assert "correct_answer" not in data

@pytest.mark.asyncio
async def test_attempt_2_failure(override_get_db, override_get_current_user_id, mock_db_session):
    """
    Test Attempt 2 Failure (Task Reset & Error Profiling)
    """
    mock_task = MagicMock(spec=JourneyTask)
    mock_task.id = fake_task_id
    mock_task.node_id = fake_node_id
    mock_task.alternative_attempts = 1
    mock_task.skill_type = "writing"
    mock_task.task_index = 0
    mock_task.status = "active"
    
    mock_node = MagicMock(spec=JourneyNode)
    mock_node.id = fake_node_id
    mock_node.type = "core"
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.side_effect = [mock_task, mock_node]
    mock_db_session.execute.return_value = mock_result
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/tasks/{fake_task_id}/submit", json={
            "has_error": True,
            "score": 30,
            "raw_input": "I goes to school again"
        })
        
    assert response.status_code == 200
    data = response.json()
    
    assert data["has_error"] is True
    assert "correct_answer" in data
    assert mock_task.status == "failed"
    
    # Assert DB add called twice: ErrorProfile and alternative JourneyTask
    assert mock_db_session.add.call_count == 2
    added_items = [call.args[0] for call in mock_db_session.add.call_args_list]
    
    # Check ErrorProfile
    assert any(isinstance(i, ErrorProfile) for i in added_items)
    
    # Check Alternative Task creation
    alt_tasks = [i for i in added_items if isinstance(i, JourneyTask)]
    assert len(alt_tasks) == 1
    assert alt_tasks[0].alternative_attempts == 0

@pytest.mark.asyncio
async def test_integrated_capstone_dual_metric(override_get_db, override_get_current_user_id, mock_db_session):
    """
    Test Integrated Capstone Dual-Metric Updates (Task 9/10)
    """
    mock_task = MagicMock(spec=JourneyTask)
    mock_task.id = fake_task_id
    mock_task.node_id = fake_node_id
    mock_task.alternative_attempts = 0
    mock_task.skill_type = "integrated"
    mock_task.task_index = 8  # Task 9
    mock_task.status = "active"
    
    mock_node = MagicMock(spec=JourneyNode)
    mock_node.id = fake_node_id
    mock_node.type = "core"
    
    mock_next_task = None
    
    mock_next_node = MagicMock(spec=JourneyNode)
    mock_next_node.id = uuid4()
    mock_next_node.is_locked = True
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.side_effect = [mock_task, mock_node, mock_next_task, mock_next_node]
    mock_db_session.execute.return_value = mock_result
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/tasks/{fake_task_id}/submit", json={
            "has_error": False,
            "score": 90
        })
        
    assert response.status_code == 200
    data = response.json()
    
    assert data["has_error"] is False
    assert mock_task.status == "completed"
    assert not mock_node.is_locked
    assert not mock_next_node.is_locked
