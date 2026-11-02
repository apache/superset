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
from datetime import datetime
from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session
from superset_core.tasks.types import TaskProperties, TaskScope, TaskStatus

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
    # A task with no declared prerequisites has empty dependencies
    assert result.depends_on == []


def test_find_one_or_none_refreshes_stale_task(session_with_task: Session) -> None:
    """TaskDAO fetches refresh identity-map state after external-style updates."""
    from superset.daos.tasks import TaskDAO

    create_task(session_with_task, task_uuid=TASK_UUID, task_key="stale-task")

    loaded = TaskDAO.find_one_or_none(uuid=TASK_UUID, skip_base_filter=True)
    assert loaded is not None
    assert loaded.status == TaskStatus.PENDING.value

    TaskDAO.conditional_status_update(
        task_uuid=TASK_UUID,
        new_status=TaskStatus.IN_PROGRESS,
        expected_status=TaskStatus.PENDING,
        set_started_at=True,
    )

    # The atomic update uses synchronize_session=False, matching worker status
    # transitions. Without force_fetch, the identity-map instance remains stale.
    assert loaded.status == TaskStatus.PENDING.value

    refreshed = TaskDAO.find_one_or_none(uuid=TASK_UUID, skip_base_filter=True)

    assert refreshed is loaded
    assert refreshed.status == TaskStatus.IN_PROGRESS.value


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


def test_get_subscriber_principals(session_with_task: Session) -> None:
    """get_subscriber_principals returns subscriber identities."""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="shared-subscriber-principals",
        scope=TaskScope.SHARED,
        user_id=None,
    )
    TaskDAO.add_subscriber(task.id, user_id=7)
    TaskDAO.add_guest_subscriber(task.id, guest_key="guest:abc")

    subscribers = TaskDAO.get_subscriber_principals(task.id)

    assert subscribers == [
        {"principal_type": "user", "sub": "7"},
        {"principal_type": "guest", "sub": "guest:abc"},
    ]


def test_add_guest_subscriber_full_length_key(session_with_task: Session) -> None:
    """A realistic guest key (``guest:`` + 64-char SHA256 hex = 70 chars) persists.

    Regression guard for the guest_key column width: the real key from
    superset.tasks.guest is 70 chars, so a String(64) column would error/truncate.
    """
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="shared-guest-len",
        scope=TaskScope.SHARED,
        user_id=None,
    )
    guest_key = "guest:" + "a" * 64  # mirrors superset.tasks.guest (70 chars)

    assert TaskDAO.add_guest_subscriber(task.id, guest_key=guest_key) is True

    session_with_task.refresh(task)
    assert task.subscribers[0].guest_key == guest_key


def test_get_subscriber_principals_empty(session_with_task: Session) -> None:
    """get_subscriber_principals returns [] for a task with no subscribers."""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_key="no-subs",
        scope=TaskScope.SHARED,
        user_id=None,
    )

    assert TaskDAO.get_subscriber_principals(task.id) == []


def test_subscribed_at_defaults_per_insert(session_with_task: Session) -> None:
    """``subscribed_at`` is evaluated at insert time, not at class definition."""
    from superset.models.task_subscribers import TaskSubscriber
    from superset.tasks.utils import naive_utcnow

    task = create_task(
        session_with_task,
        task_key="default-subscribed-at",
        scope=TaskScope.SHARED,
        user_id=None,
    )

    before = naive_utcnow()
    subscription = TaskSubscriber(task_id=task.id, user_id=TEST_USER_ID)
    session_with_task.add(subscription)
    session_with_task.flush()

    assert subscription.subscribed_at >= before


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


def test_get_status(session_with_task: Session, mocker: MockerFixture) -> None:
    """Test get_status returns status string when task found by UUID"""
    from superset.daos.tasks import TaskDAO
    from superset.models.task_subscribers import TaskSubscriber

    # get_status enforces the TaskFilter, so the polling user must be
    # authenticated and subscribed to see the task.
    mocker.patch("superset.tasks.filters.get_user_id", return_value=TEST_USER_ID)
    mocker.patch("superset.security_manager.is_admin", return_value=False)

    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="status-task",
        status=TaskStatus.IN_PROGRESS,
    )
    session_with_task.add(TaskSubscriber(task_id=task.id, user_id=TEST_USER_ID))
    session_with_task.flush()

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


def test_add_dependencies_bulk_inserts_edges(session_with_task: Session) -> None:
    """add_dependencies bulk-inserts edges; Task.depends_on resolves them."""
    from superset.daos.tasks import TaskDAO

    parent1 = create_task(session_with_task, task_key="parent1")
    parent2 = create_task(session_with_task, task_key="parent2")
    child = create_task(session_with_task, task_key="child")

    TaskDAO.add_dependencies(child.id, [parent1.id, parent2.id])

    # Task.depends_on resolves to the prerequisite Task entities
    session_with_task.refresh(child)
    assert {t.id for t in child.depends_on} == {parent1.id, parent2.id}
    # Prerequisites themselves have no dependencies
    assert parent1.depends_on == []


def test_add_dependencies_empty_is_noop(session_with_task: Session) -> None:
    """add_dependencies with no ids does nothing."""
    from superset.daos.tasks import TaskDAO

    task = create_task(session_with_task, task_key="lonely")
    TaskDAO.add_dependencies(task.id, [])
    session_with_task.refresh(task)
    assert task.depends_on == []


def test_get_statuses_changed_since_baseline_returns_no_statuses(
    session_with_task: Session, mocker: MockerFixture
) -> None:
    """Without a cursor the call establishes a baseline: no statuses, fresh cursor."""
    from superset.daos.tasks import TaskDAO

    mocker.patch("superset.security_manager.is_admin", return_value=True)
    mocker.patch("superset.tasks.filters.get_user_id", return_value=TEST_USER_ID)

    create_task(session_with_task, task_key="baseline-task")
    before = datetime.now()

    statuses, cursor = TaskDAO.get_statuses_changed_since(None)

    assert statuses == {}
    # The cursor is floored to whole seconds (metastore datetime precision, e.g.
    # MySQL DATETIME), so compare against a floored baseline.
    assert cursor.microsecond == 0
    assert cursor >= before.replace(microsecond=0)


def test_get_statuses_changed_since_redelivers_task_on_the_cursor_boundary(
    session_with_task: Session, mocker: MockerFixture
) -> None:
    """The ``>=`` bound re-delivers a task whose changed_on equals the cursor.

    Re-delivery is idempotent for the client, whereas a strict ``>`` would drop a
    transition landing exactly on the boundary and hang the poller.
    """
    from superset.daos.tasks import TaskDAO

    mocker.patch("superset.security_manager.is_admin", return_value=True)
    mocker.patch("superset.tasks.filters.get_user_id", return_value=TEST_USER_ID)

    boundary = datetime(2026, 8, 26, 12, 0, 0)
    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="boundary-task",
        status=TaskStatus.IN_PROGRESS,
        properties={"progress_percent": 0.25},
    )
    task.changed_on = boundary
    session_with_task.flush()

    statuses, _ = TaskDAO.get_statuses_changed_since(boundary)

    assert statuses == {
        str(TASK_UUID): {"status": TaskStatus.IN_PROGRESS.value, "progress": 0.25}
    }


def test_get_statuses_changed_since_tolerates_non_dict_properties(
    session_with_task: Session, mocker: MockerFixture
) -> None:
    """A properties column holding a JSON scalar yields ``progress: None``, not an
    exception — one malformed row must not fail the polling endpoint."""
    from superset.daos.tasks import TaskDAO

    mocker.patch("superset.security_manager.is_admin", return_value=True)
    mocker.patch("superset.tasks.filters.get_user_id", return_value=TEST_USER_ID)

    boundary = datetime(2026, 8, 26, 12, 0, 0)
    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="scalar-properties-task",
        status=TaskStatus.IN_PROGRESS,
    )
    task.properties = "42"
    task.changed_on = boundary
    session_with_task.flush()

    statuses, _ = TaskDAO.get_statuses_changed_since(boundary)

    assert statuses[str(TASK_UUID)] == {
        "status": TaskStatus.IN_PROGRESS.value,
        "progress": None,
    }


def test_get_statuses_changed_since_cursor_advances_when_nothing_changed(
    session_with_task: Session, mocker: MockerFixture
) -> None:
    """The next cursor is the server clock, so it advances even on an empty batch.

    Deriving it from ``max(changed_on)`` would freeze the watermark on an idle
    in-progress task, re-fetching that row on every poll forever.
    """
    from superset.daos.tasks import TaskDAO

    mocker.patch("superset.security_manager.is_admin", return_value=True)
    mocker.patch("superset.tasks.filters.get_user_id", return_value=TEST_USER_ID)

    stale = datetime(2020, 1, 1, 0, 0, 0)
    task = create_task(session_with_task, task_key="idle-task")
    task.changed_on = stale
    session_with_task.flush()

    _, first_cursor = TaskDAO.get_statuses_changed_since(stale)
    statuses, second_cursor = TaskDAO.get_statuses_changed_since(first_cursor)

    assert statuses == {}
    assert second_cursor >= first_cursor > stale


def test_get_statuses_changed_since_narrows_by_task_type(
    session_with_task: Session, mocker: MockerFixture
) -> None:
    """``task_type`` restricts the result to a single kind of task."""
    from superset.daos.tasks import TaskDAO

    mocker.patch("superset.security_manager.is_admin", return_value=True)
    mocker.patch("superset.tasks.filters.get_user_id", return_value=TEST_USER_ID)

    boundary = datetime(2026, 8, 26, 12, 0, 0)
    tracked = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="tracked",
        task_type="tracked_type",
    )
    other = create_task(session_with_task, task_key="other", task_type="other_type")
    tracked.changed_on = boundary
    other.changed_on = boundary
    session_with_task.flush()

    statuses, _ = TaskDAO.get_statuses_changed_since(boundary, task_type="tracked_type")

    assert list(statuses) == [str(TASK_UUID)]


def test_set_properties_and_payload_preserves_subscription_state(
    session_with_task: Session,
) -> None:
    """An executor whole-blob write keeps the policy-owned subscription subtree.

    Models a browser tab joining a SHARED task after the worker snapshotted the
    properties at pickup: the executor's next write must not drop the tab.
    """
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="preserve-subscription",
        properties={"is_abortable": False},
    )
    executor_snapshot = task.properties_dict.copy()  # worker pickup: no tabs yet

    TaskDAO.merge_subscription_state(task, {"consumers": ["user:1:tabA"]})
    session_with_task.flush()

    executor_snapshot["is_abortable"] = True
    executor_snapshot["private"] = {"task": {"cancel_query_id": "q1"}}
    assert TaskDAO.set_properties_and_payload(
        TASK_UUID,
        properties=executor_snapshot,
    )

    session_with_task.expire_all()
    fresh = session_with_task.query(Task).filter(Task.uuid == TASK_UUID).one()
    private = fresh.properties_dict["private"]
    assert fresh.properties_dict["is_abortable"] is True
    assert private["task"] == {"cancel_query_id": "q1"}
    assert private["subscription"] == {"consumers": ["user:1:tabA"]}


def test_conditional_status_update_preserves_subscription_state(
    session_with_task: Session,
) -> None:
    """A terminal transition carrying properties keeps the subscription subtree."""
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="terminal-preserve-subscription",
        status=TaskStatus.IN_PROGRESS,
    )
    TaskDAO.merge_subscription_state(task, {"consumers": ["user:1:tabA"]})
    session_with_task.flush()

    assert TaskDAO.conditional_status_update(
        task_uuid=TASK_UUID,
        new_status=TaskStatus.FAILURE,
        expected_status=TaskStatus.IN_PROGRESS,
        properties={"error_message": "boom"},
        set_ended_at=True,
    )

    session_with_task.expire_all()
    fresh = session_with_task.query(Task).filter(Task.uuid == TASK_UUID).one()
    assert fresh.status == TaskStatus.FAILURE.value
    assert fresh.properties_dict["error_message"] == "boom"
    assert fresh.properties_dict["private"]["subscription"] == {
        "consumers": ["user:1:tabA"]
    }


def test_merge_subscription_state_keeps_executor_written_keys(
    session_with_task: Session,
) -> None:
    """A policy write lands on top of what the executor committed meanwhile.

    The caller's entity is stale (loaded before the executor's write); the merge
    must refresh first so the executor's keys survive the flush.
    """
    from superset.daos.tasks import TaskDAO

    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="merge-keeps-executor-keys",
        properties={"is_abortable": False},
    )
    # Executor writes while the caller still holds the pre-write entity.
    assert TaskDAO.set_properties_and_payload(
        TASK_UUID,
        properties={
            "is_abortable": True,
            "private": {"task": {"cancel_query_id": "q1"}},
        },
    )
    assert task.properties_dict["is_abortable"] is False  # stale copy

    TaskDAO.merge_subscription_state(task, {"consumers": ["user:1:tabA"]})
    session_with_task.flush()

    session_with_task.expire_all()
    fresh = session_with_task.query(Task).filter(Task.uuid == TASK_UUID).one()
    assert fresh.properties_dict["is_abortable"] is True
    assert fresh.properties_dict["private"]["task"] == {"cancel_query_id": "q1"}
    assert fresh.properties_dict["private"]["subscription"] == {
        "consumers": ["user:1:tabA"]
    }


def test_merge_subscription_state_on_detached_task_merges_in_memory() -> None:
    """A bare model (no session) is merged in memory, keeping other namespaces."""
    from superset.daos.tasks import TaskDAO

    task = Task()
    task.update_properties({"private": {"task": {"cancel_query_id": "q1"}}})
    TaskDAO.merge_subscription_state(task, {"consumers": ["user:1:tabA"]})
    assert task.properties_dict["private"] == {
        "task": {"cancel_query_id": "q1"},
        "subscription": {"consumers": ["user:1:tabA"]},
    }


def test_chart_policy_join_during_execution_survives_executor_write(
    session_with_task: Session,
) -> None:
    """End-to-end shape of the bug: a second tab joins while the worker runs.

    Tab A submits, the worker snapshots the properties, tab B joins, then the
    worker flags the task abortable. Afterwards both tabs must still be routed
    and tab A's detach must not abort the task tab B is waiting on.
    """
    from superset.daos.tasks import TaskDAO
    from superset.tasks.async_queries import ChartQueryConsumerPolicy

    policy = ChartQueryConsumerPolicy()
    task = create_task(
        session_with_task,
        task_uuid=TASK_UUID,
        task_key="join-during-execution",
        properties={"is_abortable": False},
    )
    policy.on_subscribe(task, principal="user:1", client_ref="tabA")
    session_with_task.flush()
    executor_snapshot = task.properties_dict.copy()  # worker pickup: sees tab A

    policy.on_subscribe(task, principal="user:1", client_ref="tabB")
    session_with_task.flush()

    executor_snapshot["is_abortable"] = True  # ctx._set_abortable() write
    assert TaskDAO.set_properties_and_payload(
        TASK_UUID,
        properties=executor_snapshot,
    )

    session_with_task.expire_all()
    fresh = session_with_task.query(Task).filter(Task.uuid == TASK_UUID).one()
    assert fresh.properties_dict["is_abortable"] is True
    assert policy.routing_channels(fresh) == ["user:1:tabA", "user:1:tabB"]
    assert policy.on_unsubscribe(fresh, principal="user:1", client_ref="tabA") is False
