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
from typing import Any, Literal
from unittest.mock import Mock, patch, PropertyMock

import pytest
import sqlalchemy as sa
from flask import current_app, g, Response

from superset.common.query_context import QueryContext
from superset.connectors.sqla.models import SqlaTable
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, security_manager
from superset.models.dashboard import Dashboard
from superset.security.manager import SupersetSecurityManager
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

    def test_denied_legacy_query_api_skips_provider_metadata(self) -> None:
        """The legacy ``/api/v1/query/`` route also denies before metadata."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(name="legacy-metadata-layer", type="test")
        view: SemanticView = SemanticView(
            name="legacy-metadata-view", semantic_layer=layer
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
                    "/api/v1/query/",
                    data={
                        "query_context": json.dumps(
                            {
                                "datasource": {
                                    "id": view.id,
                                    "type": "semantic_view",
                                },
                                "queries": [{"columns": [], "metrics": []}],
                            }
                        )
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

        access_spy: Mock
        try:
            with (
                patch.object(
                    SemanticView,
                    "implementation",
                    new_callable=PropertyMock,
                    return_value=provider,
                ),
                patch.object(security_manager, "can_access", side_effect=can_access),
                patch.object(
                    QueryContext,
                    "raise_for_access",
                    autospec=True,
                    side_effect=QueryContext.raise_for_access,
                ) as access_spy,
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
            # The preflight and the final check each decide on a query context.
            assert access_spy.call_count == 2
        finally:
            db.session.rollback()
            db.session.delete(view)
            db.session.delete(layer)
            db.session.commit()

    def test_payload_based_access_bypass_still_sees_queries(self) -> None:
        """An operator bypass hook keeps receiving the request's real queries."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(name="bypass-metadata-layer", type="test")
        view: SemanticView = SemanticView(
            name="bypass-metadata-view", semantic_layer=layer
        )
        db.session.add(view)
        db.session.commit()
        provider: Mock = Mock()
        provider.get_dimensions.return_value = set()
        provider.get_metrics.return_value = set()

        def bypass(**kwargs: object) -> bool:
            """Grant only when the request's queries are visible to the hook."""
            query_context: object = kwargs["query_context"]
            return bool(getattr(query_context, "queries", None))

        try:
            with (
                patch.dict(
                    current_app.config, {"EXTRA_RAISE_FOR_ACCESS_BYPASS": bypass}
                ),
                patch.object(
                    SemanticView,
                    "implementation",
                    new_callable=PropertyMock,
                    return_value=provider,
                ),
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
        finally:
            db.session.rollback()
            db.session.delete(view)
            db.session.delete(layer)
            db.session.commit()

    def test_overridden_access_check_still_sees_queries(self) -> None:
        """A custom security manager's raise_for_access keeps receiving the
        request's real queries, so the preflight does not run for it."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(
            name="override-metadata-layer", type="test"
        )
        view: SemanticView = SemanticView(
            name="override-metadata-view", semantic_layer=layer
        )
        db.session.add(view)
        db.session.commit()
        provider: Mock = Mock()
        provider.get_dimensions.return_value = set()
        provider.get_metrics.return_value = set()
        manager: SupersetSecurityManager = security_manager._get_current_object()  # noqa: SLF001
        stock_class: type[SupersetSecurityManager] = type(manager)
        original_can_access: Callable[[str, str], bool] = security_manager.can_access

        class QueryCheckingSecurityManager(stock_class):  # type: ignore[valid-type, misc]
            """Authorizes per requested query, like a column or metric check."""

            def raise_for_access(self, **kwargs: Any) -> None:
                query_context: QueryContext | None = kwargs.get("query_context")
                if query_context is not None and not query_context.queries:
                    raise SupersetSecurityException(
                        SupersetError(
                            message="No requested queries to authorize",
                            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                            level=ErrorLevel.ERROR,
                        )
                    )
                super().raise_for_access(**kwargs)

        def can_access(permission_name: str, view_name: str) -> bool:
            """Give Gamma this view's datasource grant for the request."""
            if permission_name == "datasource_access" and view_name == view.perm:
                return True
            return original_can_access(permission_name, view_name)

        # patch.object cannot restore __class__, so swap and restore it here.
        manager.__class__ = QueryCheckingSecurityManager
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
        finally:
            manager.__class__ = stock_class
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

    @with_feature_flags(ENABLE_VIEWERS=True)
    def test_allowed_viewer_filter_forwards_form_data(self) -> None:
        """A dashboard-only native filter grant survives the metadata preflight."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(
            name="allowed-viewer-metadata-layer", type="test"
        )
        view: SemanticView = SemanticView(
            name="allowed-viewer-metadata-view", semantic_layer=layer
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
                            }
                        ],
                    }
                ]
            }
        )
        dashboard_id: int = db.session.execute(
            sa.insert(Dashboard.__table__).values(
                dashboard_title="allowed-viewer-metadata-dashboard",
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
        provider.uid.return_value = "allowed-viewer-metadata-view"
        access_spy: Mock
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
                patch.object(
                    QueryContext,
                    "raise_for_access",
                    autospec=True,
                    side_effect=QueryContext.raise_for_access,
                ) as access_spy,
            ):
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
            assert access_spy.call_count == 2
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

    def test_instance_wrapped_access_check_still_sees_queries(self) -> None:
        """An instance wrapper receives only the completed query context."""
        self._assert_wrapped_access_check_still_sees_queries("instance")

    def test_class_wrapped_access_check_still_sees_queries(self) -> None:
        """A reassigned base-class method receives only the completed context."""
        self._assert_wrapped_access_check_still_sees_queries("class")

    def _assert_wrapped_access_check_still_sees_queries(
        self, override_target: Literal["instance", "class"]
    ) -> None:
        """Instance and base-class wrappers receive only the completed context."""
        self.login("gamma")
        layer: SemanticLayer = SemanticLayer(name="wrapped-metadata-layer", type="test")
        view: SemanticView = SemanticView(
            name="wrapped-metadata-view", semantic_layer=layer
        )
        db.session.add(view)
        db.session.commit()
        provider: Mock = Mock()
        provider.get_dimensions.return_value = set()
        provider.get_metrics.return_value = set()
        manager: SupersetSecurityManager = security_manager._get_current_object()  # noqa: SLF001
        original_check: Callable[..., None] = manager.raise_for_access
        original_can_access: Callable[[str, str], bool] = manager.can_access
        query_counts: list[int] = []

        def wrapped_access(**kwargs: Any) -> None:
            """Model a configured wrapper that inspects the first requested query."""
            context: QueryContext | None = kwargs.get("query_context")
            if context is not None:
                query_counts.append(len(context.queries))
                assert context.queries[0] is not None
            original_check(**kwargs)

        def class_wrapped_access(
            manager_self: SupersetSecurityManager, **kwargs: Any
        ) -> None:
            """Bind the configured base-class wrapper like an ordinary method."""
            assert manager_self is manager
            wrapped_access(**kwargs)

        def can_access(permission_name: str, view_name: str) -> bool:
            """Grant Gamma this semantic datasource for the request."""
            if permission_name == "datasource_access" and view_name == view.perm:
                return True
            return original_can_access(permission_name, view_name)

        target: SupersetSecurityManager | type[SupersetSecurityManager] = (
            manager if override_target == "instance" else SupersetSecurityManager
        )
        replacement: Callable[..., None] = (
            wrapped_access if override_target == "instance" else class_wrapped_access
        )
        try:
            with (
                patch.object(target, "raise_for_access", replacement),
                patch.object(manager, "can_access", side_effect=can_access),
                patch.object(
                    SemanticView,
                    "implementation",
                    new_callable=PropertyMock,
                    return_value=provider,
                ),
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
            assert query_counts == [1]
        finally:
            db.session.rollback()
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
        access_spy: Mock
        with patch.object(
            QueryContext,
            "raise_for_access",
            autospec=True,
            side_effect=QueryContext.raise_for_access,
        ) as access_spy:
            response: Response = self.client.post(
                "/api/v1/chart/data",
                json={
                    "datasource": {"id": dataset.id, "type": "table"},
                    "queries": [{"columns": ["name"], "metrics": []}],
                    "result_type": "query",
                },
            )
        assert response.status_code == 200, response.json
        # Admin passes either way, so pin that a SQL dataset gets no preflight.
        assert access_spy.call_count == 1
