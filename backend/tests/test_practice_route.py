import os
import sys

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app


class MockAsyncResult:
    def __init__(self, values):
        self._values = list(values)

    def scalars(self):
        return self

    def all(self):
        return self._values

    def scalar_one_or_none(self):
        return None


class MockSession:
    def __init__(self):
        self.execute = AsyncMock(return_value=MockAsyncResult([]))
        self.add = MagicMock()
        self.flush = AsyncMock()
        self.commit = AsyncMock()


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
    app.dependency_overrides[get_current_user_id] = lambda: 'not-a-valid-uuid'
    yield
    app.dependency_overrides.pop(get_current_user_id, None)


def test_practice_tasks_rejects_invalid_user_id(override_get_db, override_get_current_user_id, mock_db_session):
    client = TestClient(app)

    response = client.get('/api/v1/practice/skills/speaking/tasks')

    assert response.status_code == 401
    assert 'Invalid authenticated user id' in response.text
