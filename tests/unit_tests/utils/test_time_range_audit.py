# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# pylint: disable=redefined-outer-name, unused-argument, import-outside-toplevel

import logging
from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.session import Session

from superset import db
from superset.extensions import feature_flag_manager
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.time_range_limits.audit import (
    AUDIT_ACTION,
    register_audit_listener,
    remove_audit_listener,
)
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json

L90 = {
    "schema_version": 1,
    "max_span": {"quantity": 90, "time_grain": "P1D"},
    "max_look_back": None,
    "max_look_forward": None,
}
L30 = {**L90, "max_span": {"quantity": 30, "time_grain": "P1D"}}


def metadata(limits: Any = None, **other: Any) -> str:
    if limits is not None:
        other["time_range_limits"] = limits
    return json.dumps(other)


def audit_rows() -> list[dict[str, Any]]:
    rows = (
        db.session.query(Log).filter(Log.action == AUDIT_ACTION).order_by(Log.id).all()
    )
    return [
        {
            "user_id": row.user_id,
            "dashboard_id": row.dashboard_id,
            **json.loads(row.json),
        }
        for row in rows
    ]


@pytest.fixture
def flag(mocker: MockerFixture) -> dict[str, bool]:
    state = {"on": True}
    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        side_effect=lambda: {**flags, FEATURE_FLAG: state["on"]},
    )
    return state


@pytest.fixture
def dashboard(session: Session, flag: dict[str, bool], mocker: MockerFixture) -> Any:
    for command in ("update", "time_range_limits", "delete"):
        mocker.patch(
            f"superset.commands.dashboard.{command}.security_manager.raise_for_editorship"
        )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    Dashboard.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member
    dashboard = Dashboard(
        dashboard_title="d", slug="d", json_metadata=metadata(L90, color_scheme="x")
    )
    db.session.add(dashboard)
    db.session.commit()
    return dashboard


@pytest.fixture
def audit(dashboard: Any) -> Iterator[None]:
    register_audit_listener(db.session)
    yield
    remove_audit_listener(db.session)


def change_and_expect_one_row(dashboard: Any) -> None:
    before = len(audit_rows())
    stored = json.loads(dashboard.json_metadata).get("time_range_limits")
    dashboard.json_metadata = metadata(L90 if stored == L30 else L30)
    db.session.commit()
    assert len(audit_rows()) == before + 1


def put(client: Any, dashboard: Any, body: dict[str, Any]) -> Any:
    return client.put(f"/api/v1/dashboard/{dashboard.id}", json=body)


def limits_put(client: Any, dashboard: Any, policy: Any) -> Any:
    return client.put(
        f"/api/v1/dashboard/{dashboard.id}/time_range_limits/",
        json={"policy": policy},
    )


def _create(client: Any, dashboard: Any) -> int:
    response = client.post(
        "/api/v1/dashboard/",
        json={"dashboard_title": "new", "json_metadata": metadata(L30)},
    )
    assert response.status_code == 201
    return response.json["id"]


def _copy(client: Any, dashboard: Any) -> int:
    response = client.post(
        f"/api/v1/dashboard/{dashboard.id}/copy/",
        json={
            "dashboard_title": "copy",
            "json_metadata": metadata(L30, positions={}),
            "duplicate_slices": False,
        },
    )
    assert response.status_code == 200
    return response.json["result"]["id"]


def _put(client: Any, dashboard: Any) -> int:
    response = put(client, dashboard, {"json_metadata": metadata(L30)})
    assert response.status_code == 200
    return dashboard.id


def _limits_put(client: Any, dashboard: Any) -> int:
    assert limits_put(client, dashboard, L30).status_code == 200
    return dashboard.id


def _remove(client: Any, dashboard: Any) -> int:
    assert limits_put(client, dashboard, None).status_code == 200
    return dashboard.id


@pytest.mark.parametrize(
    ("write", "old", "new", "path"),
    [
        (_put, L90, L30, "/api/v1/dashboard/{id}"),
        (_limits_put, L90, L30, "/api/v1/dashboard/{id}/time_range_limits/"),
        (_remove, L90, None, "/api/v1/dashboard/{id}/time_range_limits/"),
        (_create, None, L30, "/api/v1/dashboard/"),
        (_copy, None, L30, "/api/v1/dashboard/{source}/copy/"),
    ],
    ids=["put", "limits_put", "remove", "create", "copy"],
)
def test_audit_row_per_real_change(
    dashboard: Any,
    audit: None,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    write: Callable[[Any, Any], int],
    old: Any,
    new: Any,
    path: str,
) -> None:
    from flask_appbuilder.security.sqla.models import User

    user = User(first_name="a", last_name="b", username="u", email="u@x", active=True)
    db.session.add(user)
    db.session.commit()
    mocker.patch("flask_login.utils._get_user", return_value=user)
    source_id = dashboard.id

    dashboard_id = write(client, dashboard)

    assert audit_rows() == [
        {
            "user_id": user.id,
            "dashboard_id": dashboard_id,
            "level": "dashboard",
            "old": old,
            "new": new,
            "path": path.format(id=dashboard_id, source=source_id),
        }
    ]


def _same(client: Any, dashboard: Any, **kwargs: Any) -> None:
    body = {"json_metadata": metadata(L90, color_scheme="x")}
    assert put(client, dashboard, body).status_code == 200


def _other_field(client: Any, dashboard: Any, **kwargs: Any) -> None:
    body = {"json_metadata": metadata(L90, color_scheme="y")}
    assert put(client, dashboard, body).status_code == 200
    assert put(client, dashboard, {"dashboard_title": "other"}).status_code == 200


def _put_filters(client: Any, dashboard: Any, **kwargs: Any) -> None:
    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}/filters",
        json={"modified": [], "deleted": [], "reordered": []},
    )
    assert response.status_code == 200


def _put_colors(client: Any, dashboard: Any, **kwargs: Any) -> None:
    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}/colors", json={"color_scheme": "z"}
    )
    assert response.status_code == 200


def _put_chart_customizations(client: Any, dashboard: Any, **kwargs: Any) -> None:
    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}/chart_customizations",
        json={"modified": [], "deleted": [], "reordered": []},
    )
    assert response.status_code == 200


def _rejected(
    client: Any, dashboard: Any, mocker: MockerFixture, **kwargs: Any
) -> None:
    from flask import current_app

    bad_shape = {**L90, "max_span": {"quantity": 0, "time_grain": "P1D"}}
    assert limits_put(client, dashboard, bad_shape).status_code == 400

    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": L30})
    looser = {**L90, "max_span": {"quantity": 1, "time_grain": "P1Y"}}
    assert limits_put(client, dashboard, looser).status_code == 422
    body = {"json_metadata": metadata(looser)}
    assert put(client, dashboard, body).status_code == 422

    bad_global = {"schema_version": 1, "max_span": {"quantity": 1, "time_grain": "X"}}
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": bad_global})
    assert limits_put(client, dashboard, L30).status_code == 503
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": None})


def _rolled_back(client: Any, dashboard: Any, **kwargs: Any) -> None:
    dashboard.json_metadata = metadata(L30)
    db.session.flush()
    db.session.rollback()
    db.session.commit()


def _flag_off(
    client: Any, dashboard: Any, flag: dict[str, bool], **kwargs: Any
) -> None:
    flag["on"] = False
    assert put(client, dashboard, {"json_metadata": metadata(L30)}).status_code == 200
    db.session.add(Dashboard(dashboard_title="new", json_metadata=metadata(L30)))
    db.session.commit()
    flag["on"] = True


def _delete(client: Any, dashboard: Any, flag: dict[str, bool], **kwargs: Any) -> None:
    dashboard_id = dashboard.id
    assert client.delete(f"/api/v1/dashboard/{dashboard_id}").status_code == 200
    deleted = db.session.get(Dashboard, dashboard_id)
    assert deleted is None or deleted.deleted_at is not None
    flag["on"] = False
    replacement = Dashboard(dashboard_title="d", json_metadata=metadata(L90))
    db.session.add(replacement)
    db.session.commit()
    flag["on"] = True
    kwargs["state"]["dashboard"] = replacement


def _changed_then_deleted(
    client: Any, dashboard: Any, flag: dict[str, bool], **kwargs: Any
) -> None:
    dashboard.json_metadata = metadata(L30)
    db.session.flush()
    db.session.delete(dashboard)
    db.session.commit()
    flag["on"] = False
    replacement = Dashboard(dashboard_title="d", json_metadata=metadata(L90))
    db.session.add(replacement)
    db.session.commit()
    flag["on"] = True
    kwargs["state"]["dashboard"] = replacement


def _closed_without_rollback(client: Any, dashboard: Any, **kwargs: Any) -> None:
    dashboard.json_metadata = metadata(L30)
    db.session.flush()
    db.session.close()
    db.session.add(Dashboard(dashboard_title="other", json_metadata="{}"))
    db.session.commit()
    kwargs["state"]["dashboard"] = db.session.query(Dashboard).filter_by(slug="d").one()


@pytest.mark.parametrize(
    "write",
    [
        _same,
        _other_field,
        _put_filters,
        _put_colors,
        _put_chart_customizations,
        _rejected,
        _rolled_back,
        _flag_off,
        _delete,
        _changed_then_deleted,
        _closed_without_rollback,
    ],
    ids=[
        "same",
        "other_field",
        "put_filters",
        "put_colors",
        "put_chart_customizations",
        "rejected",
        "rolled_back",
        "flag_off",
        "delete",
        "changed_then_deleted",
        "closed_without_rollback",
    ],
)
def test_no_audit_row(
    dashboard: Any,
    audit: None,
    client: Any,
    full_api_access: None,
    flag: dict[str, bool],
    mocker: MockerFixture,
    write: Callable[..., None],
) -> None:
    state = {"dashboard": dashboard}

    write(client, dashboard, flag=flag, mocker=mocker, state=state)

    assert audit_rows() == []
    change_and_expect_one_row(state["dashboard"])


def _fix_with_limits_put(client: Any, dashboard: Any, policy: Any) -> str:
    assert limits_put(client, dashboard, policy).status_code == 200
    return f"/api/v1/dashboard/{dashboard.id}/time_range_limits/"


def _fix_with_an_import(client: Any, dashboard: Any, policy: Any) -> str:
    from flask import current_app

    path = "/api/v1/dashboard/import/"
    with current_app.test_request_context(path, method="POST"):
        dashboard.json_metadata = metadata(policy)
        db.session.commit()
    return path


@pytest.mark.parametrize(
    ("stored", "old", "fix", "policy"),
    [
        ('{"time_range_limits": "oops"}', None, _fix_with_limits_put, L30),
        ('{"time_range_limits": "oops"}', None, _fix_with_limits_put, None),
        (
            '{"time_range_limits": {"schema_version": 2}}',
            {"schema_version": 2},
            _fix_with_limits_put,
            L30,
        ),
        ('{"time_range_limits": "oops"', None, _fix_with_an_import, L30),
    ],
    ids=["fixed", "removed", "raw_object", "bad_json"],
)
def test_old_invalid(
    dashboard: Any,
    audit: None,
    client: Any,
    full_api_access: None,
    flag: dict[str, bool],
    stored: str,
    old: Any,
    fix: Callable[[Any, Any, Any], str],
    policy: Any,
) -> None:
    flag["on"] = False
    dashboard.json_metadata = stored
    db.session.commit()
    flag["on"] = True

    path = fix(client, dashboard, policy)

    assert audit_rows() == [
        {
            "user_id": None,
            "dashboard_id": dashboard.id,
            "level": "dashboard",
            "old": old,
            "old_invalid": True,
            "new": policy,
            "path": path,
        }
    ]


def test_expired_column_keeps_old(dashboard: Any, audit: None) -> None:
    db.session.commit()
    assert "json_metadata" not in dashboard.__dict__

    dashboard.json_metadata = metadata(L30)
    db.session.commit()

    [row] = audit_rows()
    assert (row["old"], row["new"]) == (L90, L30)


@pytest.mark.parametrize("loaded,reads", [(True, 0), (False, 1)])
def test_the_stored_value_is_read_only_when_not_loaded(
    dashboard: Any, audit: None, loaded: bool, reads: int
) -> None:
    from sqlalchemy import event

    db.session.commit()
    if loaded:
        assert dashboard.json_metadata
    statements: list[str] = []

    def record(_conn: Any, _cursor: Any, statement: str, *_args: Any) -> None:
        statements.append(statement)

    engine = db.session.get_bind()
    event.listen(engine, "before_cursor_execute", record)
    try:
        dashboard.json_metadata = metadata(L30)
        db.session.commit()
    finally:
        event.remove(engine, "before_cursor_execute", record)

    stored_reads = [
        sql
        for sql in statements
        if sql.lstrip().startswith("SELECT dashboards.json_metadata")
    ]
    # Unloaded, the old value is read once at most: another listener may load it.
    assert len(stored_reads) <= reads
    [row] = audit_rows()
    assert (row["old"], row["new"]) == (L90, L30)


def _same_text_keeps_changed_on(dashboard: Any) -> None:
    long_ago = datetime(2000, 1, 1)
    dashboard.changed_on = long_ago
    db.session.commit()
    text = metadata(L90, color_scheme="x")

    dashboard.json_metadata = text
    db.session.commit()

    assert (dashboard.json_metadata, dashboard.changed_on > long_ago) == (text, False)


def _detached_expired_set(dashboard: Any) -> None:
    from sqlalchemy.orm.exc import DetachedInstanceError

    db.session.expunge(dashboard)

    with pytest.raises(DetachedInstanceError):
        dashboard.json_metadata = metadata(L30)
    db.session.rollback()

    stored = db.session.query(Dashboard.json_metadata).filter_by(slug="d").scalar()
    assert json.loads(stored)["time_range_limits"] == L90


@pytest.mark.parametrize(
    "check",
    [_same_text_keeps_changed_on, _detached_expired_set],
    ids=["same_text_keeps_changed_on", "detached_expired_set"],
)
def test_flag_off_keeps_the_attribute_behaviour(
    dashboard: Any,
    audit: None,
    flag: dict[str, bool],
    check: Callable[[Any], None],
) -> None:
    flag["on"] = False
    db.session.commit()
    assert "json_metadata" not in dashboard.__dict__

    check(dashboard)

    assert audit_rows() == []


def test_flag_off_stores_nothing(
    dashboard: Any, audit: None, flag: dict[str, bool]
) -> None:
    flag["on"] = False
    dashboard.json_metadata = metadata(L30)
    db.session.add(Dashboard(dashboard_title="new", json_metadata=metadata(L30)))
    db.session.flush()
    assert "time_range_limits_audit" not in db.session.info

    db.session.commit()
    assert "time_range_limits_audit" not in db.session.info
    assert audit_rows() == []

    flag["on"] = True
    dashboard.json_metadata = metadata(L90)
    db.session.flush()
    flag["on"] = False
    db.session.commit()
    assert "time_range_limits_audit" not in db.session.info
    assert audit_rows() == []


def test_row_error_keeps_the_save_and_logs_error(
    dashboard: Any,
    audit: None,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    mocker.patch(
        "superset.time_range_limits.audit.get_user_id",
        side_effect=RuntimeError("boom"),
    )

    dashboard.json_metadata = metadata(L30)
    with caplog.at_level(logging.ERROR, logger="superset.time_range_limits.audit"):
        db.session.commit()

    db.session.expire_all()
    assert json.loads(dashboard.json_metadata)["time_range_limits"] == L30
    assert audit_rows() == []
    [record] = caplog.records
    assert record.levelno == logging.ERROR
    assert record.getMessage() == (
        f"Time range limits: audit row for dashboard {dashboard.id} not written"
    )
    assert record.exc_info is not None


def test_save_db_error_is_unchanged(dashboard: Any, audit: None) -> None:
    db.session.add(
        Dashboard(dashboard_title="dup", uuid=dashboard.uuid, json_metadata="{}")
    )

    with pytest.raises(IntegrityError):
        db.session.commit()

    db.session.rollback()
    change_and_expect_one_row(dashboard)
