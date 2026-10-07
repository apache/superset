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

from typing import Any
from unittest.mock import Mock, patch

import numpy as np
import pytest
from flask import Flask, g

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


@pytest.mark.parametrize("total", [np.float32(12.5), np.int32(12)])
def test_result_capture_excludes_runtime_contribution_totals(
    app: Flask, monkeypatch: pytest.MonkeyPatch, total: Any
) -> None:
    """Diagnostic capture shares the query key's runtime-total exclusion."""
    from superset.semantic_layers.result_inspection import captured_result_key

    provider: ResultView = ResultView("captured", 17)
    context: QueryContext
    query: QueryObject
    context, query = context_for(view_for(provider))
    options: dict[str, Any] = {"columns": ["orders"], "contribution_totals": total}
    rename_options: dict[str, Any] = {"columns": {"orders": "Order count"}}
    query.post_processing = [
        {"operation": "contribution", "options": options},
        {"operation": "rename", "options": rename_options},
    ]
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", True)
    manager: Mock = Mock()
    manager.get_rls_cache_key.return_value = []
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_binding.participates", return_value=True
        ),
        patch(
            "superset.semantic_layers.result_inspection.metadata_refresh_enabled",
            return_value=True,
        ),
        patch(
            "superset.semantic_layers.metadata_binding.view_implementation",
            return_value=provider,
        ),
        patch("superset.semantic_layers.result_inspection.security_manager", manager),
        patch("superset.common.query_context_processor.security_manager", manager),
    ):
        key: str | None = context.query_cache_key(query)
        assert key is not None
        assert captured_result_key(context, query) == key
        assert options["contribution_totals"] is total
        options["contribution_totals"] = np.float32(99.5)
        assert captured_result_key(context, query) == key
        assert rename_options == {"columns": {"orders": "Order count"}}
        rename_options["columns"] = {"orders": "Renamed count"}
        assert captured_result_key(context, query) is None
        rename_options["columns"] = {"orders": "Order count"}
        assert captured_result_key(context, query) == key
        options["columns"] = ["revenue"]
        assert captured_result_key(context, query) is None


@pytest.mark.parametrize("changed", ["subject", "query"])
def test_result_capture_rejects_changed_subject_or_query(
    app: Flask, changed: str
) -> None:
    """A captured key never survives a subject or query edit with unchanged RLS."""
    from superset.semantic_layers.result_inspection import (
        capture_result_identity,
        captured_result_key,
    )

    context: QueryContext
    query: QueryObject
    context, query = context_for(view_for(ResultView("captured", 17)))
    manager: Mock = Mock()
    manager.get_rls_cache_key.return_value = ["unchanged-rule"]
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.result_inspection.metadata_refresh_enabled",
            return_value=True,
        ),
        patch("superset.semantic_layers.result_inspection.security_manager", manager),
    ):
        g.user = Mock(id=1)
        capture_result_identity(context, query, "existing-key")
        assert captured_result_key(context, query) == "existing-key"
        if changed == "subject":
            g.user = Mock(id=2)
        else:
            query.metrics = ["revenue"]
        assert captured_result_key(context, query) is None


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

        # Keep the feature and the same subject/RLS enabled in the next request.
        # Only request-local capture expiry should prevent reading the old key.
        manager.raise_for_access.side_effect = None
        manager.get_rls_cache_key.return_value = ["rule-b"]
        inspect_entry.reset_mock()
        with app.test_request_context():
            assert InspectQueryResultCommand(context, 0).run().state == "unsupported"
            inspect_entry.assert_not_called()


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
    inspect_entry: Mock
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
        ) as inspect_entry,
        patch("superset.semantic_layers.result_inspection.security_manager", manager),
        patch("superset.common.query_context_processor.security_manager", manager),
        patch.object(OptedInLayer, "from_configuration", return_value=provider),
    ):
        manager.get_rls_cache_key.return_value = []
        request_metadata_budget()
        deadline: float = operation_deadline()
        store: ScopedMetadataStore = ScopedMetadataStore(
            MemoryBackend(), "inspection", deadline=deadline
        )
        store.read(lambda budget: '["orders"]', deadline=deadline)
        resolve_provider.return_value = store
        key: str | None = context.query_cache_key(query)
        assert key is not None
        resolve_provider.assert_called()
        resolve_provider.reset_mock()
        # The normal query captured its key before another caller retired the
        # catalog. Inspection must use that key without resolving a new uid.
        store.invalidate_catalog()
        result: CacheEntryInfo = InspectQueryResultCommand(context, 0).run()
        assert result is inspect_entry.return_value
        inspect_entry.assert_called_once_with(key, "query_result")
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


@pytest.mark.parametrize(
    "enabled,annotated", [(False, False), (True, True), (True, False)]
)
def test_result_capture_guard_prevents_fingerprinting_excluded_queries(
    app: Flask, monkeypatch: pytest.MonkeyPatch, enabled: bool, annotated: bool
) -> None:
    """Flag-off and annotated queries do no capture or fingerprint work."""
    from flask import request

    from superset.semantic_layers import result_inspection as module

    view: SemanticView = view_for(ResultView("unused", 17))
    context: QueryContext
    query: QueryObject
    context, query = context_for(view)
    if annotated:
        query.annotation_layers = [
            {"sourceType": "NATIVE", "name": "notes", "value": 1}
        ]
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED", enabled)
    fingerprint: Mock
    with (
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch.object(module, "_fingerprint", return_value="fingerprint") as fingerprint,
    ):
        module.capture_result_identity(context, query, "computed-key")
        if enabled and not annotated:
            fingerprint.assert_called_once_with(context, query)
            assert module.captured_result_key(context, query) == "computed-key"
        else:
            fingerprint.assert_not_called()
            assert module._IDENTITY_KEY not in request.environ
            assert module.captured_result_key(context, query) is None
