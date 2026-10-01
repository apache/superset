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

from unittest.mock import Mock, patch

import pytest
from flask import Flask

from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.semantic_layers.cache_inspection import CacheEntryInfo
from superset.semantic_layers.models import SemanticView
from superset.semantic_layers.registry import registry
from tests.unit_tests.semantic_layers.metadata_identity_test import (
    context_for,
    RefreshLayer,
    ResultView,
    view_for,
)


def test_result_inspection_keeps_query_rls_and_never_constructs_provider(
    app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    from superset.commands.semantic_layer.inspect_query_result import (
        InspectQueryResultCommand,
    )

    provider: ResultView = ResultView("unused", 17)
    view: SemanticView = view_for(provider)
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    monkeypatch.setitem(registry, "cache-test", RefreshLayer)
    context: QueryContext
    query: QueryObject
    context, query = context_for(view)
    manager: Mock = Mock()
    keys: list[str] = []
    inspect_entry: Mock
    construct: Mock
    rls: list[str]
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.commands.semantic_layer.inspect_query_result.security_manager",
            manager,
        ),
        patch("superset.semantic_layers.result_inspection.security_manager", manager),
        patch("superset.common.query_context_processor.security_manager", manager),
        patch(
            "superset.commands.semantic_layer.inspect_query_result.inspect_derived_entry"
        ) as inspect_entry,
        patch(
            "superset.semantic_layers.metadata_binding.view_implementation",
            return_value=provider,
        ) as construct,
    ):
        assert InspectQueryResultCommand(context, 0).run().state == "unsupported"
        construct.assert_not_called()
        for rls in (["rule-a"], ["rule-b"]):
            manager.get_rls_cache_key.return_value = rls
            key: str | None = context.query_cache_key(query)
            construct.reset_mock()
            InspectQueryResultCommand(context, 0).run()
            assert inspect_entry.call_args.args == (key, "query_result")
            keys.append(inspect_entry.call_args.args[0])
            construct.assert_not_called()
        assert keys[0] != keys[1]
        manager.get_rls_cache_key.return_value = ["revoked"]
        assert InspectQueryResultCommand(context, 0).run().state == "unsupported"
        manager.raise_for_access.side_effect = PermissionError("denied")
        inspect_entry.reset_mock()
        with pytest.raises(PermissionError):
            InspectQueryResultCommand(context, 0).run()
        inspect_entry.assert_not_called()

    # A new request cannot reuse identities kept by an earlier request, even
    # when an internal caller retains the same Python context object.
    with (
        app.test_request_context(),
        patch(
            "superset.commands.semantic_layer.inspect_query_result.security_manager",
            Mock(),
        ),
    ):
        assert InspectQueryResultCommand(context, 0).run().state == "unsupported"


def test_result_inspection_does_not_refill_after_concurrent_invalidation(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from superset.commands.semantic_layer.inspect_query_result import (
        InspectQueryResultCommand,
    )
    from superset.semantic_layers.metadata import ScopedMetadataStore
    from superset.semantic_layers.metadata_binding import (
        operation_deadline,
        request_metadata_budget,
    )
    from tests.unit_tests.semantic_layers.metadata_contract_test import OptedInLayer
    from tests.unit_tests.semantic_layers.metadata_store_test import MemoryBackend

    manager: Mock = Mock()
    provider: OptedInLayer = OptedInLayer()
    resolve_provider: Mock
    view: SemanticView = view_for(ResultView("unused", 17))
    context: QueryContext
    query: QueryObject
    context, query = context_for(view)
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    monkeypatch.setitem(
        app.config, "SEMANTIC_LAYER_METADATA_NAMESPACE", "inspection-test"
    )
    monkeypatch.setitem(registry, "cache-test", OptedInLayer)
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.commands.semantic_layer.inspect_query_result.security_manager",
            manager,
        ),
        patch(
            "superset.semantic_layers.metadata_binding.connection_store"
        ) as resolve_provider,
        patch(
            "superset.commands.semantic_layer.inspect_query_result.inspect_derived_entry"
        ),
        patch.object(OptedInLayer, "from_configuration", return_value=provider),
    ):
        manager.get_rls_cache_key.return_value = []
        request_metadata_budget()
        deadline: float = operation_deadline()
        store: ScopedMetadataStore = ScopedMetadataStore(
            MemoryBackend(), "inspection", deadline=deadline
        )
        store.read(lambda budget: '["orders"]', deadline=deadline)
        # Catalog was visible to the diagnostic, but another authorized caller
        # retired it before this request resolves the provider-defined uid.
        store.invalidate_catalog()
        resolve_provider.return_value = store
        result: CacheEntryInfo = InspectQueryResultCommand(context, 0).run()
        assert result.state == "unsupported"
        assert provider.adapter.fetches == 0
        resolve_provider.assert_not_called()


def test_result_capture_is_disabled_without_http_operation(app: Flask) -> None:
    from superset.semantic_layers.result_inspection import (
        capture_result_identity,
        captured_result_key,
    )

    view: SemanticView = view_for(ResultView("unused", 17))
    context: QueryContext
    query: QueryObject
    context, query = context_for(view)
    with app.app_context():
        capture_result_identity(context, query, "already-computed-key")
        assert captured_result_key(context, query) is None
