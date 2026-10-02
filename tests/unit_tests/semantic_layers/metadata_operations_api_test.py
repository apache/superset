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

from __future__ import annotations

from typing import Any, Literal
from unittest.mock import Mock
from uuid import UUID

import pytest
from flask import Flask
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy.exc import OperationalError
from superset_core.semantic_layers.metadata import (
    CatalogSnapshot,
    MetadataRefreshError,
    MetadataRefreshErrorCategory,
    MetadataRefreshResult,
)
from werkzeug.test import TestResponse

from superset.semantic_layers.models import SemanticView

pytestmark: pytest.MarkDecorator = pytest.mark.parametrize(
    "app",
    [
        {
            "FEATURE_FLAGS": {"SEMANTIC_LAYERS": True},
            "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
        }
    ],
    indirect=True,
)

VIEW_UUID: str = "bd2f07da-c65e-40da-b75e-c62b7cdd67f1"


@pytest.fixture(scope="module", autouse=True)
def install_error_handlers(app: Flask) -> None:
    from superset.views.error_handling import set_app_error_handlers

    set_app_error_handlers(app)


@pytest.mark.parametrize(
    "category,status",
    [
        ("deadline", 504),
        ("unavailable", 503),
        ("indeterminate", 503),
        ("upstream", 502),
        ("invalid_payload", 502),
        ("in_progress", 409),
        ("configuration_changed", 409),
        ("unsupported", 422),
        ("configuration", 422),
    ],
)
def test_refresh_sanitized_error_categories(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    category: Any,
    status: int,
) -> None:
    command: Mock = mocker.patch("superset.semantic_layers.api.RefreshMetadataCommand")
    command.return_value.run.side_effect = MetadataRefreshError(category)
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/refresh_metadata/", json={}
    )
    assert response.status_code == status
    assert response.json["error"] == category


def test_refresh_only_exposes_confirmed_outcome(
    client: FlaskClient, full_api_access: None, mocker: MockerFixture
) -> None:
    command: Mock = mocker.patch("superset.semantic_layers.api.RefreshMetadataCommand")
    command.return_value.run.return_value = MetadataRefreshResult(
        "changed",
        CatalogSnapshot("private catalog", "private-token", "2026-09-30T12:00:00Z"),
    )
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/refresh_metadata/", json={}
    )
    assert response.status_code == 200
    assert response.json["result"] == {
        "status": "changed",
        "observed_at": "2026-09-30T12:00:00Z",
    }
    command.assert_called_once_with(UUID(VIEW_UUID))


@pytest.mark.parametrize(
    "payload", [{"scope": "other"}, {"configuration": {}}, [], None]
)
def test_refresh_rejects_client_scope(
    client: FlaskClient, full_api_access: None, mocker: MockerFixture, payload: Any
) -> None:
    command: Mock = mocker.patch("superset.semantic_layers.api.RefreshMetadataCommand")
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/refresh_metadata/", json=payload
    )
    assert response.status_code == 400
    command.assert_not_called()


def test_refresh_database_outage_is_not_not_found(
    client: FlaskClient, full_api_access: None, mocker: MockerFixture
) -> None:
    command: Mock = mocker.patch("superset.semantic_layers.api.RefreshMetadataCommand")
    command.return_value.run.side_effect = OperationalError(
        "private SQL", {}, Exception("private DB")
    )
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/refresh_metadata/", json={}
    )
    assert response.status_code == 503
    assert "private" not in response.get_data(as_text=True)


@pytest.mark.parametrize("kind", ["catalog", "compatibility"])
def test_cache_inspection_accepts_only_selected_stored_scope(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    kind: Literal["catalog", "compatibility"],
) -> None:
    from datetime import datetime, timezone

    from superset.semantic_layers.cache_inspection import CacheEntryInfo

    name: str = (
        "InspectCatalogCommand" if kind == "catalog" else "InspectCompatibilityCommand"
    )
    command: Mock = mocker.patch(f"superset.semantic_layers.api.{name}")
    command.return_value.run.return_value = CacheEntryInfo(
        kind, "missing", datetime.now(timezone.utc)
    )
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/cache_metadata/", json={"kind": kind}
    )
    assert response.status_code == 200
    assert response.json["result"]["state"] == "missing"
    response = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/cache_metadata/",
        json={"kind": kind, "cache_key": "other"},
    )
    assert response.status_code == 400
    assert command.call_count == 1


@pytest.mark.parametrize(
    "operation,command_name",
    [
        ("refresh_metadata", "RefreshMetadataCommand"),
        ("invalidate_catalog", "InvalidateCatalogCommand"),
        ("invalidate_compatibility", "InvalidateCompatibilityCommand"),
        ("cache_metadata", "InspectCatalogCommand"),
    ],
)
@pytest.mark.parametrize(
    "outcome,status",
    [("missing", 404), ("denied", 403), ("ok", 200), ("injected", 400)],
)
def test_maintenance_routes_keep_scope_authority_and_input_boundaries(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    operation: str,
    command_name: str,
    outcome: str,
    status: int,
) -> None:
    from datetime import datetime, timezone

    from superset.commands.semantic_layer.exceptions import (
        SemanticLayerForbiddenError,
        SemanticViewNotFoundError,
    )
    from superset.semantic_layers.cache_inspection import CacheEntryInfo

    command: Mock = mocker.patch(f"superset.semantic_layers.api.{command_name}")
    body: dict[str, Any] = {"kind": "catalog"} if operation == "cache_metadata" else {}
    if outcome == "missing":
        command.return_value.run.side_effect = SemanticViewNotFoundError()
    elif outcome == "denied":
        command.return_value.run.side_effect = SemanticLayerForbiddenError()
    elif outcome == "injected":
        body["tenant"] = "other"
    elif operation == "refresh_metadata":
        command.return_value.run.return_value = MetadataRefreshResult(
            "unchanged", CatalogSnapshot("[]", "internal-token", "2026-09-30T00:00:00Z")
        )
    elif operation == "cache_metadata":
        command.return_value.run.return_value = CacheEntryInfo(
            "catalog", "missing", datetime.now(timezone.utc)
        )
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/{operation}/", json=body
    )
    assert response.status_code == status
    if outcome == "injected":
        command.assert_not_called()


@pytest.mark.parametrize(
    "body",
    [
        {"kind": []},
        {"kind": "other"},
        {"kind": "compatibility", "selected_metrics": [4]},
        {"kind": "catalog", "selected_dimensions": ["country"]},
    ],
)
def test_inspection_rejects_invalid_selection(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    body: dict[str, Any],
) -> None:
    command: Mock = mocker.patch("superset.semantic_layers.api.InspectCatalogCommand")
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/cache_metadata/", json=body
    )
    assert response.status_code == 400
    command.assert_not_called()


@pytest.mark.parametrize(
    "outcome,status",
    [
        ("ok", 200),
        ("missing-adapter", 422),
        ("deadline", 504),
        ("db", 503),
        ("untyped", 502),
    ],
)
def test_bound_runtime_schema_uses_adapter_and_safe_errors(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    outcome: str,
    status: int,
) -> None:
    layer: Mock = Mock(type="test")
    mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid", return_value=layer
    )
    mocker.patch("superset.semantic_layers.api.participates", return_value=True)
    legacy: Mock = Mock()
    mocker.patch.dict("superset.semantic_layers.api.registry", {"test": legacy})
    adapter: Mock = Mock()
    layer.implementation.metadata_refresh = adapter
    adapter.get_runtime_schema.return_value = {"enum": ["new_metric"]}
    if outcome == "missing-adapter":
        layer.implementation.metadata_refresh = None
    elif outcome == "deadline":
        adapter.get_runtime_schema.side_effect = MetadataRefreshError("deadline")
    elif outcome == "untyped":
        adapter.get_runtime_schema.side_effect = ValueError("private vendor credential")
    elif outcome == "db":
        adapter.get_runtime_schema.side_effect = OperationalError(
            "private", {}, Exception("private")
        )
    response: TestResponse = client.post(
        f"/api/v1/semantic_layer/{VIEW_UUID}/schema/runtime", json={"runtime_data": {}}
    )
    assert response.status_code == status
    assert "private" not in response.get_data(as_text=True)
    legacy.get_runtime_schema.assert_not_called()
    if outcome == "ok":
        assert response.json["result"] == {"enum": ["new_metric"]}


@pytest.mark.parametrize("route", ["structure", "views"])
def test_typed_discovery_failure_is_not_legacy_validation_error(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    route: str,
) -> None:
    from unittest.mock import MagicMock

    model: MagicMock = MagicMock(type="test")
    if route == "views":
        mocker.patch(
            "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid",
            return_value=model,
        )
        model.implementation.get_semantic_views.side_effect = MetadataRefreshError(
            "unavailable"
        )
        response: TestResponse = client.post(
            f"/api/v1/semantic_layer/{VIEW_UUID}/views", json={}
        )
    else:
        mocker.patch(
            "superset.semantic_layers.api.db.session.query"
        ).return_value.filter_by.return_value.first.return_value = model
        model.implementation.get_dimensions.side_effect = MetadataRefreshError(
            "deadline"
        )
        response = client.get("/api/v1/semantic_view/1/structure")
    assert response.status_code == (503 if route == "views" else 504)


@pytest.mark.parametrize("identifier,status", [(VIEW_UUID, 503), ("not-a-uuid", 404)])
def test_runtime_schema_distinguishes_invalid_uuid_from_database_outage(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    identifier: str,
    status: int,
) -> None:
    query: Mock = mocker.patch(
        "superset.daos.semantic_layer.db.session.query",
        side_effect=OperationalError("private SQL", {}, Exception("private details")),
    )
    response: TestResponse = client.post(
        f"/api/v1/semantic_layer/{identifier}/schema/runtime", json={}
    )
    assert response.status_code == status
    assert "private" not in response.get_data(as_text=True)
    if status == 404:
        query.assert_not_called()
    else:
        query.assert_called_once()


@pytest.mark.parametrize("enabled", [False, True])
def test_unrelated_database_errors_keep_existing_chart_data_handling(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    enabled: bool,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", enabled)
    mocker.patch(
        "superset.charts.data.api.ChartDataRestApi.datamodel.get",
        side_effect=OperationalError("statement", {}, Exception("engine failure")),
    )
    response: TestResponse = client.get("/api/v1/chart/1/data/")
    assert response.status_code == 500
    assert response.json["errors"][0]["error_type"] == "GENERIC_BACKEND_ERROR"
    assert any(
        record.name == "superset.views.error_handling" for record in caplog.records
    )


def test_mapped_metadata_failure_logs_safe_category_and_traceback(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    error: MetadataRefreshError = MetadataRefreshError("indeterminate")
    error.__cause__ = ValueError("private credential")
    mocker.patch(
        "superset.semantic_layers.api.RefreshMetadataCommand"
    ).return_value.run.side_effect = error
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/refresh_metadata/", json={}
    )
    assert response.status_code == 503
    assert "indeterminate" in caplog.text
    assert "private credential" not in caplog.text
    assert any(record.exc_info for record in caplog.records)


def test_inspection_timestamps_preserve_utc_precision(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    from datetime import datetime, timezone

    from superset.semantic_layers.cache_inspection import CacheEntryInfo

    observed: datetime = datetime(2026, 9, 30, 12, 0, 0, 123456, tzinfo=timezone.utc)
    mocker.patch(
        "superset.semantic_layers.api.InspectCatalogCommand"
    ).return_value.run.return_value = CacheEntryInfo(
        "catalog",
        "present",
        observed,
        created_at=observed,
        source_observed_at=observed,
        expires_at=observed,
    )
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/cache_metadata/", json={"kind": "catalog"}
    )
    assert response.status_code == 200
    name: str
    for name in ["inspected_at", "created_at", "source_observed_at", "expires_at"]:
        assert response.json["result"][name] == observed.isoformat()


def test_disabled_metadata_mapping_leaves_dao_failure_to_global_handler(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", False)
    mocker.patch(
        "superset.daos.semantic_layer.db.session.query",
        side_effect=OperationalError("statement", {}, Exception("database failure")),
    )
    response: TestResponse = client.post(
        f"/api/v1/semantic_layer/{VIEW_UUID}/schema/runtime", json={}
    )
    assert response.status_code == 500
    assert not any(
        record.name == "superset.semantic_layers.metadata_errors"
        for record in caplog.records
    )


@pytest.mark.parametrize(
    "route,status,enabled",
    [
        ("structure", 422, False),
        ("runtime", 400, False),
        ("views", 400, False),
        ("structure", 503, True),
        ("views", 503, True),
    ],
)
def test_provider_database_error_respects_metadata_error_mapping(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    route: str,
    status: int,
    enabled: bool,
) -> None:
    """Provider failures use safe mapping only when metadata refresh is enabled."""
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", enabled)
    model: Mock = Mock(type="test")
    error: OperationalError = OperationalError("statement", {}, Exception("provider"))
    response: TestResponse
    if route == "structure":
        mocker.patch(
            "superset.semantic_layers.api.db.session.query"
        ).return_value.filter_by.return_value.first.return_value = model
        model.implementation.get_dimensions.side_effect = error
        response = client.get("/api/v1/semantic_view/1/structure")
    else:
        mocker.patch(
            "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid",
            return_value=model,
        )
        if route == "runtime":
            provider: Mock = Mock()
            provider.get_runtime_schema.side_effect = error
            mocker.patch.dict(
                "superset.semantic_layers.api.registry", {"test": provider}
            )
            response = client.post(
                f"/api/v1/semantic_layer/{VIEW_UUID}/schema/runtime", json={}
            )
        else:
            model.implementation.get_semantic_views.side_effect = error
            response = client.post(f"/api/v1/semantic_layer/{VIEW_UUID}/views", json={})
    assert response.status_code == status
    if enabled:
        assert response.json["error"] == "unavailable"
        assert "provider" not in response.get_data(as_text=True)


@pytest.mark.parametrize(
    "route,command_name,payload",
    [
        ("refresh_metadata", "RefreshMetadataCommand", {}),
        ("invalidate_catalog", "InvalidateCatalogCommand", {}),
        ("invalidate_compatibility", "InvalidateCompatibilityCommand", {}),
        ("cache_metadata", "InspectCatalogCommand", {"kind": "catalog"}),
    ],
)
def test_metadata_operations_record_audit_action(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    route: str,
    command_name: str,
    payload: dict[str, str],
) -> None:
    """Privileged metadata operations reach the configured event logger."""
    from datetime import datetime, timezone

    from superset import event_logger
    from superset.semantic_layers.cache_inspection import CacheEntryInfo

    command: Mock = mocker.patch(f"superset.semantic_layers.api.{command_name}")
    command.return_value.run.return_value = (
        CacheEntryInfo("catalog", "missing", datetime.now(timezone.utc))
        if route == "cache_metadata"
        else MetadataRefreshResult(
            "changed", CatalogSnapshot("[]", "token", "2026-10-01T12:00:00Z")
        )
    )
    log: Mock = mocker.patch.object(event_logger, "log")
    response: TestResponse = client.post(
        f"/api/v1/semantic_view/{VIEW_UUID}/{route}/", json=payload
    )
    assert response.status_code == 200
    log.assert_called_once()
    assert log.call_args.args[1] == f"SemanticViewRestApi.{route}"


@pytest.mark.parametrize("route", ["metadata", "query", "explore", "column"])
@pytest.mark.parametrize("category,status", [("unavailable", 503), ("deadline", 504)])
def test_datasource_http_boundaries_map_typed_discovery_errors(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    route: str,
    category: MetadataRefreshErrorCategory,
    status: int,
) -> None:
    """Real discovery after authorization keeps its typed HTTP failure category."""
    from tests.unit_tests.semantic_layers.metadata_identity_test import (
        ResultView,
        view_for,
    )

    view: SemanticView = view_for(ResultView("captured", 1))
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=view
    )
    access: Mock = mocker.patch(
        "superset.extensions.security_manager.raise_for_access"
        if route == "explore"
        else "superset.semantic_layers.models.SemanticView.raise_for_access"
    )
    mocker.patch(
        "superset.semantic_layers.metadata_binding.participates", return_value=True
    )
    error: MetadataRefreshError = MetadataRefreshError(category)
    error.__cause__ = RuntimeError("private provider detail")
    provider: Mock = mocker.patch(
        "superset.semantic_layers.metadata_binding.view_implementation",
        side_effect=error,
    )
    response: TestResponse = _request_discovery_route(client, route)
    assert response.status_code == status
    assert response.json["error"] == category
    assert "private" not in response.get_data(as_text=True)
    access.assert_called_once()
    provider.assert_called_once_with(view)


def _install_dashboard_view(mocker: MockerFixture, view: SemanticView) -> None:
    """Use the real dashboard DAO, member resolution and serialization path."""
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    chart: Slice = Slice(
        datasource_id=view.id, datasource_type="semantic_view", semantic_view=view
    )
    dashboard: Dashboard = Dashboard(id=1, uuid=UUID(VIEW_UUID), slices=[chart])
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=dashboard)
    mocker.patch(
        "superset.extensions.security_manager.can_access_datasource", return_value=True
    )


def _request_discovery_route(client: FlaskClient, route: str) -> TestResponse:
    """Exercise each HTTP boundary with valid stored-view input."""
    if route == "dashboard":
        return client.get(f"/api/v1/dashboard/{VIEW_UUID}/datasets")
    if route == "column":
        return client.get(
            "/api/v1/datasource/semantic_view/11/column/orders/values/?force=true"
        )
    if route == "query":
        return client.post(
            "/api/v1/datasource/semantic_view/11/query", json={"metrics": ["orders"]}
        )
    if route == "explore":
        return client.get(
            "/api/v1/explore/?datasource_type=semantic_view&datasource_id=11"
        )
    return client.get("/api/v1/datasource/semantic_view/11")


@pytest.mark.parametrize(
    "route", ["metadata", "query", "explore", "column", "dashboard"]
)
def test_discovery_http_mapping_preserves_denial_before_provider(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    route: str,
) -> None:
    """The new error boundary must not move discovery ahead of access checks."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException
    from tests.unit_tests.semantic_layers.metadata_identity_test import (
        ResultView,
        view_for,
    )

    view: SemanticView = view_for(ResultView("captured", 1))
    if route == "dashboard":
        _install_dashboard_view(mocker, view)
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch(
        "superset.extensions.security_manager.raise_for_access"
        if route in {"explore", "dashboard"}
        else "superset.semantic_layers.models.SemanticView.raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                message="denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        ),
    )
    provider: Mock = mocker.patch(
        "superset.semantic_layers.metadata_binding.view_implementation"
    )
    response: TestResponse = _request_discovery_route(client, route)
    assert response.status_code == 403
    provider.assert_not_called()


@pytest.mark.parametrize("route", ["metadata", "query", "explore", "column"])
@pytest.mark.parametrize("enabled", [False, True])
def test_discovery_mapping_leaves_unrelated_database_errors_unchanged(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    route: str,
    enabled: bool,
) -> None:
    """Only typed metadata failures acquire the metadata response contract."""
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", enabled)
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource",
        side_effect=OperationalError("statement", {}, Exception("unrelated")),
    )
    response: TestResponse = _request_discovery_route(client, route)
    assert response.status_code == 500
    assert response.json.get("error") != "unavailable"


@pytest.mark.parametrize(
    "category,status", [("unavailable", 503), ("deadline", 504), ("configuration", 422)]
)
@pytest.mark.parametrize("method", ["GET", "POST"])
def test_chart_cache_key_metadata_errors_reach_existing_http_mapping(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    category: MetadataRefreshErrorCategory,
    status: int,
    method: str,
) -> None:
    """A real semantic extra-key failure propagates through chart execution."""
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from tests.unit_tests.semantic_layers.metadata_identity_test import (
        context_for,
        ResultView,
        view_for,
    )

    view: SemanticView = view_for(ResultView("captured", 1))
    context: QueryContext
    query: QueryObject
    context, query = context_for(view)
    context.cache_values["queries"] = [query.to_dict()]
    mocker.patch("superset.extensions.security_manager.raise_for_access")
    mocker.patch(
        "superset.semantic_layers.metadata_binding.participates", return_value=True
    )
    mocker.patch(
        "superset.semantic_layers.metadata_binding.view_implementation",
        side_effect=MetadataRefreshError(category),
    )
    extra_keys: Mock = mocker.spy(view, "get_extra_cache_keys")
    mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._create_query_context_from_form",
        return_value=context,
    )
    response: TestResponse
    if method == "GET":
        from superset.models.slice import Slice

        chart: Slice = Slice(id=1, query_context="{}", params="{}")
        mocker.patch(
            "superset.charts.data.api.ChartDataRestApi.datamodel.get",
            return_value=chart,
        )
        response = client.get("/api/v1/chart/1/data/")
    else:
        response = client.post(
            "/api/v1/chart/data", json={"result_format": "json", "result_type": "full"}
        )
    assert response.status_code == status
    assert response.json["error"] == category
    extra_keys.assert_called_once_with(query.to_dict())


@pytest.mark.parametrize("category", ["unavailable", "deadline"])
def test_dashboard_discovery_failure_preserves_other_datasets(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    category: MetadataRefreshErrorCategory,
) -> None:
    """A failed semantic provider retains the dashboard's healthy table metadata."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from tests.unit_tests.semantic_layers.metadata_identity_test import (
        ResultView,
        view_for,
    )

    view: SemanticView = view_for(ResultView("captured", 1))
    chart: Slice = Slice(
        datasource_id=view.id, datasource_type="semantic_view", semantic_view=view
    )
    table: SqlaTable = SqlaTable(id=12, table_name="healthy")
    table_chart: Slice = Slice(
        datasource_id=table.id, datasource_type="table", table=table
    )
    dashboard: Dashboard = Dashboard(
        id=1, uuid=UUID(VIEW_UUID), slices=[chart, table_chart]
    )
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=dashboard)
    access: Mock = mocker.patch("superset.extensions.security_manager.raise_for_access")
    mocker.patch(
        "superset.extensions.security_manager.can_access_datasource", return_value=True
    )
    mocker.patch.object(
        SqlaTable,
        "data_for_slices",
        return_value={"id": 12, "uid": "12__table", "type": "table", "name": "healthy"},
    )
    mocker.patch(
        "superset.semantic_layers.metadata_binding.participates", return_value=True
    )
    error: MetadataRefreshError = MetadataRefreshError(category)
    error.__cause__ = RuntimeError("private provider detail")
    provider: Mock = mocker.patch(
        "superset.semantic_layers.metadata_binding.view_implementation",
        side_effect=error,
    )
    response: TestResponse = _request_discovery_route(client, "dashboard")
    assert response.status_code == 200
    assert [dataset["id"] for dataset in response.json["result"]] == [12]
    assert "private" not in response.get_data(as_text=True)
    access.assert_called_once_with(dashboard=dashboard)
    provider.assert_called_once_with(view)
