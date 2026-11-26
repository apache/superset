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

from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import current_app
from freezegun import freeze_time
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset import security_manager
from superset.commands.dashboard.copy import CopyDashboardCommand
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardInvalidError,
)
from superset.models.dashboard import Dashboard
from superset.time_range_limits.adjustments import TimeRangeAdjustmentsRequiredError
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags


def _make_dashboard() -> MagicMock:
    dash = MagicMock()
    dash.id = 1
    dash.dashboard_title = "Original Dashboard"
    return dash


def _make_security_manager(is_editor: bool) -> MagicMock:
    sm = MagicMock()
    sm.is_editor = MagicMock(return_value=is_editor)
    return sm


VALID_DATA = {
    "dashboard_title": "Copied Dashboard",
    "json_metadata": "{}",
}


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_refuses_a_clamp_to_zero_look_back_and_forward(
    mocker: MockerFixture,
) -> None:
    zero_days = {"quantity": 0, "time_grain": "P1D"}
    global_limits = {
        "schema_version": 1,
        "max_span": None,
        "max_look_back": zero_days,
        "max_look_forward": None,
    }
    stored = {
        **global_limits,
        "max_look_back": {"quantity": 5, "time_grain": "P1D"},
        "max_look_forward": zero_days,
    }
    source = Dashboard(json_metadata=json.dumps({"time_range_limits": stored}))
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_limits})
    mocker.patch(
        "superset.commands.dashboard.copy.security_manager.is_editor", return_value=True
    )

    with pytest.raises(DashboardInvalidError) as excinfo:
        CopyDashboardCommand(source, VALID_DATA).validate()

    assert excinfo.value.status == 422
    assert excinfo.value.normalized_messages() == {
        "json_metadata.time_range_limits.max_look_forward.quantity": [
            "Look-back and look-forward can't both be 0: no time range would fit."
        ]
    }


def stale_source(session: Session, default: str = "No filter") -> Dashboard:
    """A source dashboard whose 20-week span a 12-week global made stale, with a
    Time Range filter that has no default unless ``default`` is given."""
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    mask: dict[str, Any] = {"filterState": {"value": default}}
    if default != "No filter":
        mask["extraFormData"] = {"time_range": default}
    source = Dashboard(
        dashboard_title="Source",
        json_metadata=json.dumps(
            {
                "time_range_limits": span(20),
                "native_filter_configuration": [
                    {
                        "id": "NATIVE_FILTER-time",
                        "name": "Date",
                        "filterType": "filter_time",
                        "defaultDataMask": mask,
                    }
                ],
            }
        ),
    )
    session.add(source)
    session.commit()
    return source


def span(weeks: int) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "max_span": {"quantity": weeks, "time_grain": "P1W"},
        "max_look_back": None,
        "max_look_forward": None,
    }


COPY_DATA = {"dashboard_title": "Copy", "json_metadata": json.dumps({"positions": {}})}


def copy_adjustments(source: Dashboard, weeks: int = 12) -> list[dict[str, Any]]:
    """The changes copying ``stale_source`` asks for under a ``weeks`` global."""
    identity = {"dashboard": "Copy", "dashboard_key": str(source.uuid), "file": None}
    return [
        {
            **identity,
            "kind": "time_range_limit",
            "name": "Copy",
            "filter_id": None,
            "field": "max_span",
            "old": {"quantity": 20, "time_grain": "P1W"},
            "new": {"quantity": weeks, "time_grain": "P1W"},
            "old_label": "20 weeks",
            "new_label": f"{weeks} weeks",
        },
        {
            **identity,
            "kind": "filter_default",
            "name": "Date",
            "filter_id": "NATIVE_FILTER-time",
            "field": "default",
            "old": None,
            "new": f'DATEADD(DATETIME("today"), -{weeks}, week) : today',
            "old_label": "No filter",
            "new_label": f"Last {weeks} weeks",
        },
    ]


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_asks_before_adjusting_time_ranges(
    session: Session, mocker: MockerFixture
) -> None:
    source = stale_source(session)
    before = source.json_metadata
    expected = copy_adjustments(source)
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": span(12)})
    mocker.patch.object(security_manager, "is_editor", return_value=True)

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as excinfo:
        CopyDashboardCommand(source, COPY_DATA).run()

    assert excinfo.value.status == 422
    assert excinfo.value.payload() == expected
    assert session.query(Dashboard).count() == 1
    assert session.query(Dashboard).one().json_metadata == before

    copied = CopyDashboardCommand(
        session.query(Dashboard).one(), {**COPY_DATA, "adjust_time_ranges": True}
    ).run()

    assert session.query(Dashboard).count() == 2
    metadata = copied.params_dict
    assert metadata["time_range_limits"]["max_span"] == expected[0]["new"]
    mask = metadata["native_filter_configuration"][0]["defaultDataMask"]
    assert mask["filterState"]["value"] == expected[1]["new"]
    assert session.get(Dashboard, source.id).json_metadata == before


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_asks_again_when_the_changes_differ_from_the_preview(
    session: Session, mocker: MockerFixture
) -> None:
    source = stale_source(session)
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": span(12)})
    with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
        CopyDashboardCommand(source, COPY_DATA).run()
    agreed = {
        **COPY_DATA,
        "adjust_time_ranges": True,
        "time_range_adjustments_fingerprint": preview.value.fingerprint,
    }

    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": span(10)})
    with pytest.raises(TimeRangeAdjustmentsRequiredError) as again:
        CopyDashboardCommand(session.query(Dashboard).one(), agreed).run()

    assert again.value.payload() == copy_adjustments(source, 10)
    assert again.value.fingerprint != preview.value.fingerprint
    assert session.query(Dashboard).count() == 1

    copied = CopyDashboardCommand(
        session.query(Dashboard).one(),
        {**agreed, "time_range_adjustments_fingerprint": again.value.fingerprint},
    ).run()

    assert copied.params_dict["time_range_limits"]["max_span"] == {
        "quantity": 10,
        "time_grain": "P1W",
    }
    assert session.query(Dashboard).count() == 2


FIXED_PERIOD = "2025-01-01T00:00:00 : 2025-06-01T00:00:00"
ROLLING_12_WEEKS = 'DATEADD(DATETIME("today"), -12, week) : today'


def filter_change(error: TimeRangeAdjustmentsRequiredError) -> dict[str, Any]:
    [item] = [item for item in error.payload() if item["kind"] == "filter_default"]
    return item


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_replaces_a_fixed_default_with_a_rolling_range(
    session: Session, mocker: MockerFixture
) -> None:
    """A fixed period that no longer fits becomes a rolling range of the allowed
    length, listed with its old dates, and saved exactly as listed."""
    source = stale_source(session, FIXED_PERIOD)
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": span(12)})

    with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
        CopyDashboardCommand(source, COPY_DATA).run()

    change = filter_change(preview.value)
    assert (change["old"], change["new"]) == (FIXED_PERIOD, ROLLING_12_WEEKS)
    assert (change["old_label"], change["new_label"]) == (
        "2025-01-01 to 2025-06-01",
        "Last 12 weeks",
    )
    copied = CopyDashboardCommand(
        session.query(Dashboard).one(),
        {
            **COPY_DATA,
            "adjust_time_ranges": True,
            "time_range_adjustments_fingerprint": preview.value.fingerprint,
        },
    ).run()
    mask = copied.params_dict["native_filter_configuration"][0]["defaultDataMask"]
    assert mask["filterState"]["value"] == change["new"]
    assert mask["extraFormData"]["time_range"] == change["new"]


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_proposal_does_not_move_with_the_clock(
    session: Session, mocker: MockerFixture
) -> None:
    """Hours later, the same source and limits give the same list and
    fingerprint, so the reviewed fingerprint still agrees."""
    source = stale_source(session, "2026-11-24T00:00:00 : 2026-11-27T00:00:00")
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    hours = {
        "schema_version": 1,
        "max_span": None,
        "max_look_back": {"quantity": 6, "time_grain": "PT1H"},
        "max_look_forward": {"quantity": 2, "time_grain": "PT1H"},
    }
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": hours})

    with freeze_time("2026-11-25 12:00:00") as clock:
        with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
            CopyDashboardCommand(source, COPY_DATA).run()
        clock.tick(timedelta(hours=3, minutes=7, seconds=13))
        with pytest.raises(TimeRangeAdjustmentsRequiredError) as later:
            CopyDashboardCommand(source, COPY_DATA).run()
        assert later.value.payload() == preview.value.payload()
        assert later.value.fingerprint == preview.value.fingerprint
        copied = CopyDashboardCommand(
            source,
            {
                **COPY_DATA,
                "adjust_time_ranges": True,
                "time_range_adjustments_fingerprint": preview.value.fingerprint,
            },
        ).run()

    mask = copied.params_dict["native_filter_configuration"][0]["defaultDataMask"]
    assert mask["filterState"]["value"] == filter_change(preview.value)["new"]
    assert mask["filterState"]["value"] == 'DATEADD(DATETIME("now"), -6, hour) : now'


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_asks_again_when_the_reviewed_changes_are_no_longer_needed(
    session: Session, mocker: MockerFixture
) -> None:
    """The preview proposed a rolling range; by the confirmation the stored
    range fits again. Saving it unchanged isn't what was agreed to either, so
    the retry gets an empty list to confirm, and that confirmation saves the
    stored range as it is."""
    stored = "2026-11-25T11:00:00 : 2026-11-25T14:01:00"
    source = stale_source(session, stored)
    metadata = source.params_dict
    del metadata["time_range_limits"]
    source.json_metadata = json.dumps(metadata)
    session.commit()
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    hours = {
        "schema_version": 1,
        "max_span": {"quantity": 6, "time_grain": "PT1H"},
        "max_look_back": None,
        "max_look_forward": {"quantity": 2, "time_grain": "PT1H"},
    }
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": hours})

    def agreed(fingerprint: str) -> dict[str, Any]:
        return {
            **COPY_DATA,
            "adjust_time_ranges": True,
            "time_range_adjustments_fingerprint": fingerprint,
        }

    with freeze_time("2026-11-25 12:00:00") as clock:
        with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
            CopyDashboardCommand(source, COPY_DATA).run()
        assert filter_change(preview.value)["new"] == (
            'DATEADD(DATETIME("now"), -6, hour) : now'
        )

        clock.tick(timedelta(minutes=2))
        with pytest.raises(TimeRangeAdjustmentsRequiredError) as stale:
            CopyDashboardCommand(source, agreed(preview.value.fingerprint)).run()
        assert stale.value.status == 422
        assert stale.value.payload() == []
        assert stale.value.fingerprint != preview.value.fingerprint
        assert "no longer needed" in stale.value.message
        assert session.query(Dashboard).count() == 1

        copied = CopyDashboardCommand(source, agreed(stale.value.fingerprint)).run()

    mask = copied.params_dict["native_filter_configuration"][0]["defaultDataMask"]
    assert mask["filterState"]["value"] == stored
    assert session.query(Dashboard).count() == 2


@with_feature_flags(TIME_RANGE_LIMITS=False)
def test_copy_dashboard_flag_off_ignores_a_fingerprint(
    session: Session, mocker: MockerFixture
) -> None:
    source = stale_source(session)
    mocker.patch.object(security_manager, "is_editor", return_value=True)

    copied = CopyDashboardCommand(
        source,
        {
            **COPY_DATA,
            "adjust_time_ranges": True,
            "time_range_adjustments_fingerprint": "from an earlier preview",
        },
    ).run()

    assert copied.params_dict["time_range_limits"] == span(20)


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_refuses_when_no_rolling_range_fits(
    session: Session, mocker: MockerFixture
) -> None:
    """With only a look-forward limit there is no rolling length to offer, so a
    fixed default past it is refused as before, and nothing is copied."""
    source = stale_source(session, "2026-11-24T00:00:00 : 2026-11-27T00:00:00")
    metadata = source.params_dict
    del metadata["time_range_limits"]
    source.json_metadata = json.dumps(metadata)
    session.commit()
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    forward = {
        "schema_version": 1,
        "max_span": None,
        "max_look_back": None,
        "max_look_forward": {"quantity": 2, "time_grain": "PT1H"},
    }
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": forward})

    with freeze_time("2026-11-25 12:00:00"):
        with pytest.raises(DashboardInvalidError) as excinfo:
            CopyDashboardCommand(source, COPY_DATA).run()

    assert list(excinfo.value.normalized_messages()) == [
        "json_metadata.native_filter_configuration.NATIVE_FILTER-time.defaultDataMask"
    ]
    assert session.query(Dashboard).count() == 1


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_asks_again_for_an_unknown_fingerprint(
    session: Session, mocker: MockerFixture
) -> None:
    source = stale_source(session)
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": span(12)})
    with pytest.raises(TimeRangeAdjustmentsRequiredError) as preview:
        CopyDashboardCommand(source, COPY_DATA).run()

    for sent in (preview.value.fingerprint[:-1], "not a fingerprint", "\ud800 é ✓"):
        with pytest.raises(TimeRangeAdjustmentsRequiredError) as again:
            CopyDashboardCommand(
                session.query(Dashboard).one(),
                {
                    **COPY_DATA,
                    "adjust_time_ranges": True,
                    "time_range_adjustments_fingerprint": sent,
                },
            ).run()
        assert again.value.status == 422
        assert again.value.payload() == preview.value.payload()
    assert session.query(Dashboard).count() == 1


@with_feature_flags(TIME_RANGE_LIMITS=True)
def test_copy_dashboard_that_fits_copies_without_asking(
    session: Session, mocker: MockerFixture
) -> None:
    source = stale_source(session, "Last week")
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": span(20)})
    mocker.patch.object(security_manager, "is_editor", return_value=True)

    copied = CopyDashboardCommand(source, COPY_DATA).run()

    assert copied.params_dict["time_range_limits"] == span(20)
    mask = copied.params_dict["native_filter_configuration"][0]["defaultDataMask"]
    assert mask["filterState"]["value"] == "Last week"


@with_feature_flags(TIME_RANGE_LIMITS=False)
def test_copy_dashboard_flag_off_copies_stale_ranges_unchanged(
    session: Session, mocker: MockerFixture
) -> None:
    source = stale_source(session)
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": span(12)})
    mocker.patch.object(security_manager, "is_editor", return_value=True)

    copied = CopyDashboardCommand(source, COPY_DATA).run()

    assert copied.params_dict["time_range_limits"] == span(20)
    mask = copied.params_dict["native_filter_configuration"][0]["defaultDataMask"]
    assert mask == {"filterState": {"value": "No filter"}}


def test_copy_dashboard_validate_non_editor_forbidden():
    """Non-editors cannot copy a dashboard (is_editor returns False)."""
    dash = _make_dashboard()
    cmd = CopyDashboardCommand(dash, VALID_DATA)
    mock_sm = _make_security_manager(is_editor=False)

    with patch(
        "superset.commands.dashboard.copy.security_manager",
        mock_sm,
    ):
        with pytest.raises(DashboardForbiddenError):
            cmd.validate()
        mock_sm.is_editor.assert_called_once_with(dash)


def test_copy_dashboard_validate_editor_allowed():
    """Editors can copy a dashboard (is_editor returns True)."""
    dash = _make_dashboard()
    cmd = CopyDashboardCommand(dash, VALID_DATA)
    mock_sm = _make_security_manager(is_editor=True)

    with patch(
        "superset.commands.dashboard.copy.security_manager",
        mock_sm,
    ):
        cmd.validate()  # should not raise
        mock_sm.is_editor.assert_called_once_with(dash)


def test_copy_dashboard_validate_missing_title():
    """Missing dashboard_title raises DashboardInvalidError."""
    dash = _make_dashboard()
    data = {"json_metadata": "{}"}
    cmd = CopyDashboardCommand(dash, data)

    with pytest.raises(DashboardInvalidError):
        cmd.validate()


def test_copy_dashboard_validate_missing_json_metadata():
    """Missing json_metadata raises DashboardInvalidError."""
    dash = _make_dashboard()
    data = {"dashboard_title": "Copied Dashboard"}
    cmd = CopyDashboardCommand(dash, data)

    with pytest.raises(DashboardInvalidError):
        cmd.validate()
