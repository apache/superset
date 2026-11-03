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

from collections.abc import Iterator
from typing import Any

import pytest
from flask import g
from pytest_mock import MockerFixture
from superset_core.exports import export as api

from superset.core.api.core_api_injection import inject_export_implementations

_STUB_NAMES = (
    "run_query_context",
    "iter_dashboard_chart_results",
    "build_tab_name",
    "can_export_data",
    "can_export_dashboard",
    "as_user",
)


@pytest.fixture(autouse=True)
def restore_export_stubs() -> Iterator[None]:
    originals = {name: getattr(api, name) for name in _STUB_NAMES}
    yield
    for name, original in originals.items():
        setattr(api, name, original)


def test_injection_replaces_every_stub(app_context: None) -> None:
    from superset.charts.data.run_query_context import (
        can_export_dashboard,
        can_export_data,
        run_query_context,
    )
    from superset.dashboards.excel_export.chart_results import (
        iter_dashboard_chart_results,
    )

    inject_export_implementations()

    assert api.run_query_context is run_query_context
    assert api.iter_dashboard_chart_results is iter_dashboard_chart_results
    assert api.can_export_data is can_export_data
    assert api.can_export_dashboard is can_export_dashboard
    assert api.build_tab_name("History", set(), 100) == "History"


def test_build_tab_name_skips_excel_rules(app_context: None) -> None:
    inject_export_implementations()

    # Excel-only rules would reject the reserved name "History".
    assert api.build_tab_name("History", set(), 100) == "History"
    assert api.build_tab_name("a" * 50, set(), 10) == "a" * 10


def test_as_user_sets_and_restores_g_user(
    app_context: None, mocker: MockerFixture
) -> None:
    user = mocker.MagicMock()
    mocker.patch("superset.daos.user.UserDAO.find_by_id", return_value=user)
    inject_export_implementations()

    with api.as_user(3):
        assert g.user is user
    assert getattr(g, "user", None) is not user


def test_as_user_overrides_existing_user_and_restores_it(
    app_context: None, mocker: MockerFixture
) -> None:
    original: Any = mocker.MagicMock()
    other: Any = mocker.MagicMock()
    mocker.patch("superset.daos.user.UserDAO.find_by_id", return_value=other)
    inject_export_implementations()

    g.user = original
    try:
        with api.as_user(3):
            assert g.user is other
        assert g.user is original
    finally:
        del g.user


def test_as_user_unknown_user_raises(app_context: None, mocker: MockerFixture) -> None:
    mocker.patch("superset.daos.user.UserDAO.find_by_id", return_value=None)
    inject_export_implementations()

    with pytest.raises(ValueError, match="does not exist"):
        with api.as_user(404):
            pass
