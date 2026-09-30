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

"""Exercise metadata identity through the real QueryContext result cache."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Any, cast
from unittest.mock import patch
from uuid import UUID

import pyarrow as pa
import pytest
from flask import Flask
from flask_caching import Cache
from superset_core.semantic_layers.types import Metric, SemanticQuery, SemanticResult

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.common.utils import query_cache_manager
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import CacheRegion
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from tests.unit_tests.semantic_layers.metadata_contract_test import (
    LegacyLayer,
    LegacyView,
)


class ResultView(LegacyView):
    def __init__(self, token: str, value: int) -> None:
        self.token: str = token
        self.value: int = value
        self.calls: int = 0

    @property
    def metadata_cache_token(self) -> str:
        return self.token

    def get_metrics(self) -> set[Metric]:
        return {Metric("orders", "orders", pa.int64(), "orders")}

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        self.calls += 1
        return SemanticResult([], pa.table({"orders": [self.value]}))


class RefreshLayer(LegacyLayer):
    @classmethod
    def supports_metadata_refresh(cls, configuration: dict[str, Any]) -> bool:
        return True


def view_for(provider: ResultView) -> SemanticView:
    layer: SemanticLayer = SemanticLayer(
        uuid=UUID("00000000-0000-0000-0000-000000000011"),
        type="cache-test",
        configuration="{}",
    )
    view: SemanticView = SemanticView(
        id=11,
        uuid=UUID("00000000-0000-0000-0000-000000000012"),
        name="orders",
        configuration="{}",
        semantic_layer=layer,
        changed_on=datetime(2026, 1, 1),
        cache_timeout=300,
    )
    view.__dict__["_fixture_implementation"] = provider
    return view


def context_for(view: SemanticView) -> tuple[QueryContext, QueryObject]:
    query: QueryObject = QueryObject(
        datasource=cast(BaseDatasource, view), metrics=["orders"], row_limit=10
    )
    context: QueryContext = QueryContext(
        datasource=view,
        queries=[query],
        slice_=None,
        form_data=None,
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        cache_values={},
    )
    return context, query


def test_same_name_and_discovery_after_refresh_cannot_reuse_old_query_result(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(SemanticView, "raise_for_access", lambda self: None)
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.view_implementation",
        lambda view: view.__dict__["_fixture_implementation"],
    )
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    monkeypatch.setitem(query_cache_manager._cache, CacheRegion.DATA, cache)
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    monkeypatch.setitem(registry, "cache-test", RefreshLayer)
    old: ResultView = ResultView("scope:old", 17)
    new: ResultView = ResultView("scope:new", 23)
    with (
        app.test_request_context(),
        patch("superset.is_feature_enabled", return_value=True),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.common.query_context_processor.security_manager.get_rls_cache_key",
            return_value=[],
        ),
    ):
        old_context: QueryContext
        old_query: QueryObject
        old_context, old_query = context_for(view_for(old))
        old_payload: dict[str, Any] = old_context.get_df_payload(old_query)
        assert old_payload["df"].to_dict("list") == {"orders": [17]}
        assert old.calls == 1
        assert old_context.get_df_payload(old_query)["is_cached"]
        new_context: QueryContext
        new_query: QueryObject
        new_context, new_query = context_for(view_for(new))
        new_payload: dict[str, Any] = new_context.get_df_payload(new_query)
        assert new_payload["df"].to_dict("list") == {"orders": [23]}
        assert not new_payload["is_cached"]
        assert new.calls == 1
        assert old_context.query_cache_key(old_query) != new_context.query_cache_key(
            new_query
        )
        # A held old observation still labels its own result with the old identity.
        assert old_context.get_df_payload(old_query)["df"].to_dict("list") == {
            "orders": [17]
        }


def test_captured_view_survives_a_long_first_query(
    app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    from unittest.mock import Mock

    from superset.semantic_layers.metadata_binding import request_metadata_budget
    from tests.unit_tests.semantic_layers.metadata_store_test import Clock

    clock: Clock = Clock()
    provider: ResultView = ResultView("scope:captured", 17)
    view: SemanticView = view_for(provider)
    layer: Mock = Mock()
    layer.get_semantic_view.return_value = provider
    original: Callable[[SemanticQuery], SemanticResult] = provider.get_table

    def slow_query(query: SemanticQuery) -> SemanticResult:
        result: SemanticResult = original(query)
        clock.advance(31)
        return result

    monkeypatch.setattr(provider, "get_table", slow_query)
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.layer_implementation",
        lambda connection: layer,
    )
    monkeypatch.setattr(SemanticView, "raise_for_access", lambda self: None)
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_NAMESPACE", "tenant")
    monkeypatch.setitem(registry, "cache-test", RefreshLayer)
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    monkeypatch.setitem(query_cache_manager._cache, CacheRegion.DATA, cache)
    with (
        app.test_request_context(),
        patch("superset.semantic_layers.metadata_binding.time.monotonic", clock),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.common.query_context_processor.security_manager.get_rls_cache_key",
            return_value=[],
        ),
    ):
        request_metadata_budget()
        context: QueryContext
        query: QueryObject
        context, query = context_for(view)
        assert context.get_df_payload(query)["df"].to_dict("list") == {"orders": [17]}
        assert clock() > 130
        assert context.get_df_payload(query)["is_cached"]
        assert view.data["metrics"][0]["metric_name"] == "orders"
        layer.get_semantic_view.assert_called_once()
