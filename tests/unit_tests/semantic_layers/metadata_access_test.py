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

"""Enabled metadata preserves canonical chart-data authorization."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from flask import Flask
from flask_caching import Cache

from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.common.utils import query_cache_manager
from superset.constants import CacheRegion
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.security.manager import SupersetSecurityManager
from superset.semantic_layers.models import SemanticView
from superset.semantic_layers.registry import registry
from tests.unit_tests.semantic_layers.metadata_identity_test import (
    context_for,
    RefreshLayer,
    ResultView,
    view_for,
)


@pytest.mark.parametrize("principal", ["guest", "viewer", "editor", "denied"])
def test_enabled_chart_read_keeps_canonical_authorization(
    app: Flask, monkeypatch: pytest.MonkeyPatch, principal: str
) -> None:
    provider: ResultView = ResultView("scope:authorized", 17)
    view: SemanticView = view_for(provider)
    context: QueryContext
    query: QueryObject
    context, query = context_for(view)
    context.form_data = {
        "slice_id": 2,
        **({"dashboardId": 1} if principal == "guest" else {}),
    }
    chart: MagicMock = MagicMock()
    chart.datasource = view
    chart.datasource_id = view.id
    chart.datasource_type = view.type
    dashboard: MagicMock = MagicMock()
    dashboard.slices = [chart]
    sm: MagicMock = MagicMock(spec=SupersetSecurityManager)
    sm.can_access_all_datasources.return_value = False
    sm.can_access_schema.return_value = False
    sm.can_access.return_value = False
    sm._semantic_layer_grant_allows.return_value = False
    sm.is_editor.return_value = principal == "editor"
    sm.is_viewer.return_value = principal == "viewer"
    sm.is_guest_user.return_value = principal == "guest"
    sm.can_access_dashboard.return_value = principal == "guest"
    sm.get_current_guest_user_if_guest.return_value = None
    sm.get_rls_cache_key.return_value = []
    sm.session.query.side_effect = lambda model: MagicMock(
        **{
            "filter.return_value.one_or_none.return_value": dashboard
            if model is Dashboard
            else chart
        }
    )
    sm.raise_for_access.side_effect = (
        lambda **kwargs: SupersetSecurityManager.raise_for_access(sm, **kwargs)
    )
    construct: Mock = Mock(return_value=provider)
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.view_implementation", construct
    )
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    monkeypatch.setitem(app.config, "VIEWER_PROMISCUOUS_MODE", True)
    monkeypatch.setitem(app.config, "EXTRA_RAISE_FOR_ACCESS_BYPASS", None)
    monkeypatch.setitem(registry, "cache-test", RefreshLayer)
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    monkeypatch.setitem(query_cache_manager._cache, CacheRegion.DATA, cache)
    with (
        app.test_request_context(),
        patch("superset.is_feature_enabled", return_value=True),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch("superset.security_manager", sm),
        patch("superset.common.query_context_processor.security_manager", sm),
        patch("superset.security.manager.query_context_modified", return_value=False),
    ):
        if principal == "denied":
            with pytest.raises(SupersetSecurityException):
                context.raise_for_access()
            construct.assert_not_called()
            assert provider.calls == 0
        else:
            context.raise_for_access()
            payload: dict[str, Any] = context.get_df_payload(query)
            assert payload["df"].to_dict("list") == {"orders": [17]}
            assert provider.calls == 1


@pytest.mark.parametrize("warm", [False, True])
def test_factory_acquisition_precedes_denial_until_pr3_gate(
    app: Flask, monkeypatch: pytest.MonkeyPatch, warm: bool
) -> None:
    """Document the pre-enablement gap; PR3 must invert this acquisition oracle."""
    from superset.common.query_context_factory import QueryContextFactory
    from superset.semantic_layers.metadata import ScopedMetadataStore
    from superset.semantic_layers.metadata_binding import (
        operation_deadline,
        request_metadata_budget,
    )
    from tests.unit_tests.semantic_layers.metadata_contract_test import (
        OptedInLayer,
        SnapshotView,
    )
    from tests.unit_tests.semantic_layers.metadata_store_test import MemoryBackend

    view: SemanticView = view_for(ResultView("unused", 17))
    backend: MemoryBackend = MemoryBackend()
    provider: OptedInLayer = OptedInLayer()
    sm: MagicMock = MagicMock(spec=SupersetSecurityManager)
    sm.can_access_schema.return_value = False
    sm.can_access.return_value = False
    sm._semantic_layer_grant_allows.return_value = False
    sm.is_editor.return_value = False
    sm.is_guest_user.return_value = False
    sm.raise_for_access.side_effect = (
        lambda **kwargs: SupersetSecurityManager.raise_for_access(sm, **kwargs)
    )
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_NAMESPACE", "tenant")
    monkeypatch.setitem(app.config, "EXTRA_RAISE_FOR_ACCESS_BYPASS", None)
    monkeypatch.setitem(registry, "cache-test", OptedInLayer)
    execute: Mock
    resolve_store: Mock
    with (
        app.test_request_context(),
        patch("superset.is_feature_enabled", return_value=True),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.semantic_layers.metadata_binding.connection_store",
        ) as resolve_store,
        patch.object(OptedInLayer, "from_configuration", return_value=provider),
        patch(
            "superset.common.query_context_factory.DatasourceDAO.get_datasource",
            return_value=view,
        ),
        patch("superset.common.query_context_processor.security_manager", sm),
        patch.object(SnapshotView, "get_table") as execute,
    ):
        request_metadata_budget()
        store_deadline: float = operation_deadline()
        store: ScopedMetadataStore = ScopedMetadataStore(
            backend, "fixture", deadline=store_deadline
        )
        if warm:
            store.read(lambda deadline: '["orders"]', deadline=store_deadline)
        resolve_store.return_value = store
        context: QueryContext = QueryContextFactory().create(
            datasource={"id": 11, "type": "semantic_view"},
            queries=[{"metrics": ["orders"], "row_limit": 10}],
        )
        # This is an ordinary cold read, not an explicit refresh. It can publish
        # before chart authorization; warm observations do not fetch again.
        assert provider.adapter.fetches == (0 if warm else 1)
        assert store.peek() is not None
        with pytest.raises(SupersetSecurityException):
            context.raise_for_access()
        execute.assert_not_called()
