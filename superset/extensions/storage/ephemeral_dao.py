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

from flask import current_app
from flask_babel import gettext as _

from superset.exceptions import SupersetGenericErrorException
from superset.extensions import cache_manager
from superset.extensions.storage.utils import build_storage_key, get_current_user_id
from superset.utils import json


class ExtensionEphemeralTTLInvalid(SupersetGenericErrorException):
    """Raised when a `set` call's TTL is missing or exceeds MAX_TTL."""

    status = 400


class ExtensionEphemeralValueTooLarge(SupersetGenericErrorException):
    """Raised when a `set` call's value exceeds MAX_VALUE_SIZE."""

    status = 400


def _get_ephemeral_config() -> dict[str, Any]:
    return current_app.config["EXTENSIONS_EPHEMERAL_STORAGE"]


def _validate_ttl(ttl: int | None) -> int | None:
    """Validate a TTL against MAX_TTL. Raises if missing or over the limit."""
    if ttl is None:
        raise ExtensionEphemeralTTLInvalid(_("A TTL is required for ephemeral state."))
    if ttl <= 0:
        raise ExtensionEphemeralTTLInvalid(_("TTL must be a positive integer."))
    max_ttl = _get_ephemeral_config().get("MAX_TTL")
    if max_ttl is not None and ttl > max_ttl:
        raise ExtensionEphemeralTTLInvalid(
            _("TTL must not exceed %(max_ttl)d seconds.", max_ttl=max_ttl)
        )
    return ttl


def _validate_value_size(value: Any) -> None:
    """Validate a value against MAX_VALUE_SIZE. Raises if it exceeds the limit."""
    max_size = _get_ephemeral_config().get("MAX_VALUE_SIZE")
    if max_size is None:
        return
    size = len(json.dumps(value).encode())
    if size > max_size:
        raise ExtensionEphemeralValueTooLarge(
            _(
                "Value exceeds the maximum allowed size of %(max_size)d bytes.",
                max_size=max_size,
            )
        )


class ExtensionEphemeralDAO:
    """Cache-backed key-value store for extensions (Tier 2).

    Thin wrapper around `cache_manager.extension_ephemeral_state_cache`
    (a pluggable Flask-Caching backend) that centralizes key-building and
    the MAX_TTL/MAX_VALUE_SIZE validation shared by the REST API
    (`api.py`) and the ambient `ephemeral_state` accessor (`ephemeral.py`),
    so both enforce the same limits rather than each parsing/validating
    independently.

    Unlike Tier 3, there is no per-extension total quota here: the pluggable
    cache backend has no generic way to sum bytes across an extension's
    keys, so only a per-value size cap is enforced.
    """

    @staticmethod
    def get(extension_id: str, key: str, shared: bool = False) -> Any:
        """Get a value from ephemeral state."""
        user_id = None if shared else get_current_user_id("ephemeral_state")
        cache_key = build_storage_key(extension_id, key, user_id, shared)
        return cache_manager.extension_ephemeral_state_cache.get(cache_key)

    @staticmethod
    def set(
        extension_id: str,
        key: str,
        value: Any,
        ttl: int | None,
        shared: bool = False,
    ) -> None:
        """Set a value in ephemeral state.

        :raises ExtensionEphemeralTTLInvalid: if `ttl` is missing or exceeds
            MAX_TTL.
        :raises ExtensionEphemeralValueTooLarge: if `value` exceeds
            MAX_VALUE_SIZE.
        """
        ttl = _validate_ttl(ttl)
        _validate_value_size(value)
        user_id = None if shared else get_current_user_id("ephemeral_state")
        cache_key = build_storage_key(extension_id, key, user_id, shared)
        cache_manager.extension_ephemeral_state_cache.set(cache_key, value, timeout=ttl)

    @staticmethod
    def delete(extension_id: str, key: str, shared: bool = False) -> None:
        """Delete a value from ephemeral state."""
        user_id = None if shared else get_current_user_id("ephemeral_state")
        cache_key = build_storage_key(extension_id, key, user_id, shared)
        cache_manager.extension_ephemeral_state_cache.delete(cache_key)
