# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file to you under
# the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain
# a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from collections.abc import Iterator
from uuid import UUID

import pytest
from sqlalchemy.orm.session import Session
from superset_core.api.tasks import TaskProperties, TaskScope, TaskStatus

from superset.commands.tasks.exceptions import TaskNotAbortableError
from superset.models.tasks import Task
from superset.tasks.utils import get_active_dedup_key, get_finished_dedup_key

# Test constants
TASK_UUID = UUID("e7765491-40c1-4f35-a4f5-06308e79310e")
TASK_ID = 42
TEST_TASK_TYPE = "test_type"
TEST_TASK_KEY = "test-key"
TEST_USER_ID = 1


def create_task(
    session: Session,
    *,
    task_id: int | None = None,
    task_uuid: UUID | None = None,
    task_key: str = TEST_TASK_KEY,
    task_type: str = TEST_TASK_TYPE,
    scope: TaskScope = TaskScope.PRIVATE,
    status: TaskStatus = TaskStatus.PENDING,
    user_id: int | None = TEST_USER_ID,
    properties: TaskProperties | None = None,
    use_finished_dedup_key: bool = False,
) -> Task:
    """Helper to create a task with sensible defaults for testing."""
    if use_finished_dedup_key:
        dedup_key = get_finished_dedup_key(task_uuid or TASK_UUID)
    else:
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
            user_id=user_id,
        )

    task = Task(
        task_type=task_type,
        task_key=task_key,
        scope=scope.value,
        status=status.value,
        dedup_key=dedup_key,
        user_id=user_id,
    )
    if task_id is not None:
        task.id = task_id
    if task_uuid:
        task.uuid = task_uuid
    if properties:
        task.update_properties(properties)

    session.add(task)
    session.flush()
    return task


@pytest.fixture
def session_with_task(session: Session) -> Iterator[Session]:
    """Create a session with Task and TaskSubscriber tables."""
    from superset.models.task_subscribers import TaskSubscriber

    engine = session.get_bind()
    Task.metadata.create_all(engine)
    TaskSubscriber.metadata.create_all(engine)

    yield session
    session.rollback()


def test_find_by_task_key_active(session_with_task: Session) -> None:
    """Test finding active task by task_key"""
    from superset.daos.tasks import TaskDAO

    create_task(session_with_task)

    result = TaskDAO.find_by_task_key(
        task_type=TEST_TASK_TYPE,
        task_key=TEST_TASK_KEY,
        scope=TaskScope.PRIVATE,
        user_id=TEST_USER_ID,
    )

    assert result is not None
    assert result.task_key == TEST_TASK_KEY
    assert result.task_type == TEST_TASK_TYPE
    assert result.status == TaskStatus.PENDING.value


def test_find_by_task_key_not_found(session_with_task: Session) -> None:
    """Test finding task by task_key returns None when not found"""
    from superset.daos.tasks import TaskDAO

    result = TaskDAO.find_by_task_key(
        task_type=TEST_TASK_TYPE,
        task_key="nonexistent-key",
        scope=TaskScope.PRIVATE,
        user_id=TEST_USER_ID,
    )

    assert result is None


def test_find_by_task_key_finished_not_found(session_with_task: Session) -> None:
    """Test that find_by_task_key returns None for finished tasks.

    Finished tasks have a different dedup_key format (UUID-based),
    so they won't be found by the active task lookup.
    """
    from superset.daos.tasks import TaskDAO

    create_task(
        session_with_task,
        task_key="finished-key",
        status=TaskStatus.SUCCESS,
        use_finished_dedup_key=True,
        task_uuid=TASK_UUID,
    )

    # Should not find SUCCESS task via active lookup
    result = TaskDAO.find_by_task_key(
        task_type=TEST_TASK_TYPE,
        task_key="finished-key",
        scope=TaskScope.PRIVATE,
        user_id=TEST_USER_ID,
    )
    assert result is None


def test_create_task_success(session_with_task: Session) -> None:
    """Test successful task creation."""
    from superset.daos.tasks import TaskDAO

    result = TaskDAO.create_task(
        task_type=TEST_TASK_TYPE,
        task_key=TEST_TASK_KEY,
        scope=TaskScope.PRIVATE,
        user_id=TEST_USER_ID,
    )

    assert result is not None
    assert result.task_key == TEST_TASK_KEY
    assert result.task_type == TEST_TASK_TYPE
    assert result.status == TaskStatus.PENDING.value
    assert isinstance(result, Task)


def test_create_task_with_user_id(session_with_task: Session) -> None:
    """Test task creation with explicit user_id."""
    from superset.daos.tasks import TaskDAO

    result = TaskDAO.create_task(
        task_type=TEST_TASK_TYPE,
        task_key="user-task",
        scope=TaskScope.PRIVATE,
        user_id=42,
    )

    assert result is not None
    assert result.user_id == 42
    # Creator should be auto-subscribed
    assert len(result.subscribers) == 1
    assert result.subscribers[0].user_id == 42


def test_create_task_with_properties(session_with_task: Session) -> None:
    """Test task creation with properties."""
    from superset.daos.tasks import TaskDAO

    result = TaskDAO.create_task(
        task_type=TEST_TASK_TYPE,
        task_key="props-task",
        scope=TaskScope.PRIVATE,
        user_id=TEST_USER_ID,
        properties={"timeout": 300},
    )

    assert result is not None
    assert result.properties_dict.get("timeout") == 300


def test_abort_task_pending_success(session_with_task: Session) -> None:
    """Test successful abort of pending task - goes directly to ABORTED"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="pending-task",
        status=TaskStatus.PENDING,
    )

    result = TaskDAO.abort_task(task.uuid, skip_base_filter=True)

    assert result is not None
    assert result.status == TaskStatus.ABORTED.value


def test_abort_task_in_progress_abortable(session_with_task: Session) -> None:
    """Test abort of in-progress task with abort handler.

    Should transition to ABORTING status.
    """
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="abortable-task",
        status=TaskStatus.IN_PROGRESS,
        properties={"is_abortable": True},
    )

    result = TaskDAO.abort_task(task.uuid, skip_base_filter=True)

    assert result is not None
    # Should set status to ABORTING, not ABORTED
    assert result.status == TaskStatus.ABORTING.value


def test_abort_task_in_progress_not_abortable(session_with_task: Session) -> None:
    """Test abort of in-progress task without abort handler - raises error"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="non-abortable-task",
        status=TaskStatus.IN_PROGRESS,
        properties={"is_abortable": False},
    )

    with pytest.raises(TaskNotAbortableError):
        TaskDAO.abort_task(task.uuid, skip_base_filter=True)


def test_abort_task_in_progress_is_abortable_none(session_with_task: Session) -> None:
    """Test abort of in-progress task with is_abortable not set - raises error"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="no-abortable-prop-task",
        status=TaskStatus.IN_PROGRESS,
        # Empty properties - no is_abortable key
    )

    with pytest.raises(TaskNotAbortableError):
        TaskDAO.abort_task(task.uuid, skip_base_filter=True)


def test_abort_task_already_aborting(session_with_task: Session) -> None:
    """Test abort of already aborting task - idempotent success"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="aborting-task",
        status=TaskStatus.ABORTING,
    )

    result = TaskDAO.abort_task(task.uuid, skip_base_filter=True)

    # Idempotent - returns task without error
    assert result is not None
    assert result.status == TaskStatus.ABORTING.value


def test_abort_task_not_found(session_with_task: Session) -> None:
    """Test abort fails when task not found"""
    from superset.daos.tasks import TaskDAO

    result = TaskDAO.abort_task(UUID("00000000-0000-0000-0000-000000000000"))

    assert result is None


def test_abort_task_already_finished(session_with_task: Session) -> None:
    """Test abort fails when task already finished"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="finished-task",
        status=TaskStatus.SUCCESS,
        use_finished_dedup_key=True,
        task_uuid=TASK_UUID,
    )

    result = TaskDAO.abort_task(task.uuid, skip_base_filter=True)

    assert result is None


def test_add_subscriber(session_with_task: Session) -> None:
    """Test adding a subscriber to a task"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="shared-task",
        scope=TaskScope.SHARED,
        user_id=None,
    )

    # Add subscriber
    result = TaskDAO.add_subscriber(task.id, user_id=TEST_USER_ID)
    assert result is True

    # Verify subscriber was added
    session_with_task.refresh(task)
    assert len(task.subscribers) == 1
    assert task.subscribers[0].user_id == TEST_USER_ID


def test_add_subscriber_idempotent(session_with_task: Session) -> None:
    """Test adding same subscriber twice is idempotent"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="shared-task-2",
        scope=TaskScope.SHARED,
        user_id=None,
    )

    # Add subscriber twice
    result1 = TaskDAO.add_subscriber(task.id, user_id=TEST_USER_ID)
    result2 = TaskDAO.add_subscriber(task.id, user_id=TEST_USER_ID)

    assert result1 is True
    assert result2 is False  # Already subscribed

    # Verify only one subscriber
    session_with_task.refresh(task)
    assert len(task.subscribers) == 1


def test_remove_subscriber(session_with_task: Session) -> None:
    """Test removing a subscriber from a task"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="shared-task-3",
        scope=TaskScope.SHARED,
        user_id=None,
    )

    TaskDAO.add_subscriber(task.id, user_id=TEST_USER_ID)
    session_with_task.refresh(task)
    assert len(task.subscribers) == 1

    # Remove subscriber
    result = TaskDAO.remove_subscriber(task.id, user_id=TEST_USER_ID)

    assert result is not None
    assert len(result.subscribers) == 0


def test_remove_subscriber_not_subscribed(session_with_task: Session) -> None:
    """Test removing non-existent subscriber returns None"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="shared-task-4",
        scope=TaskScope.SHARED,
        user_id=None,
    )

    # Try to remove non-existent subscriber
    result = TaskDAO.remove_subscriber(task.id, user_id=999)

    assert result is None


def test_get_status(session_with_task: Session) -> None:
    """Test get_status returns status string when task found by UUID"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="status-task",
        status=TaskStatus.IN_PROGRESS,
    )

    result = TaskDAO.get_status(task.uuid)

    assert result == TaskStatus.IN_PROGRESS.value


def test_get_status_not_found(session_with_task: Session) -> None:
    """Test get_status returns None when task not found"""
    from superset.daos.tasks import TaskDAO

    result = TaskDAO.get_status(UUID("00000000-0000-0000-0000-000000000000"))

    assert result is None


def test_conditional_status_update_non_terminal_state_keeps_dedup_key(
    session_with_task: Session,
) -> None:
    """Test that conditional_status_update preserves dedup_key for
    non-terminal transitions"""
    from superset.daos.tasks import TaskDAO

    # Create task in PENDING state
    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="non-terminal-test-task",
        status=TaskStatus.PENDING,
    )

    # Store original active dedup_key
    original_dedup_key = task.dedup_key

    # Transition to non-terminal state (IN_PROGRESS)
    result = TaskDAO.conditional_status_update(
        task_uuid=TASK_UUID,
        new_status=TaskStatus.IN_PROGRESS,
        expected_status=TaskStatus.PENDING,
        set_started_at=True,
    )

    # Should succeed
    assert result is True

    # Refresh task and verify dedup_key was NOT changed
    session_with_task.refresh(task)
    assert task.status == TaskStatus.IN_PROGRESS.value
    assert task.dedup_key == original_dedup_key  # Should remain the same
    assert task.started_at is not None


@pytest.mark.parametrize(
    "terminal_state",
    [
        TaskStatus.SUCCESS,
        TaskStatus.FAILURE,
        TaskStatus.ABORTED,
        TaskStatus.TIMED_OUT,
    ],
)
def test_conditional_status_update_terminal_state_updates_dedup_key(
    session_with_task: Session, terminal_state: TaskStatus
) -> None:
    """Test that terminal states (SUCCESS, FAILURE, ABORTED, TIMED_OUT)
    update dedup_key"""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key=f"terminal-test-{terminal_state.value}",
        status=TaskStatus.IN_PROGRESS,
    )

    original_dedup_key = task.dedup_key
    expected_finished_key = get_finished_dedup_key(TASK_UUID)

    # Transition to terminal state
    result = TaskDAO.conditional_status_update(
        task_uuid=TASK_UUID,
        new_status=terminal_state,
        expected_status=TaskStatus.IN_PROGRESS,
        set_ended_at=True,
    )

    assert result is True, f"Failed to update to {terminal_state.value}"

    # Verify dedup_key was updated
    session_with_task.refresh(task)
    assert task.status == terminal_state.value
    assert task.dedup_key == expected_finished_key, (
        f"dedup_key not updated for {terminal_state.value}"
    )
    assert task.dedup_key != original_dedup_key, (
        f"dedup_key should have changed for {terminal_state.value}"
    )
