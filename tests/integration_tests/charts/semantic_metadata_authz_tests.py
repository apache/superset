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
"""Check whether denied chart-data requests call semantic provider metadata."""

from collections.abc import Callable
from unittest.mock import Mock, patch, PropertyMock

import pytest
import sqlalchemy as sa
from flask import current_app, g, Response

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db, security_manager
from superset.models.dashboard import Dashboard
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)


class TestSemanticMetadataAuthorization(SupersetTestCase):
    """Exercise the chart-data route with a provider that records metadata calls."""

    def test_denied_chart_data_skips_provider_metadata(self) -> None:
        """A denied request should not load dimensions or metrics."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(name="authz-metadata-layer", type="test")
        view: SemanticView = SemanticView(
            name="authz-metadata-view", semantic_layer=layer
        )
        db.session.add(view)
        db.session.commit()
        provider: Mock = Mock()
        provider.get_dimensions.return_value = set()
        provider.get_metrics.return_value = set()
        try:
            with patch.object(
                SemanticView,
                "implementation",
                new_callable=PropertyMock,
                return_value=provider,
            ):
                response: Response = self.client.post(
                    "/api/v1/chart/data",
                    json={
                        "datasource": {"id": view.id, "type": "semantic_view"},
                        "queries": [{"columns": [], "metrics": []}],
                    },
                )
            assert response.status_code == 403, response.json
            provider.get_dimensions.assert_not_called()
            provider.get_metrics.assert_not_called()
        finally:
            db.session.rollback()
            db.session.delete(view)
            db.session.delete(layer)
            db.session.commit()

    def test_allowed_chart_data_uses_provider_metadata(self) -> None:
        """An entitled role still builds and validates a semantic query."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(name="allowed-metadata-layer", type="test")
        view: SemanticView = SemanticView(
            name="allowed-metadata-view", semantic_layer=layer
        )
        db.session.add(view)
        db.session.commit()
        provider: Mock = Mock()
        provider.get_dimensions.return_value = set()
        provider.get_metrics.return_value = set()
        original_can_access: Callable[[str, str], bool] = security_manager.can_access

        def can_access(permission_name: str, view_name: str) -> bool:
            """Give Gamma this view's datasource grant for the request."""
            if permission_name == "datasource_access" and view_name == view.perm:
                return True
            return original_can_access(permission_name, view_name)

        try:
            with (
                patch.object(
                    SemanticView,
                    "implementation",
                    new_callable=PropertyMock,
                    return_value=provider,
                ),
                patch.object(security_manager, "can_access", side_effect=can_access),
            ):
                response: Response = self.client.post(
                    "/api/v1/chart/data",
                    json={
                        "datasource": {"id": view.id, "type": "semantic_view"},
                        "queries": [{"columns": [], "metrics": []}],
                        "result_type": "query",
                    },
                )
            assert response.status_code == 200, response.json
            provider.get_dimensions.assert_called()
        finally:
            db.session.rollback()
            db.session.delete(view)
            db.session.delete(layer)
            db.session.commit()

    @with_feature_flags(ENABLE_VIEWERS=True)
    def test_denied_viewer_filter_skips_provider_metadata(self) -> None:
        """A denied ordinary dashboard filter must not load provider metadata."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(name="viewer-metadata-layer", type="test")
        view: SemanticView = SemanticView(
            name="viewer-metadata-view", semantic_layer=layer
        )
        db.session.add(view)
        db.session.flush()
        metadata: str = json.dumps(
            {
                "native_filter_configuration": [
                    {
                        "id": "filter-1",
                        "targets": [
                            {
                                "datasetId": view.id + 1,
                                "datasourceType": "semantic_view",
                            }
                        ],
                    }
                ]
            }
        )
        dashboard_id: int = db.session.execute(
            sa.insert(Dashboard.__table__).values(
                dashboard_title="viewer-metadata-dashboard",
                published=True,
                json_metadata=metadata,
            )
        ).inserted_primary_key[0]
        db.session.commit()
        provider: Mock = Mock()
        provider.get_dimensions.return_value = set()
        provider.get_metrics.return_value = set()
        provider.features = frozenset()
        provider.selection_identity_version = None
        provider.uid.return_value = "viewer-metadata-view"
        try:
            with (
                patch.dict(current_app.config, {"VIEWER_PROMISCUOUS_MODE": True}),
                patch.object(
                    SemanticView,
                    "implementation",
                    new_callable=PropertyMock,
                    return_value=provider,
                ),
                patch.object(security_manager, "is_viewer", return_value=True),
            ):
                response: Response = self.client.post(
                    "/api/v1/chart/data",
                    json={
                        "datasource": {"id": view.id, "type": "semantic_view"},
                        "queries": [{"columns": [], "metrics": []}],
                        "form_data": {
                            "dashboardId": dashboard_id,
                            "type": "NATIVE_FILTER",
                            "native_filter_id": "filter-1",
                        },
                    },
                )
            assert response.status_code == 403, response.json
            provider.get_dimensions.assert_not_called()
            provider.get_metrics.assert_not_called()
        finally:
            db.session.rollback()
            db.session.execute(
                sa.delete(Dashboard.__table__).where(Dashboard.id == dashboard_id)
            )
            db.session.delete(view)
            db.session.delete(layer)
            db.session.commit()

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_dashboard_filter_access_is_unchanged(self) -> None:
        """A guest can still use a dashboard-scoped semantic native filter."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(name="guest-metadata-layer", type="test")
        view: SemanticView = SemanticView(
            name="guest-metadata-view", semantic_layer=layer
        )
        db.session.add(view)
        db.session.flush()
        metadata: str = json.dumps(
            {
                "native_filter_configuration": [
                    {
                        "id": "filter-1",
                        "targets": [
                            {
                                "datasetId": view.id,
                                "datasourceType": "semantic_view",
                                "column": {"name": "category"},
                            }
                        ],
                    }
                ]
            }
        )
        dashboard_id: int = db.session.execute(
            sa.insert(Dashboard.__table__).values(
                dashboard_title="guest-metadata-dashboard",
                published=True,
                json_metadata=metadata,
            )
        ).inserted_primary_key[0]
        db.session.commit()
        provider: Mock = Mock()
        provider.get_dimensions.return_value = set()
        provider.get_metrics.return_value = set()
        provider.features = frozenset()
        provider.selection_identity_version = None
        provider.uid.return_value = "guest-metadata-view"
        try:
            with (
                patch.object(
                    SemanticView,
                    "implementation",
                    new_callable=PropertyMock,
                    return_value=provider,
                ),
                patch.object(security_manager, "is_guest_user", return_value=True),
                patch.object(security_manager, "has_guest_access", return_value=True),
            ):
                g.user.rls = []
                response: Response = self.client.post(
                    "/api/v1/chart/data",
                    json={
                        "datasource": {"id": view.id, "type": "semantic_view"},
                        "queries": [{"columns": [], "metrics": []}],
                        "result_type": "query",
                        "form_data": {
                            "dashboardId": dashboard_id,
                            "type": "NATIVE_FILTER",
                            "native_filter_id": "filter-1",
                        },
                    },
                )
            assert response.status_code == 200, response.json
            provider.get_dimensions.assert_called()
        finally:
            db.session.rollback()
            db.session.execute(
                sa.delete(Dashboard.__table__).where(Dashboard.id == dashboard_id)
            )
            db.session.delete(view)
            db.session.delete(layer)
            db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_dataset_chart_data_is_unchanged(self) -> None:
        """The semantic preflight does not affect SQL chart-data requests."""
        self.login("admin")
        dataset: SqlaTable | None = (
            db.session.query(SqlaTable).filter_by(table_name="birth_names").first()
        )
        assert dataset is not None
        response: Response = self.client.post(
            "/api/v1/chart/data",
            json={
                "datasource": {"id": dataset.id, "type": "table"},
                "queries": [{"columns": ["name"], "metrics": []}],
                "result_type": "query",
            },
        )
        assert response.status_code == 200, response.json
