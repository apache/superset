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

"""
The provider registry: the one switch that turns artifacts on.

A host registers its ``ArtifactRuntimeProvider`` once, at startup; with none
registered, artifacts stay off. It is a plain module, so a host calls it
directly, and anything that must follow the same switch, such as a host's
MCP instructions, reads ``artifacts_available``. Per-workspace switches and a
kill switch are the host's to add on top: they can only turn artifacts off.
"""

from __future__ import annotations

import threading

from superset_artifacts_sdk.provider import ArtifactRuntimeProvider


class ProviderAlreadyRegisteredError(RuntimeError):
    """A provider is registered already; pass ``replace=True`` to swap it."""


_lock = threading.Lock()
_provider: ArtifactRuntimeProvider | None = None


def register_provider(
    provider: ArtifactRuntimeProvider, *, replace: bool = False
) -> None:
    """
    Register the host's provider, which turns artifacts on.

    Raises ``ProviderAlreadyRegisteredError`` if one is registered already and
    ``replace`` is false, and ``TypeError`` if ``provider`` doesn't implement
    ``ArtifactRuntimeProvider``.
    """
    global _provider
    if not isinstance(provider, ArtifactRuntimeProvider):
        raise TypeError(
            f"{type(provider).__name__} does not implement ArtifactRuntimeProvider"
        )
    with _lock:
        if _provider is not None and not replace:
            raise ProviderAlreadyRegisteredError(
                f"an artifact runtime provider is registered already "
                f"({type(_provider).__name__}); pass replace=True to swap it"
            )
        _provider = provider


def get_provider() -> ArtifactRuntimeProvider | None:
    """Return the registered provider, or ``None`` if there is none."""
    with _lock:
        return _provider


def clear_provider() -> None:
    """Unregister the provider, which turns artifacts off."""
    global _provider
    with _lock:
        _provider = None


def artifacts_available() -> bool:
    """Whether artifacts are available: true only when a provider is registered."""
    return get_provider() is not None
