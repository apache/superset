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

"""Optional provider metadata acquisition and host publication interfaces."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, get_args, Literal, Protocol, TypeAlias

# The host passes a finite absolute time.monotonic() deadline in this process.
CatalogLoader: TypeAlias = Callable[[float], str]
MetadataRefreshErrorCategory: TypeAlias = Literal[
    "unsupported",
    "configuration",
    "in_progress",
    "configuration_changed",
    "upstream",
    "invalid_payload",
    "deadline",
    "unavailable",
    "indeterminate",
]


@dataclass(frozen=True)
class CatalogSnapshot:
    """Carry one validated observation and its captured cache identity.

    The provider supplies canonical JSON in payload. The host assigns a nonempty,
    opaque, scope-qualified cache_token for each successful publication, including
    unchanged discovery. observed_at is a UTC RFC3339 source-observation time for
    display, not a cache creation/expiry time or an ordering authority.
    """

    payload: str = field(repr=False)
    cache_token: str = field(repr=False)
    observed_at: str

    def __post_init__(self) -> None:
        if not isinstance(self.payload, str):
            raise TypeError("Catalog payload must be a string")
        if not isinstance(self.cache_token, str):
            raise TypeError("Catalog cache_token must be a string")
        if not isinstance(self.observed_at, str):
            raise TypeError("Catalog observed_at must be a string")
        if not self.cache_token:
            raise ValueError("Catalog cache token must not be empty")
        if not self.observed_at:
            raise ValueError("Catalog observed_at must not be empty")


@dataclass(frozen=True)
class MetadataRefreshResult:
    """Report a confirmed publication and its immutable observation.

    Unchanged compares discovery payloads, not complete upstream metric
    definitions. Changed includes installation without a prior observation.
    An indeterminate publication must raise an error instead of returning success.
    """

    status: Literal["changed", "unchanged"]
    snapshot: CatalogSnapshot

    def __post_init__(self) -> None:
        if self.status not in ("changed", "unchanged"):
            raise ValueError("Unknown metadata refresh result status")


class MetadataRefreshError(Exception):
    """Carry a validated failure category without vendor messages or credentials.

    Hosts must not expose exception cause chains. Providers translating sensitive
    upstream exceptions should suppress their displayed chain with ``from None``.
    """

    def __init__(self, category: MetadataRefreshErrorCategory) -> None:
        if category not in get_args(MetadataRefreshErrorCategory):
            raise ValueError("Unknown metadata refresh error category")
        self.category: MetadataRefreshErrorCategory = category
        super().__init__(category)


class MetadataSnapshotStore(Protocol):
    """Define host-owned publication for one authorized connection scope.

    The loader receives a finite absolute time.monotonic() deadline and acquires
    and validates canonical JSON within that budget and any tighter provider limit.
    The caller sets one deadline before waiting or acquisition and passes it to
    every store/adapter call; implementations must not reset it for nested calls.
    Non-finite values and exhausted budgets raise the deadline category before
    further I/O, including cache reads. The deadline is process-local, never
    serialized or used for cache expiry or publication ordering; it does not
    replace writer fencing.
    The host owns expiry, writer fencing and publication confirmation. This
    protocol does not provide storage, authorization or distributed coordination.
    Host-only invalidation and cache inspection are outside the provider interface.
    """

    def read(self, fetch: CatalogLoader, *, deadline: float) -> CatalogSnapshot:
        """Read a valid observation or perform bounded coordinated acquisition.

        Cold readers wait/re-read within a finite deadline or fail safely; they
        must not silently use an obsolete local copy. Cache hits retain identity
        and expiry. Return the payload and its identity from the same observation.
        Pass the caller's deadline unchanged to nested refresh and loader calls.
        """
        ...

    def refresh(
        self, fetch: CatalogLoader, *, deadline: float
    ) -> MetadataRefreshResult:
        """Bypass a hit and confirm publication with a fresh cache token.

        A busy explicit refresh reports in_progress. Failure must not renew
        freshness. An unconfirmed outcome reports indeterminate rather than
        retrying publication blindly or claiming success or rollback.
        Acquisition and publication share the caller's deadline without renewal.
        """
        ...


class MetadataRefreshAdapter(ABC):
    """Opt a provider into host-coordinated metadata discovery and refresh."""

    @abstractmethod
    def bind(self, store: MetadataSnapshotStore, *, deadline: float) -> None:
        """Bind once before discovery and reject rebinding as configuration error.

        Participating full/custom views and runtime schema must use this store.
        The host supplies trusted scope and checks authority before construction.
        Construction stays deadline-free. Capture the caller's finite absolute
        monotonic deadline here and pass it unchanged to discovery store reads.
        Reject non-finite or exhausted budgets with the deadline category before
        binding; failure leaves the adapter unbound. A new host operation needs
        a fresh adapter, not a renewed discovery budget on an existing binding.
        """

    @abstractmethod
    def refresh(self, *, deadline: float) -> MetadataRefreshResult:
        """Acquire validated metadata and request confirmed host publication.

        An unbound adapter reports unsupported. Do not return success after only
        fetching upstream data or silently fall back to provider-local caching.
        Pass the caller's finite absolute monotonic deadline unchanged to the
        store. Reject non-finite or exhausted budgets with the deadline category
        before I/O; nested calls never create a new budget.
        """

    @abstractmethod
    def get_runtime_schema(
        self, runtime_data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Discover runtime fields through the bound store used by provider views.

        Return the existing runtime-schema shape. This instance hook avoids the
        legacy classmethod path bypassing the bound observation.
        """
