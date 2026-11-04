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
"""A dataset change shown nowhere is a dataset change approved unseen.

``dataset_detail`` emitted ``sql``, ``columns`` and ``metrics``, and the
review dialog had a tab for each. Every other field a dataset write
carries -- ``main_dttm_col``, ``fetch_values_predicate``,
``template_params``, ``cache_timeout``, ``table_name``, the ``description``
riding along with a governed edit, and ``extra.warning_markdown``, which
puts a banner in front of every viewer -- was replayed on approve and shown
on no tab at all. The reviewer read "No column changed." and approved it
(129075).

Which fields moved is the gate's question. It is asked here rather than
answered a second time, so the dialog cannot come to disagree with the
capture, which is how the ``json_metadata`` noise got in last time.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import api
from pytest_mock import MockerFixture


@pytest.fixture
def dataset_request(mocker: MockerFixture) -> Any:
    mocker.patch.object(
        api, "dataset_impact", return_value={"charts": 0, "dashboards": 0}
    )
    return lambda body: SimpleNamespace(
        id=1, asset_type="dataset", operation="update", payload_dict=body
    )


def _live(**over: Any) -> SimpleNamespace:
    base: dict[str, Any] = {
        "columns": [],
        "metrics": [],
        "sql": None,
        "table_name": "sales",
        "description": None,
        "main_dttm_col": None,
        "cache_timeout": None,
        "fetch_values_predicate": None,
        "template_params": None,
        "extra": None,
    }
    base.update(over)
    return SimpleNamespace(**base)


def _settings(detail: dict[str, Any]) -> dict[str, Any]:
    return {entry["field"]: entry for entry in detail.get("settings", [])}


def test_a_governed_setting_is_shown_with_its_before_and_after(
    dataset_request: Any,
) -> None:
    """The sharpest case: a filter predicate nobody could see.

    A reviewer approving this was approving a change to which rows the
    dataset's filter values are drawn from, with the dialog telling them
    the columns were untouched -- which was true, and beside the point.
    """
    live = _live(fetch_values_predicate="ds > '2020-01-01'")
    body = {"fetch_values_predicate": "1 = 1"}

    settings = _settings(api.dataset_detail(dataset_request(body), live))

    assert settings["fetch_values_predicate"]["before"] == "ds > '2020-01-01'"
    assert settings["fetch_values_predicate"]["after"] == "1 = 1"


def test_a_warning_banner_is_shown(dataset_request: Any) -> None:
    """``extra.warning_markdown`` stays governed because viewers see it, so
    the reviewer has to see it too."""
    live = _live(extra='{"warning_markdown": "old"}')
    body = {"extra": '{"warning_markdown": "do not use"}'}

    settings = _settings(api.dataset_detail(dataset_request(body), live))

    assert "do not use" in settings["extra"]["after"]


def test_the_sql_columns_and_metrics_tabs_keep_their_own_fields(
    dataset_request: Any,
) -> None:
    """Settings is "everything else", never a second copy of the three."""
    live = _live(sql="SELECT 1", table_name="sales")
    body = {"sql": "SELECT 2", "columns": [], "metrics": [], "table_name": "revenue"}

    detail = api.dataset_detail(dataset_request(body), live)

    assert set(_settings(detail)) == {"table_name"}
    assert detail["sql"]["after"] == "SELECT 2"


def test_a_description_riding_with_a_governed_change_is_shown(
    dataset_request: Any,
) -> None:
    """The exemption is per *write*, not per field (SOW 5.2).

    A description on its own applies directly and never reaches review. A
    description travelling with a SQL rewrite is part of a governed write,
    so approving the write approves the description, and a reviewer who
    cannot see it is approving it blind.
    """
    live = _live(sql="SELECT 1", description="old")
    body = {"sql": "SELECT 2", "description": "new"}
    request = dataset_request(body)
    # The capture names the exempt fields this write changed; one it does not
    # name is the form echoing a value back and is not written on approval.
    request.command_args = {"exempt_fields": ["description"]}

    settings = _settings(api.dataset_detail(request, live))

    assert settings["description"] == {
        "field": "description",
        "before": "old",
        "after": "new",
    }


def test_a_field_the_body_restates_unchanged_is_not_listed(
    dataset_request: Any,
) -> None:
    """The dataset editor posts every field it shows. Listing the ones that
    came back unchanged is the noise QA-15 removed from the dashboard panel
    and this must not reintroduce."""
    live = _live(sql="SELECT 1", table_name="sales", cache_timeout=60)
    body = {"sql": "SELECT 2", "table_name": "sales", "cache_timeout": 60}

    assert _settings(api.dataset_detail(dataset_request(body), live)) == {}


def test_a_change_with_nothing_else_in_it_carries_no_settings_key(
    dataset_request: Any,
) -> None:
    """Absent rather than empty, like ``sql`` and ``columns`` beside it."""
    live = _live(sql="SELECT 1")
    body = {"sql": "SELECT 2"}

    assert "settings" not in api.dataset_detail(dataset_request(body), live)


def test_a_long_value_is_shortened_and_says_so(dataset_request: Any) -> None:
    """Never silently dropped: a reviewer who cannot see what they are
    approving is the thing this feature exists to prevent."""
    live = _live(template_params=None)
    body = {"template_params": "x" * (api.SHOWN_VALUE_LIMIT + 10)}

    settings = _settings(api.dataset_detail(dataset_request(body), live))

    assert settings["template_params"]["truncated"] is True
    assert len(settings["template_params"]["after"]) == api.SHOWN_VALUE_LIMIT


def test_a_value_too_structural_to_render_is_still_reported(
    dataset_request: Any,
) -> None:
    """Marked opaque rather than left out. "This field moved" is strictly
    more than the three tabs ever said about it."""
    live = _live(owners=[SimpleNamespace(id=1)])
    body = {"owners": [2]}
    request = dataset_request(body)
    request.command_args = {"exempt_fields": ["owners"]}

    settings = _settings(api.dataset_detail(request, live))

    assert settings["owners"]["opaque"] is True


def test_a_delete_has_no_settings(dataset_request: Any) -> None:
    """A delete has no fields at all: the asset is the change."""
    request = dataset_request({})
    request.operation = "delete"

    assert api.dataset_detail(request, _live()) == {
        "impact": {"charts": 0, "dashboards": 0}
    }
