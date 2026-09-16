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
Shared helpers for extension storage (Tiers 2 and 3).

Centralizes cache-key construction and context/user resolution used by the
REST API (`api.py`) and the ambient `ephemeral`/`persistent` state accessors,
so isolation and scoping logic is defined once rather than duplicated per
call site.
"""

from __future__ import annotations

from typing import Any

from superset.extensions.context import get_current_extension_context
from superset.extensions.types import LoadedExtension
from superset.extensions.utils import get_extensions
from superset.utils.core import get_user_id

# Key separator
SEPARATOR = ":"

# Key prefix for extension storage
KEY_PREFIX = "superset-ext"


def build_cache_key(*parts: Any) -> str:
    """Build a namespaced cache key from parts."""
    return SEPARATOR.join(str(part) for part in parts)


def build_storage_key(
    extension_id: str, key: str, user_id: int | None, shared: bool
) -> str:
    """Build the cache key based on scope (user or shared)."""
    if shared:
        return build_cache_key(KEY_PREFIX, extension_id, "shared", key)
    return build_cache_key(KEY_PREFIX, extension_id, "user", user_id, key)


def get_extension_or_404(extension_id: str) -> LoadedExtension | None:
    """Get extension by ID or return None if not found."""
    extensions = get_extensions()
    return extensions.get(extension_id)


def parse_ttl(body: dict[str, Any]) -> tuple[int | None, str | None]:
    """Parse TTL from a request body into a positive integer.

    Only handles type coercion of the raw JSON value; the MAX_TTL business
    rule is enforced once, in `ExtensionEphemeralDAO`, shared by both the
    REST API and the ambient `ephemeral_state` accessor.

    Returns:
        (ttl, error_message) - error_message is set if the value is missing or invalid.
    """
    if "ttl" not in body:
        return None, "Field 'ttl' is required"
    try:
        ttl = int(body["ttl"])
    except (TypeError, ValueError):
        return None, "Field 'ttl' must be a positive integer"
    if ttl <= 0:
        return None, "Field 'ttl' must be a positive integer"
    return ttl, None


def get_current_extension_id(caller: str) -> str:
    """Get the current extension ID from context.

    :param caller: Name of the calling accessor (e.g. "ephemeral_state",
        "persistent_state"), used in the error message.
    """
    context = get_current_extension_context()
    if context is None:
        raise RuntimeError(
            f"{caller} can only be used within an extension context. "
            "Ensure this code is being executed during extension loading or "
            "within an extension API request handler."
        )
    return context.extension.id


def get_current_user_id(caller: str) -> int:
    """Get the current authenticated user's ID.

    :param caller: Name of the calling accessor (e.g. "ephemeral_state",
        "persistent_state"), used in the error message.
    """
    user_id = get_user_id()
    if user_id is None:
        raise RuntimeError(
            f"{caller} requires an authenticated user. "
            "Ensure the request has been authenticated."
        )
    return user_id
