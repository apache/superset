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

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Callable, NamedTuple
from unittest.mock import MagicMock, patch, PropertyMock

import pyarrow as pa
import pytest
from flask import g
from superset_core.semantic_layers.types import Dimension, Grains

from superset import security_manager
from superset.connectors.sqla.models import (
    BaseDatasource,
    SqlaTable,
    SqlMetric,
    TableColumn,
)
from superset.dashboards.api import (
    DASHBOARD_DATASET_INACCESSIBLE_FIELDS,
    DashboardRestApi,
)
from superset.dashboards.schemas import DashboardDatasetSchema
from superset.extensions import feature_flag_manager
from superset.models.core import Database
from superset.models.dashboard import Dashboard, saved_chart_display_labels
from superset.models.embedded_dashboard import EmbeddedDashboard
from superset.models.slice import Slice
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResourceType,
    GuestUser,
)
from superset.semantic_layers.models import SemanticView
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils import json

pytestmark: pytest.MarkDecorator = pytest.mark.usefixtures("semantic_layers_enabled")

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
        "editors",
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
        "partition_column",
        "partition_mapped_column",
        "partition_filter_mapping",
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


@pytest.mark.parametrize("can_access_ambiguous", [True, False])
def test_dashboard_datasets_isolate_ambiguous_view(
    client: Any,
    full_api_access: None,
    semantic_view: SemanticView,
    can_access_ambiguous: bool,
) -> None:
    """One ambiguous view cannot hide healthy metadata or leak it without access."""
    ambiguous: SemanticView = SemanticView(
        id=2,
        name="Ambiguous view",
        semantic_layer=semantic_view.semantic_layer,
    )
    implementation: MagicMock = MagicMock()
    implementation.get_dimensions.return_value = {
        Dimension("one", "event_time", pa.timestamp("us"), grain=Grains.MONTH),
        Dimension("two", "event_time", pa.timestamp("us"), grain=Grains.MONTH),
    }
    implementation.get_metrics.return_value = []
    implementation.features = frozenset()
    implementation.uid.return_value = "provider-ambiguous"
    # `implementation` is a plain (non-settable) property shared by every
    # `SemanticView` instance, so it can't be overridden per-instance via the
    # `__dict__` backdoor the way a `cached_property` could. Dispatch on
    # identity instead, falling back to whatever is currently installed
    # (the `semantic_view` fixture's own `PropertyMock`) for every other
    # instance -- `__get__` works whether that's a real `property` or a
    # `PropertyMock`, unlike `.fget`, which only a real `property` has.
    # Read the class `__dict__` directly, not `SemanticView.implementation`:
    # the latter *invokes* whatever descriptor is installed (a `PropertyMock`
    # calls itself even for class-level access, unlike a real `property`,
    # which special-cases `obj is None`), so it would capture the fixture's
    # mocked *return value* instead of the descriptor that produces it.
    original_implementation = SemanticView.__dict__["implementation"]
    broken_chart: Slice = Slice(datasource_id=2, datasource_type="semantic_view")
    broken_chart.semantic_view = ambiguous
    healthy_chart: Slice = Slice(
        datasource_id=semantic_view.id, datasource_type="semantic_view"
    )
    healthy_chart.semantic_view = semantic_view
    dashboard: Dashboard = Dashboard(id=17, slices=[broken_chart, healthy_chart])
    with (
        patch.object(
            SemanticView,
            "implementation",
            property(
                lambda self: (
                    implementation
                    if self is ambiguous
                    else original_implementation.__get__(self, SemanticView)
                )
            ),
        ),
        patch(
            "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug",
            return_value=dashboard,
        ),
        patch(
            "superset.models.dashboard.security_manager.can_access_datasource",
            side_effect=lambda datasource: (
                datasource is semantic_view or can_access_ambiguous
            ),
        ),
        patch(
            "superset.dashboards.schemas.security_manager.is_guest_user",
            return_value=False,
        ),
    ):
        response: Any = client.get("/api/v1/dashboard/17/datasets")
    assert response.status_code == 200
    datasets: dict[str, dict[str, Any]] = {
        item["uid"]: item for item in response.json["result"]
    }
    assert set(datasets) == {"1__semantic_view", "2__semantic_view"}
    assert datasets["1__semantic_view"]["columns"]
    assert "metadata_error" not in datasets["1__semantic_view"]
    assert "columns" not in datasets["2__semantic_view"]
    if can_access_ambiguous:
        assert datasets["2__semantic_view"]["metadata_error"] == (
            "Semantic dimension 'event_time' has ambiguous variants for grain 'P1M'. "
            "Use one dimension per name and grain."
        )
    else:
        assert "metadata_error" not in datasets["2__semantic_view"]
        implementation.get_dimensions.assert_not_called()


@pytest.mark.parametrize("can_access", [True, False])
def test_an_inaccessible_dashboard_dataset_hides_its_partition_mapping(
    can_access: bool,
) -> None:
    """
    The mapping names two of the dataset's columns and carries the raw value
    transform in `evaluated_transform`, so it belongs with `columns` and
    `main_dttm_col` in `DASHBOARD_DATASET_INACCESSIBLE_FIELDS`. Without it,
    `GET /api/v1/dashboard/<id>/datasets` handed all three to a Gamma user with
    dashboard access and no grant on the dataset.
    """
    table: SqlaTable = SqlaTable(id=7, table_name="orders")
    chart: Slice = Slice(datasource_id=7, datasource_type="table")
    chart.table = table
    dashboard: Dashboard = Dashboard(slices=[chart])
    payload = {
        "id": 7,
        "uid": "7__table",
        "table_name": "orders",
        "partition_column": "dt_epoch",
        "partition_mapped_column": "event_time",
        "partition_filter_mapping": {
            "partition_column": "dt_epoch",
            "mapped_column": "event_time",
            "evaluated_transform": "unix_timestamp(:value)",
        },
    }
    with (
        patch.object(SqlaTable, "data_for_slices", return_value=payload),
        patch(
            "superset.dashboards.api.security_manager.can_access_datasource",
            return_value=can_access,
        ),
        patch(
            "superset.dashboards.schemas.security_manager.is_guest_user",
            return_value=False,
        ),
    ):
        serialized: dict[str, Any] = DashboardRestApi()._serialize_dashboard_dataset(
            *dashboard.datasets_trimmed_for_slices()[0]
        )

    fields = ("partition_column", "partition_mapped_column", "partition_filter_mapping")
    if can_access:
        assert all(field in serialized for field in fields)
        assert (
            serialized["partition_filter_mapping"]["evaluated_transform"]
            == "unix_timestamp(:value)"
        )
    else:
        assert not any(field in serialized for field in fields)


def test_a_guest_token_dashboard_dataset_hides_its_partition_mapping() -> None:
    """
    Same reasoning as the inaccessible case, through the guest narrowing:
    `evaluated_transform` is a SQL expression, which is what puts `sql` in that
    list. Neither the dataset editor nor Explore's pruning indicator is a guest
    surface, so nothing is lost.
    """
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
        # `is_guest_user` is gated on EMBEDDED_SUPERSET, as the sibling guest
        # test above does it.
        patch("superset.is_feature_enabled", return_value=True),
    ):
        payload: dict[str, Any] = DashboardDatasetSchema().dump(
            {
                "id": 7,
                "uid": "7__table",
                "partition_column": "dt_epoch",
                "partition_mapped_column": "event_time",
                "partition_filter_mapping": {"evaluated_transform": "lower(:value)"},
            }
        )

    assert "partition_column" not in payload
    assert "partition_mapped_column" not in payload
    assert "partition_filter_mapping" not in payload


def test_a_dataset_without_a_mapping_serializes_its_null_partition_fields() -> None:
    """
    `SqlaTable.data` includes all three unconditionally, and the first two are
    `None` on any dataset without a mapping. Declared non-nullable, the
    generated spec rejected that ordinary response under strict client
    validation.
    """
    payload: dict[str, Any] = DashboardDatasetSchema().dump(
        {
            "id": 7,
            "uid": "7__table",
            "partition_column": None,
            "partition_mapped_column": None,
            "partition_filter_mapping": None,
        }
    )

    assert payload["partition_column"] is None
    assert payload["partition_mapped_column"] is None
    assert payload["partition_filter_mapping"] is None


# ---------------------------------------------------------------------------
# Authorized chart display labels (``chart_display_labels``)
# ---------------------------------------------------------------------------

DASHBOARD_UUID: str = "4a4b1d5c-0ae8-4c4f-9e8d-2b8f3a0c1d11"
OTHER_DASHBOARD_UUID: str = "9f0c6c55-7d43-4b45-a3f0-6f3d1c2b7e22"
SENSITIVE_LABELS: tuple[str, ...] = ("Metro area", "Margin", "Cost center")
GUEST_REDACTED_FIELDS: tuple[str, ...] = (
    "database",
    "parent",
    "semantic_view_features",
    "editors",
    "sql",
    "select_star",
    "perm",
    "edit_url",
    "fetch_values_predicate",
    "template_params",
)


def _labelled_table(table_id: int = 7) -> SqlaTable:
    """A dataset with labelled, unlabelled and unused columns and metrics."""
    return SqlaTable(
        id=table_id,
        table_name=f"sales_{table_id}",
        database=Database(id=1, database_name="Warehouse", sqlalchemy_uri="sqlite://"),
        columns=[
            TableColumn(column_name="region", verbose_name="Region", type="TEXT"),
            TableColumn(column_name="metro", verbose_name="Metro area", type="TEXT"),
            TableColumn(column_name="venue", verbose_name=None, type="TEXT"),
            TableColumn(
                column_name="cost_center", verbose_name="Cost center", type="TEXT"
            ),
        ],
        metrics=[
            SqlMetric(
                metric_name="revenue", expression="SUM(amount)", verbose_name="Revenue"
            ),
            SqlMetric(
                metric_name="venues",
                expression="COUNT(DISTINCT venue)",
                verbose_name="   ",
            ),
            SqlMetric(
                metric_name="margin", expression="SUM(margin)", verbose_name="Margin"
            ),
        ],
    )


def _chart(chart_id: int, table: SqlaTable, **params: Any) -> Slice:
    """A saved member chart on ``table``."""
    chart: Slice = Slice(
        id=chart_id,
        slice_name=f"Chart {chart_id}",
        datasource_id=table.id,
        datasource_type="table",
        viz_type="ag-grid-pivot-table",
        params=json.dumps(params),
    )
    chart.table = table
    return chart


def _viewer(subject_id: int) -> Subject:
    """An explicit chart viewer subject."""
    return Subject(id=subject_id, label=f"Viewer {subject_id}", type=SubjectType.USER)


def _embedded_dashboard(dashboard_id: int, slices: list[Slice]) -> Dashboard:
    """A dashboard embedded under ``DASHBOARD_UUID``."""
    return Dashboard(
        id=dashboard_id,
        slices=slices,
        embedded=[EmbeddedDashboard(uuid=uuid.UUID(DASHBOARD_UUID))],
    )


def _guest(dashboard_ref: str, datasets: list[int] | None = None) -> GuestUser:
    """A real guest principal whose token grants one dashboard."""
    token: GuestToken = {
        "iat": 0,
        "exp": 9999999999,
        "user": {"username": "embedded-guest"},
        "resources": [{"type": GuestTokenResourceType.DASHBOARD, "id": dashboard_ref}],
        "rls_rules": [],
    }
    if datasets is not None:
        token["datasets"] = datasets
    return GuestUser(token, roles=[])


@contextmanager
def _as_guest(guest: GuestUser) -> Iterator[None]:
    """Act as an embedded guest holding no standalone datasource grant.

    Chart and dashboard access run through the real security manager; only the
    datasource grant the token never carries is pinned to its real outcome.
    """
    previous: Callable[[str, bool], bool] | None = (
        feature_flag_manager._is_feature_enabled_func
    )

    def resolve(name: str, default: bool) -> bool:
        if name == "EMBEDDED_SUPERSET":
            return True
        return previous(name, default) if previous else default

    with (
        patch.object(feature_flag_manager, "_is_feature_enabled_func", resolve),
        patch.object(g, "user", guest, create=True),
        patch(
            "superset.models.dashboard.security_manager.get_guest_user_from_request",
            return_value=guest,
        ),
        patch(
            "superset.models.dashboard.security_manager.can_access_datasource",
            return_value=False,
        ),
    ):
        yield


@contextmanager
def _as_regular_user(
    *,
    admin: bool = False,
    can_access_datasource: bool = True,
    viewer_of: Callable[[Any], bool] = lambda resource: False,
) -> Iterator[None]:
    """Act as a non-guest principal with the given grants."""
    with (
        patch(
            "superset.models.dashboard.security_manager.is_guest_user",
            return_value=False,
        ),
        patch(
            "superset.models.dashboard.security_manager.is_admin", return_value=admin
        ),
        patch(
            "superset.models.dashboard.security_manager.is_editor",
            return_value=admin,
        ),
        patch(
            "superset.models.dashboard.security_manager.is_viewer",
            side_effect=lambda resource: admin or viewer_of(resource),
        ),
        patch(
            "superset.models.dashboard.security_manager.can_access_datasource",
            return_value=can_access_datasource,
        ),
    ):
        yield


class _DatasetsCall(NamedTuple):
    response: Any
    prefetch: MagicMock
    label_checks: MagicMock


def _get_datasets(client: Any, dashboard: Dashboard) -> _DatasetsCall:
    """Request the datasets endpoint by UUID, which loads the dashboard and then
    runs the real dashboard access check before any payload is built.

    Records the chart-access prefetch and every real per-chart label access check.
    """
    with (
        patch.object(Dashboard, "get", return_value=dashboard),
        patch("superset.daos.dashboard.DashboardDAO.prefetch_chart_access") as prefetch,
        patch(
            "superset.models.dashboard.security_manager.can_access_dashboard_chart_labels",
            wraps=security_manager.can_access_dashboard_chart_labels,
        ) as label_checks,
    ):
        response: Any = client.get(f"/api/v1/dashboard/{DASHBOARD_UUID}/datasets")
    return _DatasetsCall(response, prefetch, label_checks)


def _checked_chart_ids(call: _DatasetsCall) -> set[int]:
    return {args.args[1].id for args in call.label_checks.call_args_list}


def _assert_string_labels(labels: dict[str, Any]) -> None:
    for chart_id, chart_labels in labels.items():
        assert isinstance(chart_id, str)
        assert chart_labels
        for raw_id, label in chart_labels.items():
            assert isinstance(raw_id, str)
            assert isinstance(label, str)


def test_saved_chart_display_labels_allowlist_saved_fields() -> None:
    """Only saved dimensions/metrics with configured labels are emitted."""
    table: SqlaTable = _labelled_table()
    chart: Slice = _chart(
        11,
        table,
        groupby=[
            "region",
            "venue",
            {
                "label": "Region bucket",
                "sqlExpression": "UPPER(cost_center)",
                "expressionType": "SQL",
                "hasCustomLabel": True,
            },
            {
                "label": "LOWER(metro)",
                "sqlExpression": "LOWER(metro)",
                "expressionType": "SQL",
            },
        ],
        metrics=[
            "revenue",
            "venues",
            "not_a_saved_metric",
            {
                "expressionType": "SIMPLE",
                "aggregate": "MAX",
                "column": {"column_name": "metro", "verbose_name": "Metro area"},
                "label": "MAX(metro)",
                "hasCustomLabel": False,
            },
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(margin) / COUNT(*)",
                "label": "Average margin",
                "hasCustomLabel": True,
            },
        ],
        adhoc_filters=[
            {
                "clause": "WHERE",
                "subject": "cost_center",
                "operator": "==",
                "comparator": "Sales",
                "expressionType": "SIMPLE",
            }
        ],
        # Saved pivot axes outside the configured dimensions are not labels.
        pivot_table_state={
            "rowGroup": {"groupColIds": ["region", "cost_center"]},
            "pivot": {"pivotMode": True, "pivotColIds": ["metro"]},
        },
        # Comparison headers derive from the base metric label client-side.
        time_compare=["1 year ago"],
        comparison_type="percentage",
        order_by_cols=["metro"],
        timeseries_limit_metric="margin",
    )

    labels: dict[str, str] = saved_chart_display_labels(table, chart)

    assert labels == {
        "region": "Region",
        "Region bucket": "Region bucket",
        "revenue": "Revenue",
        "Average margin": "Average margin",
    }
    _assert_string_labels({"11": labels})


@pytest.mark.parametrize(
    "params, expected",
    [
        (None, {}),
        ("", {}),
        ("not json", {}),
        ("null", {}),
        ('"region"', {}),
        ('["region"]', {}),
        (
            '{"groupby": "region", "metrics": "revenue"}',
            {},
        ),
        ('{"groupby": {"region": 1}, "metrics": 5}', {}),
        (
            '{"groupby": [null, 3, ["region"], {"label": 5, "hasCustomLabel": true},'
            ' {"label": "", "hasCustomLabel": true}],'
            ' "metrics": [{"label": "x", "hasCustomLabel": "true"},'
            ' {"label": "  ", "hasCustomLabel": true}, {"metric_name": "revenue"}]}',
            {},
        ),
    ],
)
def test_saved_chart_display_labels_tolerate_malformed_params(
    params: str | None, expected: dict[str, str]
) -> None:
    """Malformed saved params never raise and never invent labels."""
    table: SqlaTable = _labelled_table()
    chart: Slice = _chart(11, table)
    chart.params = params

    assert saved_chart_display_labels(table, chart) == expected


def test_saved_chart_display_labels_require_string_verbose_names() -> None:
    """Non-string stored labels fall back to the raw name."""
    table: SqlaTable = _labelled_table()
    table.columns[0].verbose_name = 5
    table.metrics[0].verbose_name = ["Revenue"]
    chart: Slice = _chart(11, table, groupby=["region"], metrics=["revenue"])

    assert saved_chart_display_labels(table, chart) == {}


@pytest.mark.parametrize("admin", [True, False])
def test_dashboard_datasets_full_access_keeps_verbose_map_without_label_work(
    client: Any, full_api_access: None, admin: bool
) -> None:
    """Datasource-authorized callers use existing labels without extra work."""
    table: SqlaTable = _labelled_table()
    chart: Slice = _chart(
        11, table, groupby=["region", "metro", "venue"], metrics=["revenue"]
    )
    dashboard: Dashboard = Dashboard(
        id=17, slices=[chart], published=True, viewers=[_viewer(1)]
    )

    with (
        _as_regular_user(admin=admin, viewer_of=lambda resource: resource is dashboard),
        patch("superset.models.dashboard._dataset_display_labels") as index_labels,
        patch("superset.models.dashboard.saved_chart_display_labels") as chart_labels,
    ):
        call: _DatasetsCall = _get_datasets(client, dashboard)

    response: Any = call.response
    assert response.status_code == 200
    call.prefetch.assert_not_called()
    call.label_checks.assert_not_called()
    index_labels.assert_not_called()
    chart_labels.assert_not_called()
    [dataset] = response.json["result"]
    assert dataset["verbose_map"]["metro"] == "Metro area"
    assert dataset["columns"]
    assert "chart_display_labels" not in dataset


def test_dashboard_datasets_dashboard_only_principal_gets_authorized_labels(
    client: Any, full_api_access: None
) -> None:
    """Labels follow per-chart access, not dataset access or other dashboards.

    Two member charts share one dataset; the second names another viewer (an
    explicit chart ACL denial). A third chart on the same dataset that the
    caller can view belongs to a different dashboard.
    """
    table: SqlaTable = _labelled_table()
    allowed: Slice = _chart(11, table, groupby=["region"], metrics=["revenue"])
    allowed.viewers = [_viewer(1)]
    denied: Slice = _chart(12, table, groupby=["metro"], metrics=["margin"])
    denied.viewers = [_viewer(2)]
    outside: Slice = _chart(13, table, groupby=["cost_center"], metrics=["margin"])
    outside.viewers = [_viewer(1)]
    Dashboard(id=18, slices=[outside])
    dashboard: Dashboard = Dashboard(
        id=17, slices=[allowed, denied], published=True, viewers=[_viewer(1)]
    )

    with _as_regular_user(
        can_access_datasource=False,
        viewer_of=lambda resource: resource in (dashboard, allowed, outside),
    ):
        assert security_manager.can_access_chart(outside)
        assert not security_manager.can_access_chart(denied)
        call: _DatasetsCall = _get_datasets(client, dashboard)

    response: Any = call.response
    assert response.status_code == 200
    # One lazy prefetch, then the real check for each labelled member chart.
    call.prefetch.assert_called_once_with(dashboard)
    assert _checked_chart_ids(call) == {11, 12}
    [dataset] = response.json["result"]
    assert dataset["chart_display_labels"] == {
        "11": {"region": "Region", "revenue": "Revenue"}
    }
    for key in DASHBOARD_DATASET_INACCESSIBLE_FIELDS:
        assert key not in dataset
    body: str = response.get_data(as_text=True)
    for label in SENSITIVE_LABELS:
        assert label not in body
    for raw_id in ('"metro"', '"margin"', '"cost_center"', '"12"', '"13"'):
        assert raw_id not in body


@pytest.mark.parametrize("full_access_first", [True, False])
def test_dashboard_datasets_skip_label_work_only_for_accessible_datasource(
    client: Any, full_api_access: None, full_access_first: bool
) -> None:
    """A datasource grant does not suppress labels for other member datasets."""
    accessible_table = _labelled_table(7)
    restricted_table = _labelled_table(8)
    full_access_chart = _chart(11, accessible_table, groupby=["region"])
    restricted_chart = _chart(21, restricted_table, groupby=["metro"])
    restricted_chart.viewers = [_viewer(1)]
    charts = [full_access_chart, restricted_chart]
    dashboard = Dashboard(
        id=17,
        slices=charts if full_access_first else list(reversed(charts)),
        published=True,
        viewers=[_viewer(1)],
    )

    with (
        _as_regular_user(
            viewer_of=lambda resource: resource in (dashboard, restricted_chart),
        ),
        patch(
            "superset.models.dashboard.security_manager.can_access_datasource",
            side_effect=lambda datasource: datasource is accessible_table,
        ) as datasource_checks,
    ):
        call = _get_datasets(client, dashboard)

    assert call.response.status_code == 200
    call.prefetch.assert_called_once_with(dashboard)
    assert _checked_chart_ids(call) == {21}
    assert datasource_checks.call_count == 2
    datasource_checks.assert_any_call(accessible_table)
    datasource_checks.assert_any_call(restricted_table)
    datasets = {item["id"]: item for item in call.response.json["result"]}
    assert datasets[7]["verbose_map"]["region"] == "Region"
    assert "chart_display_labels" not in datasets[7]
    assert "verbose_map" not in datasets[8]
    assert datasets[8]["chart_display_labels"] == {"21": {"metro": "Metro area"}}


def test_dashboard_datasets_datasource_access_cache_is_request_local(
    client: Any, full_api_access: None
) -> None:
    """A prior request's datasource grant cannot affect a later caller's labels."""
    table = _labelled_table()
    chart = _chart(11, table, groupby=["region"])
    dashboard = Dashboard(id=17, slices=[chart])

    with _as_regular_user(admin=True):
        full_access = _get_datasets(client, dashboard)
    with _as_regular_user(admin=True, can_access_datasource=False):
        restricted = _get_datasets(client, dashboard)

    assert full_access.response.status_code == restricted.response.status_code == 200
    [full_dataset] = full_access.response.json["result"]
    [restricted_dataset] = restricted.response.json["result"]
    assert full_dataset["verbose_map"]["region"] == "Region"
    assert "chart_display_labels" not in full_dataset
    assert "verbose_map" not in restricted_dataset
    assert restricted_dataset["chart_display_labels"] == {"11": {"region": "Region"}}


def test_dashboard_datasets_omit_labels_when_none_configured(
    client: Any, full_api_access: None
) -> None:
    """No configured labels, or no accessible chart, means no field at all."""
    table: SqlaTable = _labelled_table()
    unlabelled: Slice = _chart(11, table, groupby=["venue"], metrics=["venues"])
    denied: Slice = _chart(12, table, groupby=["region"], metrics=["revenue"])
    denied.viewers = [_viewer(2)]
    dashboard: Dashboard = Dashboard(
        id=17, slices=[unlabelled, denied], published=True, viewers=[_viewer(1)]
    )

    with _as_regular_user(
        can_access_datasource=False,
        viewer_of=lambda resource: resource in (dashboard, unlabelled),
    ):
        call: _DatasetsCall = _get_datasets(client, dashboard)

    response: Any = call.response
    assert response.status_code == 200
    assert _checked_chart_ids(call) == {12}
    [dataset] = response.json["result"]
    assert "chart_display_labels" not in dataset
    assert "verbose_map" not in dataset


@pytest.mark.parametrize("principal", ["admin", "dashboard_viewer", "guest"])
def test_dashboard_datasets_without_labels_skip_access_work(
    client: Any, full_api_access: None, principal: str
) -> None:
    """Dashboards without configured labels pay for no access checks."""
    table: SqlaTable = _labelled_table()
    chart: Slice = _chart(11, table, groupby=["venue"], metrics=["venues"])
    chart.viewers = [_viewer(1)]
    dashboard: Dashboard = _embedded_dashboard(17, [chart])
    dashboard.published = True
    dashboard.viewers = [_viewer(1)]

    with (
        _as_guest(_guest(DASHBOARD_UUID))
        if principal == "guest"
        else _as_regular_user(
            admin=principal == "admin",
            can_access_datasource=False,
            viewer_of=lambda resource: resource in (dashboard, chart),
        )
    ):
        call: _DatasetsCall = _get_datasets(client, dashboard)

    assert call.response.status_code == 200
    [dataset] = call.response.json["result"]
    assert "chart_display_labels" not in dataset
    call.prefetch.assert_not_called()
    call.label_checks.assert_not_called()


@pytest.mark.parametrize(
    "allowlist, expected",
    [
        (
            None,
            {
                "sales_7": {"11": {"region": "Region", "revenue": "Revenue"}},
                "sales_8": {"21": {"metro": "Metro area", "revenue": "Revenue"}},
            },
        ),
        ([7], {"sales_7": {"11": {"region": "Region", "revenue": "Revenue"}}}),
        ([], {}),
        (["7"], {}),
    ],
)
def test_dashboard_datasets_guest_labels_follow_token(
    client: Any,
    full_api_access: None,
    allowlist: list[Any] | None,
    expected: dict[str, dict[str, dict[str, str]]],
) -> None:
    """A real guest gets labels for granted charts only, with all redaction."""
    table: SqlaTable = _labelled_table(7)
    excluded_table: SqlaTable = _labelled_table(8)
    allowed: Slice = _chart(11, table, groupby=["region"], metrics=["revenue"])
    excluded: Slice = _chart(21, excluded_table, groupby=["metro"], metrics=["revenue"])
    dashboard: Dashboard = _embedded_dashboard(17, [allowed, excluded])

    with _as_guest(_guest(DASHBOARD_UUID, allowlist)):
        call: _DatasetsCall = _get_datasets(client, dashboard)
        # The guest path decides without the per-chart check, and decides
        # exactly as that check would for these member charts.
        chart_access: set[str] = {
            str(chart.id)
            for chart in (allowed, excluded)
            if security_manager.can_access_chart(chart)
        }

    response: Any = call.response
    assert response.status_code == 200
    call.prefetch.assert_not_called()
    assert _checked_chart_ids(call) == {11, 21}
    assert chart_access == {
        chart_id for labels in expected.values() for chart_id in labels
    }
    datasets: dict[str, dict[str, Any]] = {
        item["table_name"]: item for item in response.json["result"]
    }
    assert set(datasets) == {"sales_7", "sales_8"}
    for name, dataset in datasets.items():
        assert dataset.get("chart_display_labels") == expected.get(name)
        for key in (*DASHBOARD_DATASET_INACCESSIBLE_FIELDS, *GUEST_REDACTED_FIELDS):
            assert key not in dataset
    if "sales_8" not in expected:
        assert "Metro area" not in response.get_data(as_text=True)


def test_dashboard_datasets_guest_allowlist_applies_to_chart_viewer_grants(
    client: Any, full_api_access: None
) -> None:
    """An explicit chart viewer grant admits the chart, not excluded metadata."""
    table: SqlaTable = _labelled_table(7)
    viewed: Slice = _chart(11, table, groupby=["region"], metrics=["revenue"])
    viewed.viewers = [_viewer(1)]
    dashboard: Dashboard = _embedded_dashboard(17, [viewed])

    with (
        _as_guest(_guest(DASHBOARD_UUID, [8])),
        patch(
            "superset.models.dashboard.security_manager.is_viewer",
            side_effect=lambda resource: resource is viewed,
        ),
    ):
        assert security_manager.can_access_chart(viewed)
        call: _DatasetsCall = _get_datasets(client, dashboard)

    response: Any = call.response
    assert response.status_code == 200
    assert _checked_chart_ids(call) == {11}
    [dataset] = response.json["result"]
    assert "chart_display_labels" not in dataset
    assert "Region" not in response.get_data(as_text=True)


def test_dashboard_datasets_guest_token_for_other_dashboard_is_denied(
    client: Any, full_api_access: None
) -> None:
    """A token for another dashboard gets no payload, nor labels via the model."""
    table: SqlaTable = _labelled_table()
    shared: Slice = _chart(11, table, groupby=["region"], metrics=["revenue"])
    dashboard: Dashboard = _embedded_dashboard(17, [shared])
    Dashboard(
        id=18,
        slices=[shared],
        embedded=[EmbeddedDashboard(uuid=uuid.UUID(OTHER_DASHBOARD_UUID))],
    )

    with _as_guest(_guest(OTHER_DASHBOARD_UUID)):
        response: Any = _get_datasets(client, dashboard).response
        # The shared chart is reachable through the token's own dashboard, so
        # only the requested dashboard's grant keeps its labels out.
        assert security_manager.can_access_chart(shared)
        datasets: list[tuple[BaseDatasource | SemanticView, dict[str, Any]]] = (
            dashboard.datasets_trimmed_for_slices()
        )

    assert response.status_code == 403
    assert "Region" not in response.get_data(as_text=True)
    assert len(datasets) == 1
    assert "chart_display_labels" not in datasets[0][1]


@pytest.mark.parametrize("semantic_access", [True, False])
def test_chart_display_labels_are_sqla_only_with_colliding_ids(
    semantic_view: SemanticView, semantic_access: bool
) -> None:
    """A same-id semantic view never gets labels nor, if denied, a provider."""
    table: SqlaTable = _labelled_table(semantic_view.id)
    table_chart: Slice = _chart(11, table, groupby=["region"], metrics=["revenue"])
    semantic_chart: Slice = Slice(
        id=12,
        datasource_id=semantic_view.id,
        datasource_type="semantic_view",
        params=json.dumps({"groupby": ["category"], "metrics": ["revenue"]}),
    )
    semantic_chart.semantic_view = semantic_view
    dashboard: Dashboard = Dashboard(slices=[table_chart, semantic_chart])
    provider: MagicMock = MagicMock()
    implementation: PropertyMock
    with (
        _as_regular_user(admin=True),
        patch(
            "superset.models.dashboard.security_manager.can_access_datasource",
            side_effect=lambda datasource: datasource is not table and semantic_access,
        ),
        patch.object(
            SemanticView,
            "implementation",
            new_callable=PropertyMock,
            return_value=provider,
        ) as implementation,
        patch.object(
            SemanticView,
            "data_for_slices",
            return_value={"id": semantic_view.id, "type": "semantic_view"},
        ),
    ):
        datasets: list[tuple[BaseDatasource | SemanticView, dict[str, Any]]] = (
            dashboard.datasets_trimmed_for_slices()
        )

    payloads: dict[tuple[str, int], dict[str, Any]] = {
        (datasource.type, datasource.id): payload for datasource, payload in datasets
    }
    assert payloads[("table", semantic_view.id)]["chart_display_labels"] == {
        "11": {"region": "Region", "revenue": "Revenue"}
    }
    assert "chart_display_labels" not in payloads[("semantic_view", semantic_view.id)]
    if not semantic_access:
        implementation.assert_not_called()
        assert provider.mock_calls == []


@pytest.mark.parametrize("is_guest", [True, False])
def test_chart_display_labels_survive_narrowing_that_strips_metadata(
    is_guest: bool,
) -> None:
    """The string-only label map is whitelisted; dataset metadata is not."""
    table: SqlaTable = _labelled_table()
    labels: dict[str, dict[str, str]] = {"11": {"region": "Region"}}
    payload: dict[str, Any] = {
        "id": table.id,
        "uid": f"{table.id}__table",
        "type": "table",
        "table_name": table.table_name,
        "metadata_error": "error",
        "sql": "SELECT secret FROM t",
        "select_star": "SELECT *",
        "fetch_values_predicate": "1 = 1",
        "template_params": "{}",
        "params": "{}",
        "perm": "[Warehouse].[t]",
        "edit_url": "/edit",
        "database": {"id": 1, "name": "Warehouse"},
        "parent": {"name": "Warehouse"},
        "semantic_view_features": ["feature"],
        "columns": [{"column_name": "metro"}],
        "column_names": ["metro"],
        "column_types": [1],
        "metrics": [{"metric_name": "margin"}],
        "verbose_map": {"metro": "Metro area"},
        "order_by_choices": [["metro", "metro"]],
        "main_dttm_col": "ds",
        "granularity_sqla": [["ds", "ds"]],
        "time_grain_sqla": [["P1D", "Day"]],
        "editors": [],
        "chart_display_labels": labels,
    }
    with (
        patch(
            "superset.dashboards.api.security_manager.can_access_datasource",
            return_value=False,
        ),
        patch(
            "superset.dashboards.schemas.security_manager.is_guest_user",
            return_value=is_guest,
        ),
    ):
        serialized: dict[str, Any] = DashboardRestApi()._serialize_dashboard_dataset(
            table, payload
        )

    assert serialized["chart_display_labels"] == labels
    for key in DASHBOARD_DATASET_INACCESSIBLE_FIELDS:
        assert key not in serialized
    if is_guest:
        for key in GUEST_REDACTED_FIELDS:
            assert key not in serialized
    assert "Metro area" not in json.dumps(serialized)


def test_inaccessible_fields_keep_every_entry_and_exclude_labels() -> None:
    """Whitelisting labels must not shrink the dataset redaction list."""
    assert set(DASHBOARD_DATASET_INACCESSIBLE_FIELDS) == {
        "metadata_error",
        "sql",
        "select_star",
        "fetch_values_predicate",
        "template_params",
        "params",
        "perm",
        "edit_url",
        "database",
        "parent",
        "semantic_view_features",
        "columns",
        "column_names",
        "column_types",
        "metrics",
        "verbose_map",
        "order_by_choices",
        "main_dttm_col",
        "granularity_sqla",
        "time_grain_sqla",
        # The partition mapping names two of the dataset's columns and carries
        # the raw value transform, so it is redacted with `columns`.
        "partition_column",
        "partition_mapped_column",
        "partition_filter_mapping",
    }
    assert "chart_display_labels" not in DASHBOARD_DATASET_INACCESSIBLE_FIELDS


@pytest.mark.parametrize(
    "viz_type, params, expected",
    [
        ("table", {"all_columns": ["region"]}, {"region": "Region"}),
        (
            "table",
            {
                "groupby": ["region"],
                "metrics": ["revenue"],
                "percent_metrics": ["margin"],
            },
            {"region": "Region", "revenue": "Revenue", "margin": "Margin"},
        ),
        (
            "pivot_table_v2",
            {
                "groupbyRows": ["region"],
                "groupbyColumns": ["metro"],
                "metrics": ["revenue"],
            },
            {"region": "Region", "metro": "Metro area", "revenue": "Revenue"},
        ),
        (
            "echarts_timeseries_line",
            {"x_axis": "region", "groupby": ["metro"], "metrics": ["revenue"]},
            {"region": "Region", "metro": "Metro area", "revenue": "Revenue"},
        ),
        (
            "mixed_timeseries",
            {"metrics_b": ["revenue"], "groupby_b": ["region"]},
            {"region": "Region", "revenue": "Revenue"},
        ),
        ("big_number", {"metric": "revenue"}, {"revenue": "Revenue"}),
        (
            "pie",
            {"groupby": ["region"], "metric": "revenue"},
            {"region": "Region", "revenue": "Revenue"},
        ),
        (
            "bubble",
            {
                "entity": "region",
                "series": "metro",
                "x": "revenue",
                "y": "margin",
                "size": "revenue",
            },
            {
                "region": "Region",
                "metro": "Metro area",
                "revenue": "Revenue",
                "margin": "Margin",
            },
        ),
        (
            "point-cluster-map",
            {"all_columns_x": "region", "all_columns_y": "metro"},
            {"region": "Region", "metro": "Metro area"},
        ),
        (
            "sankey",
            {"source": "region", "target": "metro"},
            {"region": "Region", "metro": "Metro area"},
        ),
        ("histogram", {"column": "region"}, {"region": "Region"}),
        (
            "candlestick",
            {
                "x_axis": "region",
                "series": ["metro"],
                "open": "revenue",
                "close": "margin",
                "high": "revenue",
                "low": "margin",
            },
            {
                "region": "Region",
                "metro": "Metro area",
                "revenue": "Revenue",
                "margin": "Margin",
            },
        ),
        (
            "tree_chart",
            {"id": "region", "parent": "metro", "name": "region"},
            {"region": "Region", "metro": "Metro area"},
        ),
        (
            "heatmap",
            {"all_columns_x": ["region", "metro"]},
            {"region": "Region", "metro": "Metro area"},
        ),
        (
            "echarts_timeseries_line",
            {"series_columns": ["region"], "tooltip_metrics": ["revenue"]},
            {"region": "Region", "revenue": "Revenue"},
        ),
    ],
)
@pytest.mark.parametrize("with_query_context", [False, True])
def test_chart_display_labels_cover_visualization_controls(
    viz_type: str,
    params: dict[str, Any],
    expected: dict[str, str],
    with_query_context: bool,
) -> None:
    """Displayed fields have full-access parity without filter or sort metadata."""
    table = _labelled_table()
    table.metrics.append(
        SqlMetric(
            metric_name="sorting_metric",
            expression="COUNT(*)",
            verbose_name="Sort label",
        )
    )
    chart = _chart(
        11,
        table,
        **params,
        adhoc_filters=[{"clause": "WHERE", "subject": "cost_center"}],
        filter_configs=[{"column": "cost_center"}],
        order_by_cols=["cost_center"],
        timeseries_limit_metric="sorting_metric",
        series_limit_metric="sorting_metric",
    )
    chart.viz_type = viz_type
    if with_query_context:
        chart.query_context = json.dumps(
            {
                "queries": [
                    {
                        "columns": [
                            key for key in expected if key in {"region", "metro"}
                        ],
                        "metrics": [
                            key for key in expected if key in {"revenue", "margin"}
                        ],
                        "filters": [{"col": "cost_center"}],
                        "orderby": [["cost_center", True]],
                        "granularity": "cost_center",
                    }
                ]
            }
        )
    labels = saved_chart_display_labels(table, chart)
    assert labels == expected
    verbose_map = table.data_for_slices([chart])["verbose_map"]
    assert all(verbose_map.get(key) == label for key, label in labels.items())
    assert "cost_center" not in labels
    assert "sorting_metric" not in labels


@pytest.mark.parametrize("reference_kind", ["BASE_AXIS", "column_reference"])
@pytest.mark.parametrize("exact", [True, False])
def test_chart_display_labels_only_resolve_exact_physical_references(
    reference_kind: str, exact: bool
) -> None:
    """Physical axis wrappers resolve only when expression and label match."""
    table = _labelled_table()
    reference = {
        "label": "region",
        "sqlExpression": "region" if exact else "UPPER(region)",
        "expressionType": "SQL",
        "hasCustomLabel": False,
    }
    if reference_kind == "BASE_AXIS":
        reference["columnType"] = "BASE_AXIS"
    else:
        reference["isColumnReference"] = True
    chart = _chart(11, table, x_axis=reference)
    assert saved_chart_display_labels(table, chart) == (
        {"region": "Region"} if exact else {}
    )


@pytest.mark.parametrize(
    "query_context",
    [
        None,
        "",
        "invalid",
        "null",
        "[]",
        '{"queries": null}',
        '{"queries": [null, 5]}',
        '{"queries": [{"columns": "metro", "metrics": "margin"}]}',
    ],
)
def test_chart_display_labels_tolerate_malformed_query_context(
    query_context: str | None,
) -> None:
    """Malformed cached queries do not prevent valid saved controls being labelled."""
    table = _labelled_table()
    chart = _chart(11, table, groupby=["region"], metrics=["revenue"])
    chart.query_context = query_context
    assert saved_chart_display_labels(table, chart) == {
        "region": "Region",
        "revenue": "Revenue",
    }


def test_chart_display_labels_custom_adhoc_parity() -> None:
    """Authored expression labels occur unchanged in the full-access verbose map."""
    table = _labelled_table()
    chart = _chart(
        11,
        table,
        groupby=[
            {
                "expressionType": "SQL",
                "sqlExpression": "UPPER(cost_center)",
                "label": "Cost grouping",
                "hasCustomLabel": True,
            }
        ],
        metrics=[
            {
                "expressionType": "SQL",
                "sqlExpression": "SUM(margin)",
                "label": "Total margin",
                "hasCustomLabel": True,
            }
        ],
    )
    labels = saved_chart_display_labels(table, chart)
    assert labels == {"Cost grouping": "Cost grouping", "Total margin": "Total margin"}
    verbose_map = table.data_for_slices([chart])["verbose_map"]
    assert all(verbose_map[key] == value for key, value in labels.items())
    assert "cost_center" not in labels
    assert "margin" not in labels


def test_chart_display_labels_preserve_column_metric_collision_precedence(
    client: Any,
    full_api_access: None,
) -> None:
    """A shared identifier cannot supply a different label than the full response."""
    table = _labelled_table()
    table.metrics.append(
        SqlMetric(
            metric_name="region", expression="COUNT(*)", verbose_name="Region count"
        )
    )
    column_chart = _chart(11, table, groupby=["region"])
    metric_chart = _chart(12, table, metrics=["region"])
    dashboard = Dashboard(id=17, slices=[column_chart, metric_chart])
    verbose_map = table.data_for_slices([column_chart, metric_chart])["verbose_map"]
    with _as_regular_user(admin=True, can_access_datasource=False):
        response = _get_datasets(client, dashboard).response
    assert response.status_code == 200
    [dataset] = response.json["result"]
    assert verbose_map["region"] == "Region"
    assert "verbose_map" not in dataset
    assert dataset["chart_display_labels"] == {"11": {"region": "Region"}}


@pytest.mark.parametrize("overridden_method", ["can_access_chart", "raise_for_access"])
def test_chart_display_labels_honor_existing_custom_guest_authorization(
    app_context: None,
    overridden_method: str,
) -> None:
    """Existing custom chart restrictions remain effective for embedded labels."""
    from superset.exceptions import SupersetSecurityException

    table = _labelled_table()
    chart = _chart(11, table, groupby=["region"])
    dashboard = _embedded_dashboard(17, [chart])
    with _as_guest(_guest(DASHBOARD_UUID)):
        assert security_manager.can_access_dashboard_chart_labels(dashboard, chart)
        kwargs: dict[str, Any] = (
            {"return_value": False}
            if overridden_method == "can_access_chart"
            else {
                "side_effect": SupersetSecurityException(
                    security_manager.get_dashboard_access_error_object(dashboard)
                )
            }
        )
        with patch.object(
            security_manager, overridden_method, **kwargs
        ) as custom_check:
            assert not security_manager.can_access_dashboard_chart_labels(
                dashboard, chart
            )
        custom_check.assert_called_once()


def test_chart_display_labels_ignore_viewer_writable_query_context() -> None:
    """Cached query outputs cannot expand the editor-controlled label allowlist."""
    table = _labelled_table()
    chart = _chart(11, table, groupby=["region"])
    chart.query_context = json.dumps(
        {
            "form_data": {"groupby": ["metro"], "metrics": ["revenue"]},
            "queries": [
                {
                    "columns": [
                        "metro",
                        {
                            "sqlExpression": "UPPER(cost_center)",
                            "label": "Cost grouping",
                            "hasCustomLabel": True,
                        },
                    ],
                    "groupby": ["region"],
                    "metrics": [
                        "revenue",
                        {
                            "expressionType": "SQL",
                            "sqlExpression": "SUM(margin)",
                            "label": "SUM(margin)",
                            "hasCustomLabel": False,
                        },
                    ],
                    "filters": [{"col": "cost_center"}],
                    "orderby": [["margin", False]],
                }
            ],
        }
    )
    labels = saved_chart_display_labels(table, chart)
    assert labels == {"region": "Region"}
    verbose_map = table.data_for_slices([chart])["verbose_map"]
    assert verbose_map["metro"] == "Metro area"
    assert "Cost grouping" not in verbose_map
    assert verbose_map["revenue"] == "Revenue"


def test_data_for_slices_only_adds_authored_labels_from_saved_controls() -> None:
    """Query outputs retain stored fields without introducing authored labels."""
    table = _labelled_table()
    chart = _chart(
        11,
        table,
        groupby=[
            "region",
            {
                "expressionType": "SQL",
                "sqlExpression": "UPPER(region)",
                "label": "Saved grouping",
                "hasCustomLabel": True,
            },
        ],
        metrics=[
            {
                "expressionType": "SQL",
                "sqlExpression": "COUNT(*)",
                "label": "Saved count",
                "hasCustomLabel": True,
            }
        ],
    )
    chart.query_context = json.dumps(
        {
            "queries": [
                {
                    "columns": [
                        "metro",
                        {
                            "expressionType": "SQL",
                            "sqlExpression": "cost_center",
                            "label": "cost_center",
                            "isColumnReference": True,
                        },
                        {
                            "expressionType": "SQL",
                            "sqlExpression": "LOWER(region)",
                            "label": "Injected grouping",
                            "hasCustomLabel": True,
                        },
                    ],
                    "metrics": [
                        "revenue",
                        {
                            "expressionType": "SQL",
                            "sqlExpression": "SUM(margin)",
                            "label": "Injected margin",
                            "hasCustomLabel": True,
                        },
                    ],
                }
            ]
        }
    )

    data = table.data_for_slices([chart])

    assert data["verbose_map"] == {
        "__timestamp": "Time",
        "region": "Region",
        "metro": "Metro area",
        "cost_center": "Cost center",
        "revenue": "Revenue",
        "Saved grouping": "Saved grouping",
        "Saved count": "Saved count",
    }
    assert {column["column_name"] for column in data["columns"]} == {
        "region",
        "metro",
        "cost_center",
    }
    assert {metric["metric_name"] for metric in data["metrics"]} == {"revenue"}


@pytest.mark.parametrize("sort_is_displayed", [False, True])
def test_chart_display_labels_exclude_gantt_sort_only_query_columns(
    sort_is_displayed: bool,
) -> None:
    """Gantt's orderby dependencies in query.columns are not display controls."""
    table = _labelled_table()
    sort_column = "region" if sort_is_displayed else "cost_center"
    chart = _chart(
        11,
        table,
        start_time="region",
        end_time="metro",
        y_axis="venue",
        series=["region"],
        tooltip_columns=["metro"],
        tooltip_metrics=["revenue"],
        order_by_cols=[json.dumps([sort_column, True])],
    )
    chart.viz_type = "gantt_chart"
    # Gantt/buildQuery.ts adds orderby columns to its raw query outputs.
    chart.query_context = json.dumps(
        {
            "queries": [
                {
                    "columns": list(
                        dict.fromkeys(["region", "metro", "venue", sort_column])
                    ),
                    "metrics": ["revenue"],
                    "orderby": [[sort_column, True]],
                    "series_columns": ["region"],
                }
            ]
        }
    )
    assert saved_chart_display_labels(table, chart) == {
        "region": "Region",
        "metro": "Metro area",
        "revenue": "Revenue",
    }
    assert sort_column in table.data_for_slices([chart])["verbose_map"]


@pytest.mark.parametrize("sort_is_displayed", [False, True])
def test_chart_display_labels_exclude_butterfly_sort_only_query_metrics(
    sort_is_displayed: bool,
) -> None:
    """Butterfly's added sort metric is labelled only when explicitly displayed."""
    table = _labelled_table()
    table.metrics.append(
        SqlMetric(
            metric_name="sort_only", expression="COUNT(*)", verbose_name="Sort label"
        )
    )
    sort_metric = "revenue" if sort_is_displayed else "sort_only"
    chart = _chart(
        11,
        table,
        groupby=["region"],
        left_metric="revenue",
        right_metric="margin",
        orderby=[sort_metric],
        order_desc=True,
    )
    chart.viz_type = "butterfly"
    # Butterfly/buildQuery.ts uses buildSortMetricOrderby, which appends a
    # missing sort metric to metrics as well as placing it in orderby.
    chart.query_context = json.dumps(
        {
            "queries": [
                {
                    "columns": ["region"],
                    "metrics": list(dict.fromkeys(["revenue", "margin", sort_metric])),
                    "orderby": [[sort_metric, False]],
                }
            ]
        }
    )
    assert saved_chart_display_labels(table, chart) == {
        "region": "Region",
        "revenue": "Revenue",
        "margin": "Margin",
    }
    assert sort_metric in table.data_for_slices([chart])["verbose_map"]


@pytest.mark.parametrize("viz_type", ["table", "ag-grid-table", "handlebars"])
@pytest.mark.parametrize("mode", ["aggregate", "raw", None, "invalid"])
@pytest.mark.parametrize("all_columns", [["metro", "cost_center"], [], None])
def test_chart_display_labels_exclude_hidden_table_controls(
    viz_type: str, mode: str | None, all_columns: list[str] | None
) -> None:
    """Retained controls from the other table query mode cannot contribute labels."""
    table = _labelled_table()
    chart = _chart(
        11,
        table,
        query_mode=mode,
        all_columns=all_columns,
        groupby=["region"],
        metrics=["revenue"],
        percent_metrics=["margin"],
    )
    chart.viz_type = viz_type
    chart.query_context = json.dumps(
        {
            "queries": [
                {
                    "columns": ["metro", "cost_center", "region"],
                    "metrics": ["revenue", "margin"],
                }
            ]
        }
    )
    is_raw = mode == "raw" or (
        viz_type != "handlebars"
        and mode not in ("aggregate", "raw")
        and bool(all_columns)
    )
    if is_raw:
        expected = (
            {"metro": "Metro area", "cost_center": "Cost center"} if all_columns else {}
        )
    else:
        expected = {"region": "Region", "revenue": "Revenue"}
        if viz_type != "handlebars":
            expected["margin"] = "Margin"
        elif mode not in ("aggregate", "raw") and all_columns:
            expected.update({"metro": "Metro area", "cost_center": "Cost center"})
    assert saved_chart_display_labels(table, chart) == expected
    assert set(table.data_for_slices([chart])["verbose_map"]) >= {
        "metro",
        "cost_center",
        "region",
        "revenue",
        "margin",
    }


@pytest.mark.parametrize("model_viz_type", [None, "tree_chart", "table"])
def test_chart_display_labels_share_saved_viz_type_resolution(
    model_viz_type: str | None,
) -> None:
    """Metadata and labels share the model viz type and its saved-form fallback."""
    table = _labelled_table()
    chart = _chart(
        11,
        table,
        viz_type="tree_chart",
        id="region",
        parent="metro",
        name="region",
    )
    chart.viz_type = model_viz_type
    expected = (
        {} if model_viz_type == "table" else {"region": "Region", "metro": "Metro area"}
    )
    assert saved_chart_display_labels(table, chart) == expected
    verbose_map = table.data_for_slices([chart])["verbose_map"]
    assert {name: verbose_map[name] for name in expected} == expected
    if model_viz_type == "table":
        assert "region" not in verbose_map
        assert "metro" not in verbose_map


def test_chart_display_labels_keep_metadata_ids_outside_tree_controls() -> None:
    """Generic chart metadata named id/name is not a displayed column reference."""
    table = _labelled_table()
    chart = _chart(11, table, id="region", name="metro", parent="cost_center")
    assert saved_chart_display_labels(table, chart) == {}


def test_chart_display_labels_include_explicit_tooltip_columns() -> None:
    """Tooltip display fields are labelled without exposing malformed contents."""
    table = _labelled_table()
    chart = _chart(
        11,
        table,
        dimension="region",
        tooltip_contents=[
            "metro",
            {"item_type": "column", "column_name": "region"},
            {"item_type": "html", "column_name": "cost_center"},
            {"item_type": "column", "column_name": ["cost_center"]},
            None,
        ],
    )
    assert saved_chart_display_labels(table, chart) == {
        "region": "Region",
        "metro": "Metro area",
    }
