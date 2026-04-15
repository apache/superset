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

import hashlib
from hashlib import md5
from secrets import token_urlsafe
from typing import Any
from uuid import UUID, uuid3

import hashids
from flask import current_app
from flask_babel import gettext as _

from superset.key_value.exceptions import KeyValueParseKeyError
from superset.key_value.types import Key, KeyValueFilter, KeyValueResource
from superset.utils.json import json_dumps_w_dates

HASHIDS_MIN_LENGTH = 11


def random_key(nbytes: int = 8) -> str:
    """
    Generate a random URL-safe string.

    Args:
        nbytes (int): Number of bytes to use for generating the key. Default is 8.
    """
    return token_urlsafe(nbytes)


def get_filter(resource: KeyValueResource, key: Key) -> KeyValueFilter:
    try:
        filter_: KeyValueFilter = {"resource": resource.value}
        if isinstance(key, UUID):
            filter_["uuid"] = key
        else:
            filter_["id"] = key
        return filter_
    except ValueError as ex:
        raise KeyValueParseKeyError() from ex


def encode_permalink_key(key: int, salt: str) -> str:
    obj = hashids.Hashids(salt, min_length=HASHIDS_MIN_LENGTH)
    return obj.encode(key)


def decode_permalink_id(key: str, salt: str) -> int:
    obj = hashids.Hashids(salt, min_length=HASHIDS_MIN_LENGTH)
    ids = obj.decode(key)
    if len(ids) == 1:
        return ids[0]
    raise KeyValueParseKeyError(_("Invalid permalink key"))


def _uuid_namespace_from_md5(seed: str) -> UUID:
    """Generate UUID namespace from MD5 hash (legacy compatibility)."""
    md5_obj = md5()  # noqa: S324
    md5_obj.update(seed.encode("utf-8"))
    return UUID(md5_obj.hexdigest())


def _uuid_namespace_from_sha256(seed: str) -> UUID:
    """Generate UUID namespace from SHA-256 hash (first 16 bytes)."""
    sha256_obj = hashlib.sha256()
    sha256_obj.update(seed.encode("utf-8"))
    # Use first 16 bytes of SHA-256 digest for UUID
    return UUID(bytes=sha256_obj.digest()[:16])


# UUID namespace generator dispatch table
_UUID_NAMESPACE_GENERATORS = {
    "md5": _uuid_namespace_from_md5,
    "sha256": _uuid_namespace_from_sha256,
}


def get_uuid_namespace_with_algorithm(seed: str, algorithm: str) -> UUID:
    """
    Generate a UUID namespace from a seed string using specified hash algorithm.

    Args:
        seed: Seed string for namespace generation
        algorithm: Hash algorithm to use ('sha256' or 'md5')

    Returns:
        UUID namespace
    """
    generator = _UUID_NAMESPACE_GENERATORS.get(algorithm)
    if generator is None:
        raise ValueError(f"Unsupported hash algorithm: {algorithm}")
    return generator(seed)


def get_uuid_namespace(seed: str, app: Any = None) -> UUID:
    """
    Generate a UUID namespace from a seed string using configured hash algorithm.

    Args:
        seed: Seed string for namespace generation
        app: Flask app instance (optional, uses current_app if not provided)

    Returns:
        UUID namespace
    """
    app = app or current_app
    algorithm = app.config["HASH_ALGORITHM"]
    return get_uuid_namespace_with_algorithm(seed, algorithm)


def get_deterministic_uuid_with_algorithm(
    namespace: str, payload: Any, algorithm: str
) -> UUID:
    """
    Get a deterministic UUID (uuid3) using specified hash algorithm.

    Args:
        namespace: Namespace string for UUID generation
        payload: JSON-serializable payload
        algorithm: Hash algorithm to use ('sha256' or 'md5')

    Returns:
        Deterministic UUID
    """
    payload_str = json_dumps_w_dates(payload, sort_keys=True)
    return uuid3(get_uuid_namespace_with_algorithm(namespace, algorithm), payload_str)


def get_deterministic_uuid(namespace: str, payload: Any) -> UUID:
    """Get a deterministic UUID (uuid3) from a salt and a JSON-serializable payload."""
    payload_str = json_dumps_w_dates(payload, sort_keys=True)
    return uuid3(get_uuid_namespace(namespace), payload_str)


def get_fallback_algorithms(app: Any = None) -> list[str]:
    """
    Get the list of fallback hash algorithms from config.

    Args:
        app: Flask app instance (optional, uses current_app if not provided)

    Returns:
        List of fallback algorithm names (empty list if none configured)
    """
    app = app or current_app
    return app.config.get("HASH_ALGORITHM_FALLBACKS", [])
