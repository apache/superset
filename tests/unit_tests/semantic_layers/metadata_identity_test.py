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
from datetime import datetime, timedelta
from typing import Any, cast
from unittest.mock import Mock, patch
from uuid import UUID

import pyarrow as pa
import pytest
from flask import Flask
from flask_caching import Cache
from superset_core.semantic_layers.metadata import MetadataRefreshErrorCategory
from superset_core.semantic_layers.types import Metric, SemanticQuery, SemanticResult

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.common.utils import query_cache_manager
from superset.connectors.sqla.models import BaseDatasource
from superset.constants import CacheRegion
from superset.explorables.base import Explorable
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


def context_for(view: Explorable) -> tuple[QueryContext, QueryObject]:
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

    from superset.semantic_layers.metadata import ScopedMetadataStore
    from superset.semantic_layers.metadata_binding import request_metadata_budget
    from tests.unit_tests.semantic_layers.metadata_store_test import (
        Clock,
        MemoryBackend,
    )

    clock: Clock = Clock()
    store: ScopedMetadataStore = ScopedMetadataStore(
        MemoryBackend(clock), "scope", deadline=130, clock=clock
    )
    provider: ResultView = ResultView(
        store.read(lambda deadline: "{}", deadline=130).cache_token, 17
    )
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.connection_store",
        lambda layer: store,
    )
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


@pytest.mark.parametrize("capture_source", [False, True])
@pytest.mark.parametrize("source_type", ["line", "table"])
@pytest.mark.parametrize("refresh_enabled", [False, True])
@pytest.mark.parametrize("refresh_during_query", [False, True])
@pytest.mark.parametrize("failure", [None, "upstream", "deadline", "unavailable"])
def test_sql_parent_cache_changes_with_semantic_annotation_observation(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    source_type: str,
    capture_source: bool,
    refresh_enabled: bool,
    refresh_during_query: bool,
    failure: MetadataRefreshErrorCategory | None,
) -> None:
    """A warm SQL chart cannot retain annotations from an older catalog."""
    import time

    import pandas as pd
    from flask import request
    from superset_core.semantic_layers.metadata import (
        CatalogSnapshot,
        MetadataRefreshError,
    )

    from superset.common.query_context_processor import QueryContextProcessor
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.helpers import QueryResult
    from superset.models.slice import Slice
    from superset.semantic_layers.metadata import ScopedMetadataStore
    from superset.semantic_layers.metadata_binding import request_metadata_budget
    from tests.unit_tests.semantic_layers.metadata_store_test import MemoryBackend

    parent: SqlaTable = SqlaTable(
        id=12,
        table_name="parent",
        changed_on=datetime(2026, 1, 1),
        columns=[TableColumn(column_name="orders")],
        cache_timeout=300,
    )
    monkeypatch.setattr(SqlaTable, "get_extra_cache_keys", lambda self, query: [])
    monkeypatch.setattr(SemanticView, "raise_for_access", lambda self: None)
    provider: Mock = Mock()
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.layer_implementation",
        lambda layer: provider,
    )
    deadline: float = time.monotonic() + 30
    store: ScopedMetadataStore = ScopedMetadataStore(
        MemoryBackend(), "scope", deadline=deadline
    )
    snapshot: CatalogSnapshot = store.read(lambda deadline: "{}", deadline=deadline)
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.connection_store",
        lambda layer: store,
    )
    monkeypatch.setitem(
        app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", refresh_enabled
    )
    monkeypatch.setitem(registry, "cache-test", RefreshLayer)
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    monkeypatch.setitem(query_cache_manager._cache, CacheRegion.DATA, cache)
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_NAMESPACE", "test")
    source: SemanticView = view_for(ResultView(snapshot.cache_token, 17))
    source.__dict__["_legacy_implementation"] = source.__dict__[
        "_fixture_implementation"
    ]
    provider.get_semantic_view.return_value = source.__dict__["_fixture_implementation"]
    chart: Slice = Slice(
        id=31,
        datasource_id=source.id,
        datasource_type="semantic_view",
        semantic_view=source,
    )
    assert chart.datasource is None
    assert chart.resolved_datasource is source
    rls: Mock
    cache_write: Mock
    if not capture_source:
        monkeypatch.setattr(store, "peek", lambda: None)
    rotated: bool = False

    def annotations(self: QueryContextProcessor, query: QueryObject) -> dict[str, Any]:
        nonlocal rotated
        if not capture_source:
            # Model an annotation query that does not acquire the keyed view.
            return {"semantic": {"orders": [17]}}
        if refresh_enabled and refresh_during_query and not rotated:
            # Publication between the host lookup and annotation acquisition.
            rotated = True
            newer: CatalogSnapshot = store.refresh(
                lambda deadline: '{"raced": true}', deadline=deadline
            ).snapshot
            provider.get_semantic_view.return_value = ResultView(newer.cache_token, 17)
        return {
            "semantic": source.implementation.get_table(
                SemanticQuery(metrics=[], dimensions=[])
            ).results.to_pydict()
        }

    monkeypatch.setattr(QueryContextProcessor, "get_annotation_data", annotations)
    with (
        app.test_request_context(),
        patch.object(cache, "set", wraps=cache.set) as cache_write,
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch("superset.common.query_context_processor.get_user_id", return_value=1),
        patch(
            "superset.common.query_context_processor.ChartDAO.find_by_id",
            return_value=chart,
        ),
        patch(
            "superset.common.query_context_processor.security_manager.get_rls_cache_key",
            return_value=[],
        ) as rls,
        patch.object(
            QueryContextProcessor,
            "get_query_result",
            return_value=QueryResult(
                df=pd.DataFrame({"orders": [1]}),
                query="SELECT orders FROM parent",
                duration=timedelta(0),
            ),
        ),
    ):
        request_metadata_budget()
        context: QueryContext
        query: QueryObject
        context, query = context_for(parent)
        query.annotation_layers = [
            {"sourceType": source_type, "value": 31, "name": "semantic"}
        ]
        first: dict[str, Any] = context.get_df_payload(query)
        assert first["annotation_data"] == {"semantic": {"orders": [17]}}
        if not capture_source:
            assert first["df"]["orders"].tolist() == [1]
            assert context.get_df_payload(query)["is_cached"] is not refresh_enabled
            if refresh_enabled:
                cache_write.assert_not_called()
            else:
                cache_write.assert_called_once()
            return
        assert context.get_df_payload(query)["is_cached"]
        # Start a new HTTP operation: the provider must not be touched on a hit.
        from superset.semantic_layers import metadata_binding

        request.environ.pop(metadata_binding._OPERATION_KEY, None)
        request_metadata_budget()
        provider.get_semantic_view.reset_mock()
        if failure is not None:
            provider.get_semantic_view.side_effect = MetadataRefreshError(failure)
        assert context.get_df_payload(query)["is_cached"]
        provider.get_semantic_view.assert_not_called()
        if not refresh_enabled:
            return
        provider.get_semantic_view.side_effect = None
        snapshot = store.refresh(
            lambda deadline: '{"new": true}', deadline=deadline
        ).snapshot
        source = view_for(ResultView(snapshot.cache_token, 23))
        provider.get_semantic_view.return_value = source.__dict__[
            "_fixture_implementation"
        ]
        chart.semantic_view = source
        second: dict[str, Any] = context.get_df_payload(query)
        assert not second["is_cached"]
        assert second["annotation_data"] == {"semantic": {"orders": [23]}}
        assert first["cache_key"] != second["cache_key"]
        store.refresh(lambda deadline: '{"newer": true}', deadline=deadline)
        assert context.get_df_payload(query)["cache_key"] == second["cache_key"]
        assert context.get_df_payload(query)["is_cached"]
        assert rls.call_args_list
        assert all(call.args[0] is parent for call in rls.call_args_list)


@pytest.mark.parametrize("state", ["missing", "expired", "backend_error", "deadline"])
def test_annotation_unknown_snapshot_never_reuses_a_key(
    app: Flask, monkeypatch: pytest.MonkeyPatch, state: str
) -> None:
    """Unknown metadata must miss both warmed and previous failed-read keys."""
    from redis.exceptions import ConnectionError as RedisConnectionError
    from superset_core.semantic_layers.metadata import CatalogSnapshot

    from superset.common.query_context_processor import QueryContextProcessor
    from superset.models.slice import Slice
    from superset.semantic_layers.metadata import ScopedMetadataStore
    from superset.semantic_layers.metadata_binding import request_metadata_budget
    from tests.unit_tests.semantic_layers.metadata_store_test import (
        Clock,
        MemoryBackend,
    )

    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=130, clock=clock
    )
    snapshot: CatalogSnapshot = store.read(lambda deadline: "{}", deadline=130)
    source: SemanticView = view_for(ResultView(snapshot.cache_token, 17))
    chart: Slice = Slice(
        id=31,
        datasource_id=source.id,
        datasource_type="semantic_view",
        semantic_view=source,
    )
    query: QueryObject = QueryObject(
        annotation_layers=[
            {"sourceType": "line", "value": 31, "annotationType": "TIME_SERIES"}
        ]
    )
    processor: QueryContextProcessor = QueryContextProcessor(Mock())
    provider: Mock = Mock(return_value=source.__dict__["_fixture_implementation"])
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.view_implementation", provider
    )
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.connection_store",
        lambda layer: store,
    )
    monkeypatch.setitem(registry, "cache-test", RefreshLayer)
    with (
        app.test_request_context(),
        patch.dict(
            app.config,
            {
                "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
                "SEMANTIC_LAYER_METADATA_NAMESPACE": "test",
            },
        ),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.common.query_context_processor.ChartDAO.find_by_id",
            return_value=chart,
        ),
        patch("superset.common.query_context_processor.get_user_id", return_value=1),
    ):
        request_metadata_budget()
        warm: dict[str, Any] = processor._annotation_cache_context(query)
        if state == "missing":
            backend.entries.clear()
        elif state == "expired":
            clock.advance(301)
            store = ScopedMetadataStore(
                backend, "scope", deadline=clock() + 30, clock=clock
            )
        elif state == "deadline":
            clock.advance(31)
        else:
            monkeypatch.setattr(
                backend, "get", Mock(side_effect=RedisConnectionError())
            )
        first: dict[str, Any] = processor._annotation_cache_context(query)
        second: dict[str, Any] = processor._annotation_cache_context(query)
        assert first != warm
        assert second != first
        assert "source_metadata" in first
        provider.assert_not_called()


@pytest.mark.parametrize("refreshed", [False, True])
@pytest.mark.parametrize("force", [False, True])
def test_async_totals_reuse_only_the_captured_catalog_cache(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    refreshed: bool,
    force: bool,
) -> None:
    """Warm T0 totals, then normalize and cache the dependent using T0 or T1."""
    from superset.tasks.async_queries import _inject_contribution_totals

    monkeypatch.setattr(SemanticView, "raise_for_access", lambda self: None)
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.view_implementation",
        lambda view: view.__dict__["_fixture_implementation"],
    )
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    monkeypatch.setitem(registry, "cache-test", RefreshLayer)
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    monkeypatch.setitem(query_cache_manager._cache, CacheRegion.DATA, cache)
    old: ResultView = ResultView("scope:old", 20)
    captured: ResultView = ResultView("scope:new", 40) if refreshed else old
    with (
        app.test_request_context(),
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
        totals_context: QueryContext
        totals_query: QueryObject
        totals_context, totals_query = context_for(view_for(captured))
        totals_context.force = force
        main_context: QueryContext
        main_query: QueryObject
        main_context, main_query = context_for(view_for(captured))
        main_query.post_processing = [
            {"operation": "contribution", "options": {"columns": ["orders"]}}
        ]
        _inject_contribution_totals(
            main_query, old_payload["cache_key"], totals_context
        )
        assert main_query.post_processing[0]["options"]["contribution_totals"] == {
            "orders": 40 if refreshed else 20,
        }
        # The unchanged observation reads warmed totals without querying again.
        assert old.calls == 1
        assert captured.calls == 1
        result: dict[str, Any] = main_context.get_df_payload(main_query)
        assert result["df"].to_dict("list") == {"orders": [1.0]}
        assert main_context.get_df_payload(main_query)["is_cached"]


@pytest.mark.parametrize("source_type", ["table", "semantic_view"])
def test_annotation_rls_context_retains_table_only_contract(
    app: Flask,
    source_type: str,
) -> None:
    """Flag-off metadata keeps existing keys and never sends a view to SQL RLS."""
    from superset.common.query_context_processor import QueryContextProcessor
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    table: SqlaTable = SqlaTable(id=12, table_name="source")
    chart: Slice = Slice(id=31, datasource_id=12, datasource_type=source_type)
    if source_type == "table":
        chart.table = table
    else:
        chart.semantic_view = view_for(ResultView("scope:old", 17))
        chart.datasource_id = chart.semantic_view.id
    query: QueryObject = QueryObject(
        annotation_layers=[
            {"sourceType": "line", "value": 31, "annotationType": "TIME_SERIES"}
        ],
    )
    processor: QueryContextProcessor = QueryContextProcessor(Mock())
    rls: Mock
    with (
        app.test_request_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": False}),
        patch("superset.common.query_context_processor.get_user_id", return_value=7),
        patch(
            "superset.common.query_context_processor.ChartDAO.find_by_id",
            return_value=chart,
        ),
        patch(
            "superset.common.query_context_processor.security_manager.get_rls_cache_key",
            return_value=["rls"],
        ) as rls,
    ):
        assert processor._annotation_cache_context(query) == {
            "user_id": 7,
            "source_rls": {"31": ["rls"] if source_type == "table" else None},
        }
        if source_type == "table":
            rls.assert_called_once_with(table)
        else:
            rls.assert_not_called()


@pytest.mark.parametrize("denied", [False, True])
def test_semantic_annotation_is_captured_before_slow_sql_parent(
    app: Flask, monkeypatch: pytest.MonkeyPatch, denied: bool
) -> None:
    """Only a miss captures authorized annotations before warehouse execution."""
    import pandas as pd
    from superset_core.semantic_layers.metadata import CatalogSnapshot

    from superset.common.query_context_processor import QueryContextProcessor
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.exceptions import QueryObjectValidationError
    from superset.models.helpers import QueryResult
    from superset.models.slice import Slice
    from superset.semantic_layers.metadata import ScopedMetadataStore
    from superset.semantic_layers.metadata_binding import request_metadata_budget
    from tests.unit_tests.semantic_layers.metadata_store_test import (
        Clock,
        MemoryBackend,
    )

    clock: Clock = Clock()
    store: ScopedMetadataStore = ScopedMetadataStore(
        MemoryBackend(clock), "scope", deadline=130, clock=clock
    )
    snapshot: CatalogSnapshot = store.read(lambda deadline: "{}", deadline=130)
    source: SemanticView = view_for(ResultView(snapshot.cache_token, 17))
    provider: Mock = Mock()
    provider.get_semantic_view.return_value = source.__dict__["_fixture_implementation"]
    parent: SqlaTable = SqlaTable(
        id=12,
        table_name="parent",
        changed_on=datetime(2026, 1, 1),
        columns=[TableColumn(column_name="orders")],
        cache_timeout=300,
    )
    chart: Slice = Slice(
        id=31,
        datasource_id=source.id,
        datasource_type="semantic_view",
        semantic_view=source,
    )
    annotation_context: Mock = Mock(spec=QueryContext, datasource=source)
    if denied:
        annotation_context.raise_for_access.side_effect = QueryObjectValidationError(
            "denied annotation"
        )
    monkeypatch.setattr(Slice, "get_query_context", lambda self: annotation_context)
    monkeypatch.setattr(SqlaTable, "get_extra_cache_keys", lambda self, query: [])
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.connection_store",
        lambda layer: store,
    )
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.layer_implementation",
        lambda layer: provider,
    )
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.time.monotonic", clock
    )
    monkeypatch.setattr(
        "superset.semantic_layers.metadata_binding.is_feature_enabled",
        lambda flag: True,
    )
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_NAMESPACE", "tenant")
    monkeypatch.setitem(registry, "cache-test", RefreshLayer)
    cache: Cache = Cache(app, config={"CACHE_TYPE": "SimpleCache"})
    monkeypatch.setitem(query_cache_manager._cache, CacheRegion.DATA, cache)
    parent_calls: list[str] = []

    def slow_parent(self: QueryContextProcessor, query: QueryObject) -> QueryResult:
        parent_calls.append("parent")
        clock.advance(31)
        return QueryResult(
            df=pd.DataFrame({"orders": [1]}),
            query="SELECT orders",
            duration=timedelta(seconds=31),
        )

    def annotations(self: QueryContextProcessor, query: QueryObject) -> dict[str, Any]:
        return {
            "semantic": source.implementation.get_table(
                SemanticQuery(metrics=[], dimensions=[])
            ).results.to_pydict()
        }

    monkeypatch.setattr(QueryContextProcessor, "get_query_result", slow_parent)
    monkeypatch.setattr(QueryContextProcessor, "get_annotation_data", annotations)
    with (
        app.test_request_context(),
        patch("superset.common.query_context_processor.get_user_id", return_value=1),
        patch(
            "superset.common.query_context_processor.ChartDAO.find_by_id",
            return_value=chart,
        ),
        patch(
            "superset.common.query_context_processor.security_manager.get_rls_cache_key",
            return_value=[],
        ),
    ):
        request_metadata_budget()
        context: QueryContext
        query: QueryObject
        context, query = context_for(parent)
        query.annotation_layers = [
            {"sourceType": "line", "value": 31, "name": "semantic"}
        ]
        result: dict[str, Any] = context.get_df_payload(query)
        if denied:
            assert result["error"] == "denied annotation"
            assert parent_calls == []
            provider.get_semantic_view.assert_not_called()
            return
        assert clock() == 131
        assert result["annotation_data"] == {"semantic": {"orders": [17]}}
        assert context.get_df_payload(query)["is_cached"]
        assert parent_calls == ["parent"]
        provider.get_semantic_view.assert_called_once()
        annotation_context.raise_for_access.assert_called_once()
