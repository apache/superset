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
"""Legacy POST navigation must hand its chart state to the Explore SPA."""

import inspect
from types import SimpleNamespace
from typing import Any
from unittest.mock import PropertyMock
from urllib.parse import parse_qs, urlsplit

import pytest
from cachelib import SimpleCache
from flask import current_app, Response
from pytest_mock import MockerFixture

from superset.commands.dataset.exceptions import DatasetAccessDeniedError
from superset.commands.explore.form_data.get import GetFormDataCommand
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.commands.explore.form_data.utils import check_access
from superset.commands.temporary_cache.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheCreateFailedError,
)
from superset.daos.exceptions import DatasourceNotFound
from superset.extensions import cache_manager
from superset.models.sql_lab import Query
from superset.semantic_layers.models import SemanticView
from superset.utils import json
from superset.utils.core import DatasourceType
from superset.views.core import Superset
from superset.views.utils import get_explore_redirect_url


@pytest.fixture(autouse=True)
def explore_dependencies(mocker: MockerFixture) -> None:
    """Keep navigation and cache real; isolate dataset storage and authorization."""
    datasource = SimpleNamespace(
        id=7,
        type="table",
        name="preview_data",
        table_name="preview_data",
        default_endpoint=None,
        data={"columns": [], "metrics": [], "database": {"id": 1}},
    )
    mocker.patch(
        "superset.views.core.DatasourceDAO.get_datasource", return_value=datasource
    )
    mocker.patch("superset.views.core.security_manager.raise_for_access")
    mocker.patch("superset.views.core.security_manager.can_access", return_value=True)
    mocker.patch("superset.views.core.security_manager.is_editor", return_value=False)
    mocker.patch("superset.commands.explore.form_data.create.check_access")
    mocker.patch("superset.commands.explore.form_data.get.check_access")
    mocker.patch(
        "superset.commands.explore.form_data.create.get_user_id", return_value=1
    )
    mocker.patch.object(
        type(cache_manager),
        "explore_form_data_cache",
        new_callable=PropertyMock,
        return_value=SimpleCache(),
    )
    # Let the unfixed view reach its legacy render so the regression fails on
    # navigation, not on unrelated template or user-bootstrap dependencies.
    mocker.patch("superset.views.core.bootstrap_user_data", return_value={})
    mocker.patch("superset.views.core.common_bootstrap_payload", return_value={})
    mocker.patch("superset.views.core.g", user=None)
    mocker.patch(
        "superset.views.core.Superset.render_app_template",
        return_value=Response("legacy renderer"),
    )


@pytest.mark.parametrize("typed", [False, True])
@pytest.mark.parametrize("script_name", ["", "/analytics"])
def test_post_explore_round_trips_form_data(typed: bool, script_name: str) -> None:
    form_data: dict[str, Any] = {
        "datasource": "7__table",
        "viz_type": "echarts_timeseries_bar",
        "metrics": ["count"],
        "groupby": ["category"],
        "time_range": "2026-01-01 : 2026-02-01",
        "slice_name": "Preview with spaces and Unicode: Καλημέρα",
        "adhoc_filters": [],
    }
    path = "/explore/table/7/" if typed else "/explore/"
    with current_app.test_request_context(
        path + "?standalone=1&height=400&force=true&form_data_key=expired",
        method="POST",
        data={"form_data": json.dumps(form_data)},
        environ_overrides={"SCRIPT_NAME": script_name},
    ):
        response = inspect.unwrap(Superset.explore)(
            Superset(),
            datasource_id=7 if typed else None,
            datasource_type="table" if typed else None,
        )
        assert response.status_code == 303
        location = urlsplit(response.headers["Location"])
        assert location.path == script_name + "/explore/"
        query = parse_qs(location.query)
        key = query.pop("form_data_key")[0]
        assert key != "expired"
        assert query == {"standalone": ["1"], "height": ["400"], "force": ["true"]}
        cached = GetFormDataCommand(CommandParameters(key=key)).run()
        assert cached is not None
        restored = json.loads(cached)
        for field, value in form_data.items():
            assert restored[field] == value


def test_post_explore_caches_normalized_filters_and_query_overrides() -> None:
    with current_app.test_request_context(
        "/explore/",
        method="POST",
        query_string={
            "form_data": json.dumps({"viz_type": "table"}),
            "_external": "1",
            "_scheme": "ftp",
            "_anchor": "evil",
            "_method": "POST",
            "endpoint": "other",
        },
        data={
            "form_data": json.dumps(
                {
                    "datasource": "7__table",
                    "viz_type": "line",
                    "extra_filters": [{"col": "category", "op": "IN", "val": ["A"]}],
                }
            )
        },
    ):
        response = inspect.unwrap(Superset.explore)(Superset())
        assert response.status_code == 303
        location = urlsplit(response.headers["Location"])
        assert not location.scheme
        assert not location.netloc
        assert not location.fragment
        query = parse_qs(location.query)
        assert set(query) == {"form_data_key"}
        cached = GetFormDataCommand(
            CommandParameters(key=query["form_data_key"][0])
        ).run()
        assert cached is not None
        restored = json.loads(cached)
        assert restored["viz_type"] == "table"
        assert not restored.get("extra_filters")
        assert restored["adhoc_filters"][0]["subject"] == "category"
        assert restored["adhoc_filters"][0]["comparator"] == ["A"]


@pytest.mark.parametrize("action", ["saveas", "overwrite"])
def test_post_explore_preserves_save_permission_denials(
    action: str,
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.views.core.security_manager.can_access", return_value=False)
    cache_write = mocker.spy(cache_manager.explore_form_data_cache, "set")
    with current_app.test_request_context(
        "/explore/?action=" + action,
        method="POST",
        data={"form_data": json.dumps({"datasource": "7__table"})},
    ):
        response = inspect.unwrap(Superset.explore)(Superset())
    assert response.status_code == 403
    cache_write.assert_not_called()


def test_post_explore_saveas_keeps_existing_save_handler(mocker: MockerFixture) -> None:
    save = mocker.patch.object(
        Superset, "save_or_overwrite_slice", return_value=Response("saved")
    )
    cache_write = mocker.spy(cache_manager.explore_form_data_cache, "set")
    with current_app.test_request_context(
        "/explore/?action=saveas",
        method="POST",
        data={
            "form_data": json.dumps({"datasource": "7__table"}),
            "query_context": "{}",
        },
    ):
        response = inspect.unwrap(Superset.explore)(Superset())
    assert response.get_data(as_text=True) == "saved"
    assert save.call_args.args[-1] == "{}"
    cache_write.assert_not_called()


def test_post_explore_cache_access_denial_is_not_swallowed(
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.commands.explore.form_data.create.check_access",
        side_effect=TemporaryCacheAccessDeniedError(),
    )
    with (
        current_app.test_request_context(
            "/explore/",
            method="POST",
            data={"form_data": json.dumps({"datasource": "7__table"})},
        ),
        pytest.raises(TemporaryCacheAccessDeniedError),
    ):
        inspect.unwrap(Superset.explore)(Superset())


@pytest.mark.parametrize(
    "result", ["", ValueError("cache unavailable"), TemporaryCacheCreateFailedError()]
)
def test_post_explore_reports_missing_cache_key(
    result: str | Exception, mocker: MockerFixture
) -> None:
    run = mocker.patch(
        "superset.commands.explore.form_data.create.CreateFormDataCommand.run"
    )
    if isinstance(result, Exception):
        run.side_effect = result
    else:
        run.return_value = result
    with current_app.test_request_context(
        "/explore/",
        method="POST",
        data={"form_data": json.dumps({"datasource": "7__table"})},
    ):
        response = inspect.unwrap(Superset.explore)(Superset())
    assert response.status_code == 500
    assert json.loads(response.get_data(as_text=True))["error"]
    assert "Location" not in response.headers


def test_post_explore_missing_dataset_returns_error(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.views.core.DatasourceDAO.get_datasource",
        side_effect=DatasourceNotFound(),
    )
    cache_write = mocker.spy(cache_manager.explore_form_data_cache, "set")
    with current_app.test_request_context(
        "/explore/",
        method="POST",
        data={"form_data": json.dumps({"datasource": "7__table"})},
    ):
        response = inspect.unwrap(Superset.explore)(Superset())
    assert response.status_code == 404
    assert json.loads(response.get_data(as_text=True))["error"]
    cache_write.assert_not_called()


def test_post_explore_checks_datasource_before_caching(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.views.core.security_manager.raise_for_access",
        side_effect=DatasetAccessDeniedError(),
    )
    cache_write = mocker.spy(cache_manager.explore_form_data_cache, "set")
    with (
        current_app.test_request_context(
            "/explore/",
            method="POST",
            data={"form_data": json.dumps({"datasource": "7__table"})},
        ),
        pytest.raises(DatasetAccessDeniedError),
    ):
        inspect.unwrap(Superset.explore)(Superset())
    cache_write.assert_not_called()


def test_get_explore_keeps_query_form_data_contract() -> None:
    form_data = {"datasource": "7__table", "metrics": ["count"]}
    with current_app.test_request_context(
        "/explore/",
        query_string={"form_data": json.dumps(form_data)},
    ):
        location = get_explore_redirect_url()
        assert location is not None
        key = parse_qs(urlsplit(location).query)["form_data_key"][0]
        cached = GetFormDataCommand(CommandParameters(key=key)).run()
        assert cached is not None
        assert json.loads(cached) == form_data
    with current_app.test_request_context("/explore/"):
        assert get_explore_redirect_url() is None


@pytest.mark.parametrize("typed", [False, True])
@pytest.mark.parametrize(
    "datasource_type", [DatasourceType.QUERY, DatasourceType.SEMANTIC_VIEW]
)
def test_post_explore_looks_up_the_requested_datasource_type(
    typed: bool, datasource_type: DatasourceType, mocker: MockerFixture
) -> None:
    datasource = (
        Query(id=7, tab_name="preview_query")
        if datasource_type == DatasourceType.QUERY
        else SemanticView(id=7, name="preview_view")
    )

    def get_datasource(source_type: str, source_id: int) -> Query | SemanticView:
        if source_type != datasource_type or source_id != 7:
            raise DatasourceNotFound()
        return datasource

    mocker.patch(
        "superset.views.core.DatasourceDAO.get_datasource",
        side_effect=get_datasource,
    )
    access = mocker.patch("superset.views.core.security_manager.raise_for_access")
    path = f"/explore/{datasource_type}/7/" if typed else "/explore/"
    with current_app.test_request_context(
        path,
        method="POST",
        data={"form_data": json.dumps({"datasource": f"7__{datasource_type}"})},
    ):
        response = inspect.unwrap(Superset.explore)(
            Superset(),
            datasource_id=7 if typed else None,
            datasource_type=datasource_type if typed else None,
        )
        assert response.status_code == 303
        key = parse_qs(urlsplit(response.location).query)["form_data_key"][0]
        cached = GetFormDataCommand(CommandParameters(key=key)).run()
        assert cached is not None
        assert json.loads(cached)["datasource"] == f"7__{datasource_type}"
    if datasource_type == DatasourceType.QUERY:
        access.assert_called_once_with(
            query=datasource,
            datasource=datasource,
            allow_query_authorship_bypass=True,
            allow_editorship=False,
        )
    else:
        access.assert_called_once_with(datasource=datasource)


def test_post_explore_rejects_a_failed_cache_write(mocker: MockerFixture) -> None:
    cache_write = mocker.patch.object(
        cache_manager.explore_form_data_cache, "set", return_value=False
    )
    with current_app.test_request_context(
        "/explore/",
        method="POST",
        data={"form_data": json.dumps({"datasource": "7__table"})},
    ):
        response = inspect.unwrap(Superset.explore)(Superset())
    assert response.status_code == 500
    assert "Location" not in response.headers
    assert json.loads(response.get_data(as_text=True))["error"]
    cache_write.assert_called_once()


@pytest.mark.parametrize("method", ["GET", "POST"])
@pytest.mark.parametrize("slice_id", [42, "42"])
def test_explore_caches_chart_id_for_access_revalidation(
    method: str, slice_id: int | str, mocker: MockerFixture
) -> None:
    form_data = {"datasource": "7__table", "slice_id": slice_id}
    with current_app.test_request_context(
        "/explore/",
        method=method,
        query_string={"slice_id": "99", "form_data": json.dumps(form_data)},
    ):
        location = get_explore_redirect_url(form_data if method == "POST" else None)
        assert location is not None
        key = parse_qs(urlsplit(location).query)["form_data_key"][0]
        state = cache_manager.explore_form_data_cache.get(key)
        assert state["chart_id"] == 42
        access = mocker.patch(
            "superset.commands.explore.form_data.get.check_access",
            wraps=check_access,
        )
        mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id")
        chart_lookup = mocker.patch("superset.daos.chart.ChartDAO.find_by_id")
        mocker.patch(
            "superset.explore.utils.security_manager.can_access_datasource",
            return_value=True,
        )
        mocker.patch(
            "superset.explore.utils.security_manager.can_access", return_value=False
        )
        with pytest.raises(TemporaryCacheAccessDeniedError):
            GetFormDataCommand(CommandParameters(key=key)).run()
        access.assert_called_once_with(7, 42, DatasourceType.TABLE)
        chart_lookup.assert_called_once_with(42, skip_base_filter=True)


def test_get_explore_falls_through_on_failed_cache_write(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(
        cache_manager.explore_form_data_cache, "set", return_value=False
    )
    with current_app.test_request_context(
        "/explore/",
        query_string={"form_data": json.dumps({"datasource": "7__table"})},
    ):
        assert get_explore_redirect_url() is None
