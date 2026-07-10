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

import base64
from typing import Any

from flask import current_app
from flask_babel import gettext as _

from superset.exceptions import SupersetGenericErrorException
from superset.extensions import cache_manager
from superset.extensions.storage.codecs import DEFAULT_CODEC, get_codec
from superset.extensions.storage.utils import build_storage_key, get_current_user_id


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


def _validate_value_size(encoded: bytes) -> None:
    """Validate encoded value bytes against MAX_VALUE_SIZE. Raises if over."""
    max_size = _get_ephemeral_config().get("MAX_VALUE_SIZE")
    if max_size is None:
        return
    if len(encoded) > max_size:
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

    Values are encoded with a codec (see `superset.extensions.storage.codecs`)
    before being handed to the cache, and stored alongside the codec name in
    a small JSON-safe envelope (`{"codec": ..., "value": <base64 bytes>}`).
    This keeps behavior independent of which Flask-Caching backend the
    operator has configured: the default `SupersetMetastoreCache` backend
    serializes cached values with its own `JsonKeyValueCodec`, which would
    reject a non-JSON-serializable Python value (e.g. raw bytes) before it
    ever reached this DAO's own codec.

    Unlike Tier 3, there is no per-extension total quota here: the pluggable
    cache backend has no generic way to sum bytes across an extension's
    keys, so only a per-value size cap is enforced.
    """

    @staticmethod
    def get_raw(
        extension_id: str, key: str, shared: bool = False
    ) -> tuple[bytes, str] | None:
        """Return the raw encoded bytes and the codec they were encoded with.

        :returns: (raw_bytes, codec), or None if not found or expired.
        """
        user_id = None if shared else get_current_user_id("ephemeral_state")
        cache_key = build_storage_key(extension_id, key, user_id, shared)
        envelope = cache_manager.extension_ephemeral_state_cache.get(cache_key)
        if envelope is None:
            return None
        return base64.b64decode(envelope["value"]), envelope["codec"]

    @staticmethod
    def get(extension_id: str, key: str, shared: bool = False) -> Any:
        """Get a value from ephemeral state, decoded with the codec it was
        written with.

        :returns: The decoded value, or None if not found or expired.
        """
        raw = ExtensionEphemeralDAO.get_raw(extension_id, key, shared=shared)
        if raw is None:
            return None
        value, codec = raw
        return get_codec(codec).decode(value)

    @staticmethod
    def set(
        extension_id: str,
        key: str,
        value: Any,
        ttl: int | None,
        codec: str = DEFAULT_CODEC,
        shared: bool = False,
    ) -> None:
        """Set a value in ephemeral state.

        :param value: The value to store, encoded with `codec` before being
            handed to the cache backend.
        :raises ExtensionEphemeralTTLInvalid: if `ttl` is missing or exceeds
            MAX_TTL.
        :raises ExtensionEphemeralValueTooLarge: if the encoded value exceeds
            MAX_VALUE_SIZE.
        """
        ttl = _validate_ttl(ttl)
        encoded = get_codec(codec).encode(value)
        _validate_value_size(encoded)
        user_id = None if shared else get_current_user_id("ephemeral_state")
        cache_key = build_storage_key(extension_id, key, user_id, shared)
        envelope = {"codec": codec, "value": base64.b64encode(encoded).decode("ascii")}
        cache_manager.extension_ephemeral_state_cache.set(
            cache_key, envelope, timeout=ttl
        )

    @staticmethod
    def delete(extension_id: str, key: str, shared: bool = False) -> None:
        """Delete a value from ephemeral state."""
        user_id = None if shared else get_current_user_id("ephemeral_state")
        cache_key = build_storage_key(extension_id, key, user_id, shared)
        cache_manager.extension_ephemeral_state_cache.delete(cache_key)
