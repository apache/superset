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

"""Store state-machine tests; real Redis separately verifies the atomic primitives."""

from __future__ import annotations

from unittest.mock import Mock

import pytest
from superset_core.semantic_layers.metadata import CatalogSnapshot, MetadataRefreshError

from superset.semantic_layers.metadata import ScopedMetadataStore
from tests.unit_tests.semantic_layers.metadata_store_test import Clock, MemoryBackend


@pytest.mark.parametrize("operation", ["read", "refresh"])
@pytest.mark.parametrize(
    "deadline", [float("nan"), float("inf"), float("-inf"), 100.0, 99.0, 131.0]
)
def test_caller_deadline_rejected_before_backend_or_provider(
    operation: str, deadline: float
) -> None:
    clock: Clock = Clock()
    backend: Mock = Mock(spec=MemoryBackend)
    fetch: Mock = Mock(return_value="[]")
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=130, clock=clock
    )
    with pytest.raises(MetadataRefreshError, match="deadline"):
        getattr(store, operation)(fetch, deadline=deadline)
    assert backend.mock_calls == []
    fetch.assert_not_called()


def test_caller_deadline_reaches_loader_without_changing_operation_budget() -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=130, clock=clock
    )
    seen: list[float] = []

    def fetch(deadline: float) -> str:
        seen.append(deadline)
        return "[]"

    first: CatalogSnapshot = store.read(fetch, deadline=110)
    clock.advance(11)
    with pytest.raises(MetadataRefreshError, match="deadline"):
        store.read(fetch, deadline=110)
    assert store.read(fetch, deadline=130) == first
    second: CatalogSnapshot = store.refresh(fetch, deadline=125).snapshot
    assert seen == [110, 125]
    assert first.cache_token != second.cache_token
    assert store.observed_at(second.cache_token) == second.observed_at


def test_caller_budget_expires_during_fetch_without_publication() -> None:
    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=130, clock=clock
    )

    def fetch(deadline: float) -> str:
        assert deadline == 105
        clock.advance(6)
        return "[]"

    with pytest.raises(MetadataRefreshError, match="deadline"):
        store.refresh(fetch, deadline=105)
    assert store.peek() is None
    assert store.read(lambda deadline: "[]", deadline=130).payload == "[]"
