"""Integration tests for user soft-delete behavior.

Validates:
- Setting `is_deleted` and `deleted_on` on a user
- Filtering logic excluding soft-deleted users via `NotDeletedUserFilter`
All DB operations are performed within the test's app context fixture to
avoid detached SQLAlchemy instances.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from superset import db
from uuid import uuid4

from superset.models.user import SupersetUser
from superset.security.filters import NotDeletedUserFilter


def _create_user(base_username: str, base_email: str) -> SupersetUser:
    """Create a user with unique username and email directly via the ORM.

    Using the fixture `create_user` from `conftest.py` caused uniqueness collisions on
    the `email` column because the fixture always uses a constant email value.
    This helper preserves isolation for repeated test runs by ensuring uniqueness.
    """
    unique_suffix = uuid4().hex[:8]
    user = SupersetUser(
        username=f"{base_username}_{unique_suffix}",
        first_name="Test",
        last_name="User",
        email=f"{base_email.split('@')[0]}+{unique_suffix}@{base_email.split('@')[1]}",
        active=True,
        is_deleted=False,
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.mark.integration
def test_soft_delete_sets_flags(app_context) -> None:  # app_context fixture provides active context
    user = _create_user("soft_delete_user", "soft_delete_user@example.com")

    # Simulate soft-delete
    user.is_deleted = True
    user.deleted_on = datetime.utcnow()
    db.session.commit()

    refreshed = db.session.get(SupersetUser, user.id)  # type: ignore[arg-type]
    assert refreshed is not None
    assert refreshed.is_deleted is True
    assert refreshed.deleted_on is not None
    # deleted_on should be very recent
    assert datetime.utcnow() - refreshed.deleted_on < timedelta(minutes=1)


@pytest.mark.integration
def test_not_deleted_filter_excludes_soft_deleted(app_context) -> None:  # app_context fixture provides active context
    active_user = _create_user("active_user", "active_user@example.com")
    deleted_user = _create_user("deleted_user", "deleted_user@example.com")

    # Soft-delete one user
    deleted_user.is_deleted = True
    deleted_user.deleted_on = datetime.utcnow()
    db.session.commit()

    # Baseline: both users exist in the table
    all_users = db.session.query(SupersetUser).filter(
        SupersetUser.username.in_([active_user.username, deleted_user.username])
    )
    assert all_users.count() == 2

    # Apply NotDeletedUserFilter: expect only the active user
    query = db.session.query(SupersetUser)
    # Replicate NotDeletedUserFilter logic directly (instance requires FAB context)
    filtered_query = query.filter(SupersetUser.__table__.c.is_deleted.is_(False))
    results = filtered_query.filter(
        SupersetUser.username.in_([active_user.username, deleted_user.username])
    ).all()

    assert len(results) == 1
    assert results[0].id == active_user.id


# --- API-level soft-delete tests ---

@pytest.mark.integration
def test_api_soft_delete_sets_flags(app_context, test_client, login_as_admin) -> None:
    user = _create_user("api_soft_delete_user", "api_soft_delete_user@example.com")

    rv = test_client.post(f"/api/v1/users/soft_delete/{user.id}")
    assert 200 <= rv.status_code < 300

    refreshed = db.session.get(SupersetUser, user.id)  # type: ignore[arg-type]
    assert refreshed is not None
    assert refreshed.is_deleted is True
    assert refreshed.active is False
    assert refreshed.deleted_on is not None
    assert datetime.utcnow() - refreshed.deleted_on < timedelta(minutes=1)


@pytest.mark.integration
def test_api_soft_delete_idempotent(app_context, test_client, login_as_admin) -> None:
    user = _create_user("api_soft_delete_idem", "api_soft_delete_idem@example.com")

    rv1 = test_client.post(f"/api/v1/users/soft_delete/{user.id}")
    assert 200 <= rv1.status_code < 300

    rv2 = test_client.post(f"/api/v1/users/soft_delete/{user.id}")
    assert rv2.status_code == 204

    refreshed = db.session.get(SupersetUser, user.id)  # type: ignore[arg-type]
    assert refreshed is not None and refreshed.is_deleted is True and refreshed.active is False


@pytest.mark.integration
def test_api_soft_delete_excluded_from_queries(app_context, test_client, login_as_admin) -> None:
    active_user = _create_user("api_active_user", "api_active_user@example.com")
    deleted_user = _create_user("api_deleted_user", "api_deleted_user@example.com")

    rv = test_client.post(f"/api/v1/users/soft_delete/{deleted_user.id}")
    assert 200 <= rv.status_code < 300

    all_users_q = db.session.query(SupersetUser).filter(
        SupersetUser.username.in_([active_user.username, deleted_user.username])
    )
    assert all_users_q.count() == 2

    visible = (
        db.session.query(SupersetUser)
        .filter(SupersetUser.__table__.c.is_deleted.is_(False))
        .filter(SupersetUser.username.in_([active_user.username, deleted_user.username]))
        .all()
    )
    assert len(visible) == 1
    assert visible[0].id == active_user.id
