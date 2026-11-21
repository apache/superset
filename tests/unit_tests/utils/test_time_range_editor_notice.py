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
"""The time range limits editor notice: its rule, marker and payload."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, PropertyMock
from uuid import uuid3

import pytest
from flask import current_app, g
from pytest_mock import MockerFixture
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError

from superset.utils import json

NOW = datetime(2026, 10, 16, 14, 30)

R = tuple[int, str]


def rule(value: R | None) -> dict[str, Any] | None:
    return None if value is None else {"quantity": value[0], "time_grain": value[1]}


def stored(
    max_span: R | None = None,
    max_look_back: R | None = None,
    max_look_forward: R | None = None,
) -> dict[str, Any]:
    return {
        "max_span": rule(max_span),
        "max_look_back": rule(max_look_back),
        "max_look_forward": rule(max_look_forward),
    }


def config(
    max_span: R | None = None,
    max_look_back: R | None = None,
    max_look_forward: R | None = None,
) -> dict[str, Any]:
    return {"schema_version": 1, **stored(max_span, max_look_back, max_look_forward)}


def limits(raw: dict[str, Any] | None) -> Any:
    from superset.time_range_limits.policy import parse_time_range_limits

    return parse_time_range_limits(
        None if raw is None else {"schema_version": 1, **raw}, check_units=False
    )


SPAN_AND_BACK = stored((1, "P1Y"), (2, "P1Y"))


@pytest.mark.parametrize(
    ("current", "acknowledged", "expected"),
    [
        pytest.param(SPAN_AND_BACK, None, "turned_on", id="no_marker_with_a_rule"),
        pytest.param(stored(), None, None, id="no_marker_no_rule"),
        pytest.param(None, None, None, id="no_marker_no_global"),
        pytest.param(SPAN_AND_BACK, SPAN_AND_BACK, None, id="unchanged"),
        pytest.param(
            stored((1, "P1Y"), (2, "P1Y"), (1, "P1M")),
            SPAN_AND_BACK,
            "tightened",
            id="new_rule",
        ),
        pytest.param(
            stored((6, "P1M"), (2, "P1Y")), SPAN_AND_BACK, "tightened", id="shorter"
        ),
        pytest.param(
            stored((90, "P1D"), (2, "P1Y")),
            SPAN_AND_BACK,
            "tightened",
            id="shorter_other_unit",
        ),
        pytest.param(
            stored((2, "P1Y"), (2, "P1Y")), SPAN_AND_BACK, None, id="loosened"
        ),
        pytest.param(stored((1, "P1Y")), SPAN_AND_BACK, None, id="rule_removed"),
        pytest.param(stored(), SPAN_AND_BACK, None, id="every_rule_removed"),
        pytest.param(
            stored((6, "P1M"), (3, "P1Y")),
            SPAN_AND_BACK,
            "tightened",
            id="one_tighter_one_looser",
        ),
        # The pinned rows.
        pytest.param(stored((1, "P1W")), stored((7, "P1D")), None, id="f9_7d_to_1w"),
        pytest.param(
            stored((1, "P1M")), stored((30, "P1D")), "tightened", id="f9_30d_to_1m"
        ),
        pytest.param(
            stored((30, "P1D")), stored((1, "P1M")), "tightened", id="f9_1m_to_30d"
        ),
        pytest.param(stored((2, "P1D")), stored((12, "PT1H")), None, id="f9_12h_to_2d"),
        pytest.param(
            stored((12, "PT1H")), stored((2, "P1D")), "tightened", id="f9_2d_to_12h"
        ),
        pytest.param(
            stored((1, "P1Y")), stored(), "tightened", id="marker_without_rules"
        ),
    ],
)
def test_editor_notice_kind(
    current: dict[str, Any] | None,
    acknowledged: dict[str, Any] | None,
    expected: str | None,
) -> None:
    from superset.time_range_limits.notice import _acknowledged, editor_notice_kind

    marker = None if acknowledged is None else _acknowledged(acknowledged)
    assert editor_notice_kind(limits(current), marker) == expected


def test_editor_notice_kind_off_and_on_again_shows_nothing() -> None:
    """Limits going off, then back with the values the marker holds: no
    notice, as the marker is kept."""
    from superset.time_range_limits.notice import _acknowledged, editor_notice_kind

    marker = _acknowledged(SPAN_AND_BACK)
    assert editor_notice_kind(None, marker) is None
    assert editor_notice_kind(limits(SPAN_AND_BACK), marker) is None


@pytest.mark.parametrize(
    "value",
    [
        pytest.param(None, id="null"),
        pytest.param("text", id="string"),
        pytest.param([], id="list"),
        pytest.param({}, id="empty"),
        pytest.param({"max_span": None}, id="missing_rules"),
        pytest.param({**SPAN_AND_BACK, "schema_version": 1}, id="extra_key"),
        pytest.param({**SPAN_AND_BACK, "max_span": {"quantity": 1}}, id="bad_rule"),
        pytest.param(
            {**SPAN_AND_BACK, "max_span": {"quantity": "1", "time_grain": "P1Y"}},
            id="bad_quantity",
        ),
    ],
)
def test_bad_marker_is_no_marker(value: Any) -> None:
    from superset.time_range_limits.notice import _acknowledged

    assert _acknowledged(value) is None


def test_marker_any_unit_is_read() -> None:
    from superset.time_range_limits.notice import _acknowledged
    from superset.time_range_limits.policy import Rule

    marker = _acknowledged(stored((7, "PT0.5H")))
    assert marker is not None
    assert marker.max_span == Rule(7, "PT0.5H")


def test_notice_key_is_a_uuid3_of_the_user_id() -> None:
    from superset.key_value.utils import get_uuid_namespace
    from superset.time_range_limits.notice import _notice_key

    namespace = get_uuid_namespace("time_range_limits_notice")
    assert _notice_key(5) == uuid3(namespace, "5")
    assert _notice_key(5) != _notice_key(6)


def edited_by(mocker: MockerFixture, *editor_subject_ids: int) -> Any:
    from superset.models.dashboard import Dashboard

    mocker.patch.object(
        Dashboard, "datasources", new_callable=PropertyMock, return_value=set()
    )
    dashboard = Dashboard(json_metadata="{}")
    mocker.patch.object(
        Dashboard,
        "editors",
        new_callable=PropertyMock,
        return_value=[
            SimpleNamespace(id=subject_id) for subject_id in editor_subject_ids
        ],
    )
    return dashboard


def entry(value: Any, expires_on: datetime | None = None) -> Any:
    from superset.key_value.models import KeyValueEntry

    raw = value if isinstance(value, bytes) else json.dumps(value).encode()
    return KeyValueEntry(value=raw, expires_on=expires_on)


@pytest.fixture
def global_on(mocker: MockerFixture) -> None:
    mocker.patch.dict(
        current_app.config,
        {"TIME_RANGE_LIMITS_GLOBAL": config((1, "P1Y"), (2, "P1Y"))},
    )


def as_user(mocker: MockerFixture, user_id: int | None, *subject_ids: int) -> MagicMock:
    """Log in ``user_id``, whose subjects are ``subject_ids`` (default: one
    subject with the user's id)."""
    mocker.patch("superset.time_range_limits.notice.get_user_id", return_value=user_id)
    return mocker.patch(
        "superset.subjects.utils.get_user_subject_ids",
        return_value=list(subject_ids or ([user_id] if user_id else [])),
    )


def notice(mocker: MockerFixture, dashboard: Any, marker: Any = None) -> Any:
    from superset.time_range_limits.policy import dashboard_limits_payload

    get_entry = mocker.patch(
        "superset.daos.key_value.KeyValueDAO.get_entry", return_value=marker
    )
    return dashboard_limits_payload(dashboard, NOW)["editor_notice"], get_entry


@pytest.mark.usefixtures("global_on")
def test_payload_editor_without_a_marker(mocker: MockerFixture) -> None:
    from superset.key_value.types import KeyValueResource
    from superset.time_range_limits.notice import _notice_key

    as_user(mocker, 2)
    result, get_entry = notice(mocker, edited_by(mocker, 1, 2))

    assert result == {"kind": "turned_on"}
    get_entry.assert_called_once_with(KeyValueResource.APP, _notice_key(2))


@pytest.mark.usefixtures("global_on")
def test_payload_editor_with_the_current_marker(mocker: MockerFixture) -> None:
    as_user(mocker, 2)
    result, _ = notice(mocker, edited_by(mocker, 2), entry(SPAN_AND_BACK))
    assert result is None


@pytest.mark.usefixtures("global_on")
def test_payload_editor_after_the_global_tightened(mocker: MockerFixture) -> None:
    as_user(mocker, 2)
    result, _ = notice(mocker, edited_by(mocker, 2), entry(stored((2, "P1Y"))))
    assert result == {"kind": "tightened"}


@pytest.mark.usefixtures("global_on")
def test_payload_expired_marker_is_no_marker(mocker: MockerFixture) -> None:
    as_user(mocker, 2)
    expired = entry(SPAN_AND_BACK, expires_on=datetime.now() - timedelta(days=1))
    result, _ = notice(mocker, edited_by(mocker, 2), expired)
    assert result == {"kind": "turned_on"}


@pytest.mark.parametrize(
    "raw",
    [
        pytest.param(b"not json", id="not_json"),
        pytest.param(b"\xff\xfe", id="not_utf8"),
        pytest.param(json.dumps({"max_span": 1}).encode(), id="bad_shape"),
    ],
)
@pytest.mark.usefixtures("global_on")
def test_payload_corrupt_marker_is_no_marker(mocker: MockerFixture, raw: bytes) -> None:
    as_user(mocker, 2)
    result, _ = notice(mocker, edited_by(mocker, 2), entry(raw))
    assert result == {"kind": "turned_on"}


@pytest.mark.usefixtures("global_on")
def test_payload_db_error_is_null_and_a_warning(
    mocker: MockerFixture, caplog: pytest.LogCaptureFixture
) -> None:
    from superset.time_range_limits.policy import dashboard_limits_payload

    as_user(mocker, 2)
    mocker.patch(
        "superset.daos.key_value.KeyValueDAO.get_entry",
        side_effect=OperationalError("SELECT", {}, Exception("gone")),
    )
    with caplog.at_level(logging.WARNING, logger="superset.time_range_limits.policy"):
        payload = dashboard_limits_payload(edited_by(mocker, 2), NOW)

    assert payload["editor_notice"] is None
    assert payload["global"] == SPAN_AND_BACK
    assert [record.levelname for record in caplog.records] == ["WARNING"]
    assert "notice of user 2 not read" in caplog.records[0].getMessage()


@pytest.mark.parametrize(
    "user_id",
    [
        pytest.param(3, id="not_an_editor"),
        pytest.param(None, id="anonymous"),
    ],
)
@pytest.mark.usefixtures("global_on")
def test_payload_not_an_editor(mocker: MockerFixture, user_id: int | None) -> None:
    as_user(mocker, user_id)
    result, get_entry = notice(mocker, edited_by(mocker, 1, 2))
    assert result is None
    get_entry.assert_not_called()


@pytest.mark.parametrize(
    "subject_ids",
    [
        pytest.param((20, 40), id="role_subject"),
        pytest.param((20, 50), id="group_subject"),
    ],
)
@pytest.mark.usefixtures("global_on")
def test_payload_editor_through_a_role_or_group(
    mocker: MockerFixture, subject_ids: tuple[int, ...]
) -> None:
    subjects = as_user(mocker, 2, *subject_ids)
    result, _ = notice(mocker, edited_by(mocker, 1, subject_ids[1]))
    assert result == {"kind": "turned_on"}
    subjects.assert_called_with(2)


@pytest.mark.usefixtures("global_on")
def test_payload_extra_editor_from_the_resolver(mocker: MockerFixture) -> None:
    dashboard = edited_by(mocker, 1)
    resolver = MagicMock(return_value=[30])
    mocker.patch.dict(current_app.config, {"EXTRA_EDITORS_RESOLVER": resolver})
    as_user(mocker, 2, 20, 30)
    result, _ = notice(mocker, dashboard)
    assert result == {"kind": "turned_on"}
    resolver.assert_called_once_with(dashboard)


@pytest.mark.usefixtures("global_on")
def test_payload_admin_not_an_editor(mocker: MockerFixture) -> None:
    """Master's ``is_editor`` counts every admin as an editor; the notice doesn't."""
    mocker.patch("superset.security_manager.is_admin", create=True, return_value=True)
    mocker.patch("superset.security_manager.is_editor", create=True, return_value=True)
    as_user(mocker, 1)
    result, _ = notice(mocker, edited_by(mocker, 2))
    assert result is None


@pytest.mark.usefixtures("global_on")
def test_payload_guest_gets_no_notice(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.security_manager.is_guest_user", create=True, return_value=True
    )
    as_user(mocker, 2)
    result, get_entry = notice(mocker, edited_by(mocker, 2))
    assert result is None
    get_entry.assert_not_called()


@pytest.mark.parametrize(
    "global_policy",
    [pytest.param(None, id="no_global"), pytest.param(config(), id="no_rule")],
)
def test_payload_global_without_a_rule(
    mocker: MockerFixture, global_policy: Any
) -> None:
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_policy})
    as_user(mocker, 2)
    result, get_entry = notice(mocker, edited_by(mocker, 2))
    assert result is None
    get_entry.assert_not_called()


@pytest.fixture
def no_transaction() -> Any:
    g.in_transaction = False
    yield
    g.pop("in_transaction", None)


@pytest.mark.usefixtures("global_on", "no_transaction")
def test_acknowledge_stores_the_global_without_user_fks(
    mocker: MockerFixture,
) -> None:
    from superset.key_value.models import KeyValueEntry
    from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
    from superset.time_range_limits.notice import _notice_key, acknowledge_editor_notice

    row = KeyValueEntry(created_by_fk=7, changed_by_fk=7)
    upsert = mocker.patch(
        "superset.daos.key_value.KeyValueDAO.upsert_entry", return_value=row
    )
    session = mocker.patch("superset.db.session")

    acknowledge_editor_notice(7)

    ((resource, value, codec, key), _) = upsert.call_args
    assert resource == KeyValueResource.APP
    assert value == SPAN_AND_BACK
    assert isinstance(codec, JsonKeyValueCodec)
    assert key == _notice_key(7)
    assert row.created_by_fk is None
    assert row.changed_by_fk is None
    session.commit.assert_called_once()


@pytest.mark.usefixtures("global_on", "no_transaction")
def test_acknowledge_race_counts_as_acknowledged(mocker: MockerFixture) -> None:
    from superset.time_range_limits.notice import acknowledge_editor_notice

    mocker.patch(
        "superset.daos.key_value.KeyValueDAO.upsert_entry", return_value=MagicMock()
    )
    session = mocker.patch("superset.db.session")
    session.commit.side_effect = IntegrityError("INSERT", {}, Exception("dup"))

    assert acknowledge_editor_notice(7) is None
    session.rollback.assert_called_once()


@pytest.mark.usefixtures("global_on", "no_transaction")
def test_acknowledge_other_db_errors_raise(mocker: MockerFixture) -> None:
    from superset.time_range_limits.notice import acknowledge_editor_notice

    mocker.patch(
        "superset.daos.key_value.KeyValueDAO.upsert_entry", return_value=MagicMock()
    )
    session = mocker.patch("superset.db.session")
    session.commit.side_effect = OperationalError("UPDATE", {}, Exception("gone"))

    with pytest.raises(SQLAlchemyError):
        acknowledge_editor_notice(7)
    session.rollback.assert_called_once()


@pytest.mark.usefixtures("no_transaction")
def test_acknowledge_under_a_bad_global_writes_nothing(
    mocker: MockerFixture,
) -> None:
    from superset.time_range_limits.notice import acknowledge_editor_notice
    from superset.time_range_limits.policy import TimeRangeLimitsUnavailableError

    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": {}})
    upsert = mocker.patch("superset.daos.key_value.KeyValueDAO.upsert_entry")
    mocker.patch("superset.db.session")

    with pytest.raises(TimeRangeLimitsUnavailableError):
        acknowledge_editor_notice(7)
    upsert.assert_not_called()
