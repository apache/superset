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

"""Optional metadata synchronization contract for host and provider adapters.

Serialized payloads are immutable strings owned and validated by the provider.
The host publishes them without interpreting their vendor-specific structure.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal, Protocol

CatalogLoader = Callable[[], str]


@dataclass(frozen=True)
class CatalogSnapshot:
    """One validated catalog and its opaque, scope-qualified cache identity."""

    payload: str
    revision: str
    cache_token: str
    observed_at: str


@dataclass(frozen=True)
class MetadataRefreshResult:
    """Confirmed publication, never merely completion of an upstream request."""

    status: Literal["changed", "unchanged"]
    snapshot: CatalogSnapshot


class MetadataRefreshError(Exception):
    """Safe failure category that crosses the provider/host boundary."""

    def __init__(
        self,
        category: Literal[
            "unsupported",
            "configuration",
            "in_progress",
            "configuration_changed",
            "upstream",
            "invalid_payload",
            "deadline",
            "unavailable",
            "indeterminate",
        ],
    ) -> None:
        self.category: str = category
        super().__init__(category)


class MetadataSnapshotStore(Protocol):
    """Host-owned scoped publication, including expiry and writer fencing."""

    def read(self, fetch: CatalogLoader) -> CatalogSnapshot:
        """Read a fresh snapshot or acquire and publish one without local fallback."""
        ...

    def refresh(self, fetch: CatalogLoader) -> MetadataRefreshResult:
        """Bypass a fresh hit and publish one validated observation atomically."""
        ...


class MetadataRefreshAdapter(ABC):
    """Optional provider capability, bound before any stored-view discovery."""

    @abstractmethod
    def bind(self, store: MetadataSnapshotStore) -> None:
        """Bind the trusted host scope during construction, before discovery."""

    @abstractmethod
    def refresh(self) -> MetadataRefreshResult:
        """Acquire a validated catalog and request fenced host publication."""

    @abstractmethod
    def get_runtime_schema(
        self,
        runtime_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Discover runtime fields using the same bound snapshot as views."""
