from datetime import datetime

from superset import db
from superset.models.user import SupersetUser
from superset.security.api import UserSoftDeletionAPI


def test_user_defaults(app_context):
    u = SupersetUser(
        username="u_default",
        email="u_default@example.com",
        first_name="Unit",
        last_name="Test",
        active=True,
    )
    db.session.add(u)
    db.session.commit()
    refreshed = db.session.get(SupersetUser, u.id)  # type: ignore[arg-type]
    assert refreshed.is_deleted is False
    assert refreshed.deleted_on is None


def test_user_soft_delete_flags(app_context):
    u = SupersetUser(
        username="u_soft",
        email="u_soft@example.com",
        first_name="Unit",
        last_name="Test",
        active=True,
    )
    db.session.add(u)
    db.session.commit()
    u.is_deleted = True
    u.active = False
    u.deleted_on = datetime.utcnow()
    db.session.commit()
    refreshed = db.session.get(SupersetUser, u.id)  # type: ignore[arg-type]
    assert refreshed.is_deleted is True
    assert refreshed.active is False
    assert isinstance(refreshed.deleted_on, datetime)


def test_not_deleted_condition_filters_out_deleted(app_context):
    active = SupersetUser(
        username="filter_active",
        email="filter_active@example.com",
        first_name="Unit",
        last_name="Test",
        active=True,
        is_deleted=False,
    )
    deleted = SupersetUser(
        username="filter_deleted",
        email="filter_deleted@example.com",
        first_name="Unit",
        last_name="Test",
        active=True,
        is_deleted=True,
    )
    db.session.add_all([active, deleted])
    db.session.commit()
    try:
        visible = (
            db.session.query(SupersetUser)
            .filter(SupersetUser.__table__.c.is_deleted.is_(False))
            .all()
        )
        usernames = {u.username for u in visible}
        assert "filter_active" in usernames
        assert "filter_deleted" not in usernames
    finally:
        db.session.delete(active)
        db.session.delete(deleted)
        db.session.commit()


def test_api_soft_delete_unit(app_context):
    # 404 when user does not exist
    api = UserSoftDeletionAPI()
    resp_missing = api.soft_delete(999999999)
    assert resp_missing.status_code == 404

    # Create user, soft-delete succeeds and is idempotent
    u = SupersetUser(
        username="unit_api",
        email="unit_api@example.com",
        first_name="Unit",
        last_name="Test",
        active=True,
        is_deleted=False,
    )
    db.session.add(u)
    db.session.commit()
    try:
        resp1 = api.soft_delete(u.id)
        assert 200 <= resp1.status_code < 300
        refreshed = db.session.get(SupersetUser, u.id)  # type: ignore[arg-type]
        assert refreshed.is_deleted is True
        assert refreshed.active is False
        assert refreshed.deleted_on is not None

        resp2 = api.soft_delete(u.id)
        assert resp2.status_code == 204
    finally:
        db.session.delete(u)
        db.session.commit()
