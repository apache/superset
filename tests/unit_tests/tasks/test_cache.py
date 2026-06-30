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
from typing import Any, Optional
from unittest import mock


def _fake_app(config: Optional[dict[str, Any]] = None) -> mock.MagicMock:
    """Build a stand-in for ``current_app`` with a controllable config dict."""
    base: dict[str, Any] = {"WEBDRIVER_TYPE": "chrome"}
    if config:
        base.update(config)
    app: mock.MagicMock = mock.MagicMock()
    app.config = base
    return app


def test_cache_warmup_unknown_strategy(app_context: None) -> None:
    """An unknown strategy name returns an explanatory message and warms nothing."""
    from superset.tasks.cache import cache_warmup

    with mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd:
        result: dict[str, list[str]] | str = cache_warmup("does_not_exist")

    assert result == "No strategy does_not_exist found!"
    mock_wd.assert_not_called()


def test_cache_warmup_missing_config(app_context: None) -> None:
    """Without SUPERSET_CACHE_WARMUP_USER the task fails fast before any WebDriver."""
    from superset.tasks.cache import cache_warmup

    with (
        mock.patch(
            "superset.tasks.cache.current_app",
            _fake_app({"SUPERSET_CACHE_WARMUP_USER": None}),
        ),
        mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd,
    ):
        result: dict[str, list[str]] | str = cache_warmup("dummy")

    assert isinstance(result, str)
    assert "SUPERSET_CACHE_WARMUP_USER is not configured" in result
    mock_wd.assert_not_called()


def test_cache_warmup_user_not_found(app_context: None) -> None:
    """A configured-but-missing warmup user fails fast before any WebDriver."""
    from superset.tasks.cache import cache_warmup

    with (
        mock.patch(
            "superset.tasks.cache.current_app",
            _fake_app({"SUPERSET_CACHE_WARMUP_USER": "bot"}),
        ),
        mock.patch("superset.tasks.cache.security_manager") as mock_sm,
        mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd,
    ):
        mock_sm.find_user = mock.MagicMock(return_value=None)
        result: dict[str, list[str]] | str = cache_warmup("dummy")

    assert isinstance(result, str)
    assert "not found" in result
    mock_sm.find_user.assert_called_once_with(username="bot")
    mock_wd.assert_not_called()


def test_cache_warmup_happy_path(app_context: None) -> None:
    """Each URL is screenshotted as the configured user and the driver is destroyed."""
    from superset.tasks.cache import cache_warmup

    urls: list[str] = ["http://localhost/dash/1", "http://localhost/dash/2"]
    user: mock.MagicMock = mock.MagicMock()

    with (
        mock.patch(
            "superset.tasks.cache.current_app",
            _fake_app({"SUPERSET_CACHE_WARMUP_USER": "bot"}),
        ),
        mock.patch("superset.tasks.cache.security_manager") as mock_sm,
        mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd,
        mock.patch("superset.tasks.cache.DummyStrategy.get_urls", return_value=urls),
    ):
        mock_sm.find_user = mock.MagicMock(return_value=user)
        driver: mock.MagicMock = mock_wd.return_value
        result: dict[str, list[str]] | str = cache_warmup("dummy")

    assert result == {"success": urls, "errors": []}
    mock_wd.assert_called_once_with("chrome", user=user)
    assert driver.get_screenshot.call_count == len(urls)
    driver.destroy.assert_called_once_with()


def test_cache_warmup_collects_errors_and_destroys(app_context: None) -> None:
    """A failing URL is recorded as an error and cleanup still runs in finally."""
    from superset.tasks.cache import cache_warmup

    urls: list[str] = ["http://localhost/dash/ok", "http://localhost/dash/boom"]
    user: mock.MagicMock = mock.MagicMock()

    def side_effect(url: str, _element: str) -> None:
        if url.endswith("boom"):
            raise Exception("screenshot failed")

    with (
        mock.patch(
            "superset.tasks.cache.current_app",
            _fake_app({"SUPERSET_CACHE_WARMUP_USER": "bot"}),
        ),
        mock.patch("superset.tasks.cache.security_manager") as mock_sm,
        mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd,
        mock.patch("superset.tasks.cache.DummyStrategy.get_urls", return_value=urls),
    ):
        mock_sm.find_user = mock.MagicMock(return_value=user)
        driver: mock.MagicMock = mock_wd.return_value
        driver.get_screenshot.side_effect = side_effect
        result: dict[str, list[str]] | str = cache_warmup("dummy")

    assert result == {
        "success": ["http://localhost/dash/ok"],
        "errors": ["http://localhost/dash/boom"],
    }
    driver.destroy.assert_called_once_with()


def test_native_filter_options_strategy_returns_tasks_for_eligible_filters() -> None:
    """Eligible native filters are converted into cache warm-up tasks."""
    from superset.tasks.cache import NativeFilterOptionsStrategy

    dashboard: mock.MagicMock = mock.MagicMock()
    dashboard.id = 10
    filter_configs: list[dict[str, Any]] = [{"id": "filter-1"}, {"id": "filter-2"}]
    form_data: list[dict[str, Any]] = [
        {"groupby": ["country"]},
        {"groupby": ["state"]},
    ]
    query_contexts: list[mock.MagicMock] = [mock.MagicMock(), mock.MagicMock()]

    with (
        mock.patch(
            "superset.tasks.cache.DashboardDAO.find_by_id",
            return_value=dashboard,
        ),
        mock.patch(
            "superset.tasks.cache.get_eligible_native_filters",
            return_value=filter_configs,
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_form_data",
            side_effect=form_data,
        ) as mock_build_form_data,
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_query_context",
            side_effect=query_contexts,
        ) as mock_build_query_context,
    ):
        tasks: list[Any] = NativeFilterOptionsStrategy(dashboard_ids=[10]).get_tasks()

    assert len(tasks) == 2
    assert [task.query_context for task in tasks] == query_contexts
    assert [task.dashboard_id for task in tasks] == [10, 10]
    assert [task.native_filter_id for task in tasks] == ["filter-1", "filter-2"]
    assert mock_build_form_data.call_count == 2
    assert mock_build_query_context.call_count == 2


def test_native_filter_options_strategy_skips_missing_dashboard() -> None:
    """Missing dashboards are skipped without raising."""
    from superset.tasks.cache import NativeFilterOptionsStrategy

    with (
        mock.patch(
            "superset.tasks.cache.DashboardDAO.find_by_id",
            return_value=None,
        ),
        mock.patch("superset.tasks.cache.get_eligible_native_filters") as mock_filters,
    ):
        tasks: list[Any] = NativeFilterOptionsStrategy(dashboard_ids=[10]).get_tasks()

    assert tasks == []
    mock_filters.assert_not_called()


def test_native_filter_options_strategy_skips_when_form_data_is_none() -> None:
    """Filters without form data are skipped without raising."""
    from superset.tasks.cache import NativeFilterOptionsStrategy

    dashboard: mock.MagicMock = mock.MagicMock()
    dashboard.id = 10
    filter_configs: list[dict[str, Any]] = [{"id": "filter-1"}, {"id": "filter-2"}]
    query_context: mock.MagicMock = mock.MagicMock()

    with (
        mock.patch(
            "superset.tasks.cache.DashboardDAO.find_by_id",
            return_value=dashboard,
        ),
        mock.patch(
            "superset.tasks.cache.get_eligible_native_filters",
            return_value=filter_configs,
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_form_data",
            side_effect=[None, {"groupby": ["country"]}],
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_query_context",
            return_value=query_context,
        ) as mock_build_query_context,
    ):
        tasks: list[Any] = NativeFilterOptionsStrategy(dashboard_ids=[10]).get_tasks()

    assert len(tasks) == 1
    assert tasks[0].query_context == query_context
    mock_build_query_context.assert_called_once_with({"groupby": ["country"]})


def test_native_filter_options_strategy_skips_when_query_context_is_none() -> None:
    """Filters without a query context are skipped without raising."""
    from superset.tasks.cache import NativeFilterOptionsStrategy

    dashboard: mock.MagicMock = mock.MagicMock()
    dashboard.id = 10

    with (
        mock.patch(
            "superset.tasks.cache.DashboardDAO.find_by_id",
            return_value=dashboard,
        ),
        mock.patch(
            "superset.tasks.cache.get_eligible_native_filters",
            return_value=[{"id": "filter-1"}],
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_form_data",
            return_value={"groupby": ["country"]},
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_query_context",
            return_value=None,
        ),
    ):
        tasks: list[Any] = NativeFilterOptionsStrategy(dashboard_ids=[10]).get_tasks()

    assert tasks == []


def test_native_filter_options_strategy_uses_real_filter_helpers() -> None:
    """Eligible filter config is handled by real helper functions."""
    from superset.tasks.cache import NativeFilterOptionsStrategy
    from superset.utils import json

    dashboard: mock.MagicMock = mock.MagicMock()
    dashboard.id = 10
    dashboard.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                "bad-entry",
                {
                    "id": "filter-1",
                    "filterType": "filter_select",
                    "type": "NATIVE_FILTER",
                    "targets": [{"datasetId": 7, "column": {"name": "country"}}],
                    "adhoc_filters": [
                        {
                            "expressionType": "SIMPLE",
                            "subject": "region",
                            "operator": "==",
                            "comparator": "EMEA",
                        }
                    ],
                },
                {
                    "id": "range-filter",
                    "filterType": "filter_range",
                    "type": "NATIVE_FILTER",
                    "targets": [{"datasetId": 7, "column": {"name": "value"}}],
                },
            ]
        }
    )
    query_context: mock.MagicMock = mock.MagicMock()

    with (
        mock.patch(
            "superset.tasks.cache.DashboardDAO.find_by_id",
            return_value=dashboard,
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_query_context",
            return_value=query_context,
        ) as mock_build_query_context,
    ):
        tasks: list[Any] = NativeFilterOptionsStrategy(dashboard_ids=[10]).get_tasks()

    assert len(tasks) == 1
    assert tasks[0].dashboard_id == 10
    assert tasks[0].native_filter_id == "filter-1"
    assert tasks[0].query_context == query_context
    mock_build_query_context.assert_called_once()
    form_data: dict[str, Any] = mock_build_query_context.call_args.args[0]
    assert form_data["datasource"] == "7__table"
    assert form_data["groupby"] == ["country"]
    assert form_data["adhoc_filters"] == [
        {
            "expressionType": "SIMPLE",
            "subject": "region",
            "operator": "==",
            "comparator": "EMEA",
        }
    ]


def test_native_filter_options_strategy_skips_filter_helper_exceptions() -> None:
    """A failing filter config is skipped while remaining filters are processed."""
    from superset.tasks.cache import NativeFilterOptionsStrategy

    dashboard: mock.MagicMock = mock.MagicMock()
    dashboard.id = 10
    filter_configs: list[dict[str, Any]] = [{"missing_id": True}, {"id": "filter-2"}]
    query_context: mock.MagicMock = mock.MagicMock()

    with (
        mock.patch(
            "superset.tasks.cache.DashboardDAO.find_by_id",
            return_value=dashboard,
        ),
        mock.patch(
            "superset.tasks.cache.get_eligible_native_filters",
            return_value=filter_configs,
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_form_data",
            side_effect=[RuntimeError("boom"), {"groupby": ["country"]}],
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_query_context",
            return_value=query_context,
        ),
    ):
        tasks: list[Any] = NativeFilterOptionsStrategy(dashboard_ids=[10]).get_tasks()

    assert len(tasks) == 1
    assert tasks[0].native_filter_id == "filter-2"
    assert tasks[0].query_context == query_context


def test_native_filter_options_strategy_skips_dashboard_lookup_exceptions() -> None:
    """A dashboard-level failure is caught and does not stop other dashboard ids."""
    from superset.tasks.cache import NativeFilterOptionsStrategy

    dashboard: mock.MagicMock = mock.MagicMock()
    dashboard.id = 11
    query_context: mock.MagicMock = mock.MagicMock()

    with (
        mock.patch(
            "superset.tasks.cache.DashboardDAO.find_by_id",
            side_effect=[RuntimeError("boom"), dashboard],
        ),
        mock.patch(
            "superset.tasks.cache.get_eligible_native_filters",
            return_value=[{"id": "filter-1"}],
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_form_data",
            return_value={"groupby": ["country"]},
        ),
        mock.patch(
            "superset.tasks.cache.build_native_filter_option_query_context",
            return_value=query_context,
        ),
    ):
        tasks: list[Any] = NativeFilterOptionsStrategy(
            dashboard_ids=[10, 11]
        ).get_tasks()

    assert len(tasks) == 1
    assert tasks[0].dashboard_id == 11
    assert tasks[0].native_filter_id == "filter-1"


def test_native_filter_options_strategy_registered() -> None:
    """The native filter options strategy is registered by name."""
    from superset.tasks.cache import NativeFilterOptionsStrategy, strategy_registry

    assert strategy_registry["native_filter_options"] is NativeFilterOptionsStrategy
