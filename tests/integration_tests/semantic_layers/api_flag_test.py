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

"""Exercise runtime feature decisions through registered HTTP endpoints."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask.testing import FlaskClient
from flask_appbuilder.security.sqla.models import PermissionView
from werkzeug.test import TestResponse

from superset import security_manager
from superset.extensions import appbuilder, feature_flag_manager
from tests.integration_tests.test_app import app

SEMANTIC_ROUTES: list[tuple[str, str, int]] = [
    ("GET", "/api/v1/semantic_view/2147483647/structure", 404),
    ("POST", "/api/v1/semantic_view/", 400),
    ("PUT", "/api/v1/semantic_view/2147483647", 400),
    ("DELETE", "/api/v1/semantic_view/2147483647", 404),
    ("DELETE", "/api/v1/semantic_view/", 400),
    ("GET", "/api/v1/semantic_layer/types", 200),
    ("POST", "/api/v1/semantic_layer/schema/configuration", 400),
    (
        "POST",
        "/api/v1/semantic_layer/00000000-0000-0000-0000-000000000001/schema/runtime",
        404,
    ),
    ("POST", "/api/v1/semantic_layer/00000000-0000-0000-0000-000000000001/views", 404),
    ("POST", "/api/v1/semantic_layer/", 400),
    ("PUT", "/api/v1/semantic_layer/00000000-0000-0000-0000-000000000001", 400),
    ("DELETE", "/api/v1/semantic_layer/00000000-0000-0000-0000-000000000001", 404),
    ("GET", "/api/v1/semantic_layer/connections/", 200),
    ("GET", "/api/v1/semantic_layer/", 200),
    ("GET", "/api/v1/semantic_layer/00000000-0000-0000-0000-000000000001", 404),
]


@pytest.mark.parametrize("method,path,expected_status", SEMANTIC_ROUTES)
def test_every_semantic_route_is_guarded_at_runtime(
    test_client: FlaskClient[Any],
    login_as_admin: None,
    monkeypatch: pytest.MonkeyPatch,
    method: str,
    path: str,
    expected_status: int,
) -> None:
    """Boot-off registration plus a hook flip protects dispatch before any work."""
    assert "SemanticLayerRestApi" in app.blueprints
    assert "SemanticViewRestApi" in app.blueprints
    endpoint: str = app.url_map.bind("localhost").match(path, method=method)[0]
    handler: MagicMock = MagicMock(wraps=app.view_functions[endpoint])
    monkeypatch.setitem(app.view_functions, endpoint, handler)
    decision: dict[str, bool] = {"enabled": False}

    def resolve(name: str, default: bool) -> bool:
        """Change only the semantic flag, without rebuilding the application."""
        return decision["enabled"] if name == "SEMANTIC_LAYERS" else default

    with patch.object(feature_flag_manager, "_is_feature_enabled_func", resolve):
        assert test_client.open(path, method=method).status_code == 404
        assert test_client.open(path, method=method).json == {"message": "Not found"}
        handler.assert_not_called()
        decision["enabled"] = True
        enabled_response: TestResponse = test_client.open(path, method=method)
        assert enabled_response.status_code == expected_status, (
            enabled_response.get_data(as_text=True)
        )
        assert handler.call_count == 1
        decision["enabled"] = False
        assert test_client.open(path, method=method).status_code == 404
        assert handler.call_count == 1


def test_boot_off_registers_existing_semantic_permissions(app_context: Any) -> None:
    """Role synchronization needs no subsequent feature-enabled boot."""
    permission: str
    view: str
    appbuilder.add_permissions(update_perms=True)
    security_manager.sync_role_definitions()
    for view in ("SemanticLayer", "SemanticView"):
        for permission in ("can_read", "can_write"):
            pvm: PermissionView | None = security_manager.find_permission_view_menu(
                permission, view
            )
            assert pvm
            assert pvm in security_manager.find_role("Admin").permissions
            expected_alpha: bool = view == "SemanticView" or permission == "can_read"
            assert (
                pvm in security_manager.find_role("Alpha").permissions
            ) == expected_alpha
            assert (pvm in security_manager.find_role("Gamma").permissions) == (
                permission == "can_read"
            )


DATA_ROUTES: list[tuple[str, str, dict[str, Any]]] = [
    ("GET", "/api/v1/datasource/semantic_view/17", {}),
    (
        "POST",
        "/api/v1/datasource/semantic_view/17/query",
        {"json": {"dimensions": ["country"]}},
    ),
    ("GET", "/api/v1/datasource/semantic_view/17/column/country/values/", {}),
    (
        "POST",
        "/api/v1/datasource/semantic_view/17/validate_expression/",
        {"json": {"expression": "country"}},
    ),
    ("POST", "/api/v1/datasource/semantic_view/17/compatible", {"json": {}}),
    ("GET", "/datasource/get/semantic_view/17/", {}),
    ("GET", "/datasource/external_metadata/semantic_view/17/", {}),
    (
        "POST",
        "/datasource/save/",
        {"data": {"data": '{"id":17,"type":"semantic_view","database":{"id":1}}'}},
    ),
    ("GET", "/superset/fetch_datasource_metadata?datasourceKey=17__semantic_view", {}),
    ("GET", "/api/v1/explore/?datasource_id=17&datasource_type=semantic_view", {}),
    (
        "POST",
        "/api/v1/chart/data",
        {"json": {"datasource": {"id": 17, "type": "semantic_view"}, "queries": []}},
    ),
    (
        "POST",
        "/api/v1/explore/form_data",
        {
            "json": {
                "datasource_id": 17,
                "datasource_type": "semantic_view",
                "form_data": "{}",
            }
        },
    ),
    (
        "POST",
        "/api/v1/explore/permalink",
        {"json": {"formData": {"datasource": "17__semantic_view"}}},
    ),
]


@pytest.mark.parametrize("method,path,options", DATA_ROUTES)
def test_semantic_data_http_boundaries_refuse_when_disabled(
    test_client: FlaskClient[Any],
    login_as_admin: None,
    method: str,
    path: str,
    options: dict[str, Any],
) -> None:
    """Authorized requests fail before resolving semantic metadata or querying."""
    query: MagicMock
    from superset.semantic_layers.models import SemanticView

    with (
        patch.object(
            feature_flag_manager,
            "_is_feature_enabled_func",
            lambda name, default: False if name == "SEMANTIC_LAYERS" else default,
        ),
        patch.object(SemanticView, "get_query_result") as query,
    ):
        response: TestResponse = test_client.open(
            path, method=method, follow_redirects=True, **options
        )
    assert response.status_code == 404, response.get_data(as_text=True)
    assert "Semantic layers are not enabled." in response.get_data(as_text=True)
    query.assert_not_called()


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_chart_data_refuses_disabled_semantic_chart(
    test_client: FlaskClient[Any],
    login_as_admin: None,
    method: str,
) -> None:
    """Saved GET and submitted POST queries refuse before reading cached results."""
    query: MagicMock
    from superset.models.slice import Slice
    from superset.semantic_layers.models import SemanticView
    from superset.utils import json

    payload: dict[str, Any] = {
        "datasource": {"id": 17, "type": "semantic_view"},
        "queries": [],
    }
    chart: Slice = Slice(
        id=17,
        datasource_id=17,
        datasource_type="semantic_view",
        params="{}",
        query_context=json.dumps(payload),
    )
    with (
        patch.object(
            feature_flag_manager,
            "_is_feature_enabled_func",
            lambda name, default: False if name == "SEMANTIC_LAYERS" else default,
        ),
        patch(
            "flask_appbuilder.models.sqla.interface.SQLAInterface.get",
            return_value=chart,
        ),
        patch.object(SemanticView, "get_query_result") as query,
    ):
        response: TestResponse = (
            test_client.get("/api/v1/chart/17/data/")
            if method == "GET"
            else test_client.post("/api/v1/chart/data", json=payload)
        )
    assert response.status_code == 404, response.get_data(as_text=True)
    assert "Semantic layers are not enabled." in response.get_data(as_text=True)
    query.assert_not_called()


@pytest.mark.parametrize("method", ["POST", "PUT"])
def test_chart_save_refuses_semantic_source(
    test_client: FlaskClient[Any],
    login_as_admin: None,
    method: str,
) -> None:
    """Creation and a title-only update both retain stored semantic assets unchanged."""
    from superset import db
    from superset.models.slice import Slice

    chart: Slice = Slice(
        slice_name="original",
        datasource_id=17,
        datasource_type="semantic_view",
        params="{}",
        viz_type="table",
    )
    db.session.add(chart)
    db.session.commit()
    try:
        with patch.object(
            feature_flag_manager,
            "_is_feature_enabled_func",
            lambda name, default: False if name == "SEMANTIC_LAYERS" else default,
        ):
            response: TestResponse = (
                test_client.post(
                    "/api/v1/chart/",
                    json={
                        "slice_name": "new",
                        "datasource_id": 17,
                        "datasource_type": "semantic_view",
                        "viz_type": "table",
                    },
                )
                if method == "POST"
                else test_client.put(
                    f"/api/v1/chart/{chart.id}", json={"slice_name": "changed"}
                )
            )
        assert response.status_code == 422, response.get_data(as_text=True)
        assert "Semantic layers are not enabled." in response.get_data(as_text=True)
        db.session.refresh(chart)
        assert chart.slice_name == "original"
    finally:
        db.session.delete(chart)
        db.session.commit()


def test_dashboard_dataset_http_omits_semantic_metadata(
    test_client: FlaskClient[Any],
    login_as_admin: None,
) -> None:
    """HTTP dashboard metadata does not serialize a disabled semantic view."""
    metadata: MagicMock
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.semantic_layers.models import SemanticView

    view: SemanticView = SemanticView(id=17, name="hidden")
    chart: Slice = Slice(
        id=17, datasource_type="semantic_view", datasource_id=17, semantic_view=view
    )
    dashboard: Dashboard = Dashboard(id=17, dashboard_title="mixed", slices=[chart])
    with (
        patch.object(
            feature_flag_manager,
            "_is_feature_enabled_func",
            lambda name, default: False if name == "SEMANTIC_LAYERS" else default,
        ),
        patch(
            "superset.daos.dashboard.DashboardDAO.get_by_id_or_slug",
            return_value=dashboard,
        ),
        patch.object(SemanticView, "data_for_slices") as metadata,
    ):
        response: TestResponse = test_client.get("/api/v1/dashboard/17/datasets")
    assert response.status_code == 200
    assert response.json["result"] == []
    metadata.assert_not_called()


def test_combined_list_omits_semantic_views_at_runtime(
    test_client: FlaskClient[Any],
    login_as_admin: None,
) -> None:
    """The combined picker retains its feature-off datasource selection."""
    command: MagicMock
    with (
        patch.object(
            feature_flag_manager,
            "_is_feature_enabled_func",
            lambda name, default: False if name == "SEMANTIC_LAYERS" else default,
        ),
        patch("superset.datasource.api.GetCombinedDatasourceListCommand") as command,
    ):
        command.return_value.run.return_value = {"result": [], "count": 0}
        response: TestResponse = test_client.get("/api/v1/datasource/")
    assert response.status_code == 200
    assert command.call_args.kwargs["can_read_datasets"]
    assert not command.call_args.kwargs["can_read_semantic_views"]


@pytest.mark.parametrize("legacy", [False, True])
def test_warm_up_http_refuses_disabled_semantic_chart(
    test_client: FlaskClient[Any], login_as_admin: None, legacy: bool
) -> None:
    """Both warm-up transports preserve the typed refusal before query work."""
    from superset import db
    from superset.models.slice import Slice

    chart: Slice = Slice(
        slice_name="disabled warm-up",
        datasource_id=17,
        datasource_type="semantic_view",
        params="{}",
        viz_type="table",
    )
    context: MagicMock
    db.session.add(chart)
    db.session.commit()
    try:
        with (
            patch.object(
                feature_flag_manager,
                "_is_feature_enabled_func",
                lambda name, default: False if name == "SEMANTIC_LAYERS" else default,
            ),
            patch.object(Slice, "get_query_context") as context,
        ):
            response: TestResponse = (
                test_client.get(
                    f"/superset/warm_up_cache/?slice_id={chart.id}",
                    follow_redirects=True,
                )
                if legacy
                else test_client.put(
                    "/api/v1/chart/warm_up_cache", json={"chart_id": chart.id}
                )
            )
        assert response.status_code == (200 if legacy else 404), response.get_data(
            as_text=True
        )
        assert "Semantic layers are not enabled." in response.get_data(as_text=True)
        context.assert_not_called()
    finally:
        db.session.delete(chart)
        db.session.commit()


def test_legacy_batch_continues_after_disabled_semantic_chart(
    test_client: FlaskClient[Any],
    login_as_admin: None,
) -> None:
    """The legacy batch envelope records one refusal and warms the next chart."""
    from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand
    from superset.models.slice import Slice
    from superset.semantic_layers.access import SemanticLayersDisabledError

    semantic: Slice = Slice(id=17, datasource_id=17, datasource_type="semantic_view")
    table: Slice = Slice(id=18, datasource_id=18, datasource_type="table")
    selection: MagicMock = MagicMock()
    selection.filter_by.return_value.all.return_value = [semantic, table]
    execute: MagicMock
    with (
        patch("superset.feature_flag_manager.is_feature_enabled", return_value=False),
        patch("superset.views.core.db.session.query", return_value=selection),
        patch(
            "superset.commands.chart.warm_up_cache.security_manager.raise_for_access"
        ),
        patch.object(
            ChartWarmUpCacheCommand,
            "_warm_up_non_legacy_cache",
            return_value=(None, "success"),
        ) as execute,
    ):
        response: TestResponse = test_client.get(
            "/superset/warm_up_cache/?slice_id=17", follow_redirects=True
        )
    assert response.status_code == 200
    assert response.get_json() == [
        {
            "slice_id": 17,
            "viz_error": SemanticLayersDisabledError.message,
            "viz_status": None,
        },
        {"slice_id": 18, "viz_error": None, "viz_status": "success"},
    ]
    execute.assert_called_once_with(table)
