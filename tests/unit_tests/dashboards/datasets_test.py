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

"""Dashboard datasource payload regression tests."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from flask import g

from superset.connectors.sqla.models import BaseDatasource, SqlaTable
from superset.dashboards.api import DashboardRestApi
from superset.dashboards.schemas import DashboardDatasetSchema
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.security.guest_token import GuestToken, GuestUser
from superset.semantic_layers.models import SemanticView

# Reuse the semantic model fixtures without shadowing imported fixture functions.
pytest_plugins: list[str] = ["tests.unit_tests.semantic_layers.models_test"]


@pytest.fixture(autouse=True)
def datasource_access() -> Iterator[None]:
    """Default metadata fixtures to an authorized principal."""
    with patch(
        "superset.models.dashboard.security_manager.can_access_all_datasources",
        return_value=True,
    ):
        yield


def test_inaccessible_semantic_dataset_never_discovers_provider(
    semantic_view: SemanticView,
) -> None:
    """Dashboard access alone must not instantiate a credentialed provider."""
    chart: Slice = Slice(
        datasource_id=semantic_view.id, datasource_type="semantic_view"
    )
    chart.semantic_view = semantic_view
    dashboard: Dashboard = Dashboard(slices=[chart])
    provider: MagicMock = MagicMock()
    implementation: PropertyMock
    with (
        patch(
            "superset.models.dashboard.security_manager.can_access_all_datasources",
            return_value=False,
        ),
        patch(
            "superset.models.dashboard.security_manager.can_access",
            return_value=False,
        ),
        patch(
            "superset.models.dashboard.security_manager.is_editor",
            return_value=False,
        ),
        patch.object(
            SemanticView,
            "implementation",
            new_callable=PropertyMock,
            return_value=provider,
        ) as implementation,
        patch(
            "superset.dashboards.schemas.security_manager.is_guest_user",
            return_value=False,
        ),
    ):
        datasets: list[tuple[BaseDatasource | SemanticView, dict[str, Any]]] = (
            dashboard.datasets_trimmed_for_slices()
        )
        assert len(datasets) == 1
        payload: dict[str, Any] = DashboardRestApi()._serialize_dashboard_dataset(
            *datasets[0]
        )
    implementation.assert_not_called()
    assert provider.mock_calls == []
    assert payload["uid"] == "1__semantic_view"
    assert payload["name"] == "Orders View"
    assert "columns" not in payload
    assert "metrics" not in payload
    assert "parent" not in payload
    assert "semantic_view_features" not in payload


def test_guest_token_semantic_payload_hides_provider_metadata() -> None:
    """A real guest principal gets the same connection redaction as tables."""
    token: GuestToken = {
        "iat": 0,
        "exp": 1,
        "user": {"username": "embedded-guest"},
        "resources": [],
        "rls_rules": [],
    }
    guest: GuestUser = GuestUser(token, roles=[])
    with (
        patch.object(g, "user", guest, create=True),
        patch("superset.is_feature_enabled", return_value=True),
    ):
        payload: dict[str, Any] = DashboardDatasetSchema().dump(
            {
                "id": 1,
                "uid": "1__semantic_view",
                "type": "semantic_view",
                "name": "Orders View",
                "database": {"name": "Warehouse"},
                "parent": {"name": "Secret layer name"},
                "semantic_view_features": ["provider-feature"],
            }
        )
    assert payload == {
        "id": 1,
        "uid": "1__semantic_view",
        "type": "semantic_view",
        "name": "Orders View",
    }


def test_dashboard_datasets_include_semantic_view(semantic_view: SemanticView) -> None:
    """Dashboard metadata includes a semantic chart's real datasource payload."""
    chart: Slice = Slice(
        datasource_id=semantic_view.id, datasource_type="semantic_view"
    )
    chart.semantic_view = semantic_view
    dashboard: Dashboard = Dashboard(slices=[chart])

    datasets: list[tuple[BaseDatasource | SemanticView, dict[str, Any]]] = (
        dashboard.datasets_trimmed_for_slices()
    )

    assert len(datasets) == 1
    assert datasets[0][0] is semantic_view
    assert datasets[0][1] == semantic_view.data_for_slices([chart])
    assert datasets[0][1]["uid"] == "semantic_view_uid_123"
    assert datasets[0][1]["columns"]
    assert datasets[0][1]["metrics"]


def test_dashboard_datasets_separate_same_id_datasource_types(
    semantic_view: SemanticView,
) -> None:
    """A table and semantic view sharing an id must retain separate payloads."""
    table: SqlaTable = SqlaTable(id=semantic_view.id, table_name="orders")
    table_chart: Slice = Slice(datasource_id=table.id, datasource_type="table")
    table_chart.table = table
    semantic_chart: Slice = Slice(
        datasource_id=semantic_view.id, datasource_type="semantic_view"
    )
    semantic_chart.semantic_view = semantic_view
    dashboard: Dashboard = Dashboard(slices=[table_chart, semantic_chart])
    table_payload: dict[str, Any] = {"id": table.id, "uid": "1__table", "type": "table"}

    trim: MagicMock
    with patch.object(SqlaTable, "data_for_slices", return_value=table_payload) as trim:
        datasets: list[tuple[BaseDatasource | SemanticView, dict[str, Any]]] = (
            dashboard.datasets_trimmed_for_slices()
        )

    assert len(datasets) == 2
    assert datasets[0] == (table, table_payload)
    trim.assert_called_once_with([table_chart])
    assert datasets[1] == (
        semantic_view,
        semantic_view.data_for_slices([semantic_chart]),
    )


@pytest.mark.parametrize("can_access", [True, False])
@pytest.mark.parametrize("is_guest", [True, False])
def test_dashboard_semantic_dataset_serialization_preserves_access_narrowing(
    semantic_view: SemanticView, can_access: bool, is_guest: bool
) -> None:
    """Semantic metadata follows the endpoint's normal member-access narrowing."""
    chart: Slice = Slice(
        datasource_id=semantic_view.id, datasource_type="semantic_view"
    )
    chart.semantic_view = semantic_view
    dashboard: Dashboard = Dashboard(slices=[chart])
    api: DashboardRestApi = DashboardRestApi()
    can_access_datasource: MagicMock
    with (
        patch(
            "superset.dashboards.api.security_manager.can_access_datasource",
            return_value=can_access,
        ) as can_access_datasource,
        patch(
            "superset.dashboards.schemas.security_manager.is_guest_user",
            return_value=is_guest,
        ),
    ):
        payload: dict[str, Any] = api._serialize_dashboard_dataset(
            *dashboard.datasets_trimmed_for_slices()[0]
        )

    can_access_datasource.assert_any_call(semantic_view)
    assert payload["id"] == semantic_view.id
    assert payload["uid"] == "1__semantic_view"
    assert payload["type"] == "semantic_view"
    assert payload["name"] == "Orders View"
    assert payload["supports_drill_to_detail"] is False
    assert payload["supports_samples"] is False
    if is_guest or not can_access:
        assert "parent" not in payload
        assert "semantic_view_features" not in payload
    else:
        assert payload["parent"] == {"name": "Test Layer"}
        assert payload["semantic_view_features"] == []
    if can_access:
        assert {column["column_name"] for column in payload["columns"]} == {
            "order_date",
            "category",
        }
        assert {metric["metric_name"] for metric in payload["metrics"]} == {
            "revenue",
            "order_count",
        }
    else:
        assert "columns" not in payload
        assert "metrics" not in payload
    if is_guest or not can_access:
        assert "perm" not in payload
        assert "database" not in payload


@pytest.mark.parametrize("error_type", [ValueError, RuntimeError, AttributeError])
def test_dashboard_datasets_isolate_semantic_provider_failure(
    semantic_view: SemanticView,
    error_type: type[Exception],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A failed provider must not hide a mixed dashboard's table metadata."""
    chart: Slice = Slice(
        datasource_id=semantic_view.id, datasource_type="semantic_view"
    )
    chart.semantic_view = semantic_view
    table: SqlaTable = SqlaTable(id=2, table_name="orders")
    table_chart: Slice = Slice(datasource_id=table.id, datasource_type="table")
    table_chart.table = table
    dashboard: Dashboard = Dashboard(slices=[chart, table_chart])
    table_payload: dict[str, Any] = {"id": 2, "uid": "2__table", "type": "table"}
    with (
        patch.object(
            SemanticView,
            "data_for_slices",
            side_effect=error_type("secret-provider-url"),
        ),
        patch.object(SqlaTable, "data_for_slices", return_value=table_payload),
    ):
        assert dashboard.datasets_trimmed_for_slices() == [(table, table_payload)]
    assert "semantic view" in caplog.text
    assert f"id={semantic_view.id}" in caplog.text
    assert str(semantic_view.semantic_layer_uuid) in caplog.text
    assert error_type.__name__ in caplog.text
    assert "secret-provider-url" not in caplog.text
    assert caplog.records[-1].levelname == "WARNING"
    assert caplog.records[-1].exc_info is None


def test_dashboard_table_serialization_includes_capabilities_and_parent() -> None:
    """Real table payloads expose their capabilities and database parent."""
    database: Database = Database(
        id=1, database_name="Warehouse", sqlalchemy_uri="sqlite://"
    )
    table: SqlaTable = SqlaTable(id=2, table_name="orders", database=database)
    chart: Slice = Slice(datasource_id=2, datasource_type="table", params="{}")
    payload: dict[str, Any] = table.data_for_slices([chart])
    api: DashboardRestApi = DashboardRestApi()
    with (
        patch(
            "superset.dashboards.api.security_manager.can_access_datasource",
            return_value=True,
        ),
        patch(
            "superset.dashboards.schemas.security_manager.is_guest_user",
            return_value=False,
        ),
    ):
        serialized: dict[str, Any] = api._serialize_dashboard_dataset(table, payload)
    assert set(serialized) == {
        "id",
        "uid",
        "column_formats",
        "database",
        "parent",
        "default_endpoint",
        "filter_select",
        "filter_select_enabled",
        "name",
        "datasource_name",
        "table_name",
        "type",
        "schema",
        "offset",
        "cache_timeout",
        "params",
        "perm",
        "edit_url",
        "sql",
        "columns",
        "metrics",
        "order_by_choices",
        "verbose_map",
        "select_star",
        "supports_samples",
        "supports_drill_to_detail",
        "granularity_sqla",
        "time_grain_sqla",
        "main_dttm_col",
        "currency_code_column",
        "fetch_values_predicate",
        "template_params",
        "is_sqllab_view",
        "health_check_message",
        "always_filter_main_dttm",
        "normalize_columns",
        "column_types",
        "column_names",
    }
    assert serialized["parent"] == {"name": "Warehouse"}
    assert serialized["database"]["name"] == "Warehouse"
    assert serialized["supports_samples"] is True
    assert serialized["supports_drill_to_detail"] is True


def test_dashboard_table_serialization_failure_is_not_suppressed() -> None:
    """Provider isolation must not swallow table errors."""
    table: SqlaTable = SqlaTable(id=2, table_name="orders")
    chart: Slice = Slice(datasource_id=2, datasource_type="table")
    chart.table = table
    dashboard: Dashboard = Dashboard(slices=[chart])
    with (
        patch.object(
            SqlaTable, "data_for_slices", side_effect=RuntimeError("table error")
        ),
        pytest.raises(RuntimeError, match="table error"),
    ):
        dashboard.datasets_trimmed_for_slices()
