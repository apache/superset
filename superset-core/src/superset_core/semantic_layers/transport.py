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

"""Library-neutral, always-bounded HTTP capability supplied by the host."""

from __future__ import annotations

import json  # noqa: TID251 -- SDK cannot depend on the host JSON utility.
import math
import re
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass
from enum import Enum
from types import MappingProxyType
from typing import Any


@dataclass(frozen=True)
class RequestBudget:
    """Absolute monotonic deadline and positive response-body byte cap."""

    deadline: float
    max_bytes: int

    def __post_init__(self) -> None:
        if (
            isinstance(self.deadline, bool)
            or not isinstance(self.deadline, (int, float))
            or not math.isfinite(self.deadline)
        ):
            raise ValueError("deadline must be finite monotonic seconds")
        if type(self.max_bytes) is not int or self.max_bytes <= 0:
            raise ValueError("max_bytes must be a positive integer")


class _Headers(Mapping[str, str]):
    """Own an immutable, case-insensitive copy without HTTP-library types."""

    def __init__(self, values: Mapping[str, str]) -> None:
        self._values: Mapping[str, str] = MappingProxyType(
            {key.lower(): value for key, value in values.items()}
        )

    def __getitem__(self, key: str) -> str:
        return self._values[key.lower()]

    def __iter__(self) -> Iterator[str]:
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._values)


@dataclass(frozen=True)
class ProviderResponse:
    """Complete, bounded 2xx response; JSON decoding remains provider-owned."""

    status: int
    headers: Mapping[str, str]
    body: bytes
    url: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "headers", _Headers(self.headers))

    def json(self) -> Any:
        """Decode body bytes with the standard library; preserve decoding errors."""
        return json.loads(self.body)


class ProviderRequestFailure(str, Enum):
    """Closed transport-failure categories, independent of provider payloads."""

    INVALID_URL = "invalid_url"
    REFUSED = "refused"
    UNREACHABLE = "unreachable"
    TIMEOUT = "timeout"
    TOO_LARGE = "too_large"
    UNSUPPORTED_ENCODING = "unsupported_encoding"
    HTTP_STATUS = "http_status"


class ProviderRequestError(Exception):
    """A safe failure containing no endpoint, credentials or response text."""

    def __init__(
        self,
        failure: ProviderRequestFailure,
        *,
        status: int | None = None,
        provider: str = "Provider",
    ) -> None:
        self.failure: ProviderRequestFailure = failure
        self.status: int | None = status
        # Reject URL-like, control-bearing or excessive labels rather than echoing them.
        self.provider: str = (
            provider.strip()
            if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 _-]{0,63}", provider)
            else "Provider"
        )
        super().__init__(failure)

    def __str__(self) -> str:
        messages: dict[ProviderRequestFailure, str] = {
            ProviderRequestFailure.INVALID_URL: "endpoint is not a valid URL.",
            ProviderRequestFailure.REFUSED: "endpoint is not allowed.",
            ProviderRequestFailure.UNREACHABLE: ("endpoint could not be reached."),
            ProviderRequestFailure.TIMEOUT: ("request exceeded its time budget."),
            ProviderRequestFailure.TOO_LARGE: ("response exceeded its byte budget."),
            ProviderRequestFailure.UNSUPPORTED_ENCODING: (
                "response encoding is not supported."
            ),
            ProviderRequestFailure.HTTP_STATUS: (
                f"request failed with HTTP {self.status}."
            ),
        }
        return f"{self.provider} {messages[self.failure]}"


class ProviderTransport(ABC):
    """Host destination policy and bounded HTTP, injectable in provider tests."""

    @abstractmethod
    def request(
        self,
        provider: str,
        method: str,
        url: str,
        *,
        budget: RequestBudget,
        headers: Mapping[str, str] | None = None,
        params: Mapping[str, Any] | None = None,
        json: Any = None,
        consume: Callable[[int], None] | None = None,
    ) -> ProviderResponse:
        """Return complete 2xx bytes or raise ProviderRequestError.

        The deadline covers resolution, connection, TLS, headers, redirects and
        reads. Consume receives each chunk size before the byte-cap check.
        Non-2xx bodies are unread; encoded bodies are refused. No proxy settings
        from the environment apply. Only same-origin GET redirects are followed,
        at most three. Providers share a deadline across pagination or polling.
        """
