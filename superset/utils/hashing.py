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
import logging
from typing import Any, Callable, Literal, Optional

from flask import current_app

from superset.utils import json

logger = logging.getLogger(__name__)

HashAlgorithm = Literal["md5", "sha256"]


def md5_non_security(data: bytes = b"") -> Any:
    """
    An MD5 hash object for digests that carry no security claim.

    Cache keys, checksums and legacy UUID namespaces need a specific digest
    value, not a strong one. ``usedforsecurity=False`` says so, which lets
    OpenSSL resolve MD5 from the default provider rather than the FIPS one;
    without it every MD5 call raises ``UnsupportedDigestmodError`` on a
    FIPS-enabled host. The digest produced is byte-for-byte the same, so
    values stored by earlier versions still match.

    Note this covers a FIPS *policy* that gates MD5. A build that drops MD5
    from its provider set altogether still rejects these calls, so anything
    that may legitimately change its digest (as opposed to reproducing a
    stored one) should prefer SHA-256 outright.

    Args:
        data: Optional initial data to hash

    Returns:
        A hashlib MD5 hash object
    """
    return hashlib.md5(data, usedforsecurity=False)


# Hash algorithm lookup table mapping algorithm name to the hash object
# constructor. Shared with superset.utils.cache_manager, which needs the
# constructor itself (not a finalized digest) to satisfy Flask-Caching's
# hash_method contract.
_HASH_CONSTRUCTORS: dict[HashAlgorithm, Callable[[bytes], Any]] = {
    "sha256": hashlib.sha256,
    "md5": md5_non_security,
}

# Hash function lookup table for efficient dispatch
_HASH_FUNCTIONS: dict[HashAlgorithm, Callable[[bytes], str]] = {
    name: (lambda ctor: lambda data: ctor(data).hexdigest())(ctor)
    for name, ctor in _HASH_CONSTRUCTORS.items()
}


def get_hash_algorithm() -> HashAlgorithm:
    """
    Get the configured hash algorithm for non-cryptographic purposes.

    Returns:
        Hash algorithm name ('md5' or 'sha256')
    """
    return current_app.config["HASH_ALGORITHM"]


def hash_from_str(val: str, algorithm: Optional[HashAlgorithm] = None) -> str:
    """
    Generate a hash from a string using the configured or specified algorithm.

    Args:
        val: String to hash
        algorithm: Hash algorithm to use (defaults to configured algorithm)

    Returns:
        Hexadecimal hash digest string

    Examples:
        >>> hash_from_str("test")  # Uses configured algorithm
        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
        >>> hash_from_str("test", algorithm="md5")  # Force MD5
        '098f6bcd4621d373cade4e832627b4f6'
    """
    if algorithm is None:
        algorithm = get_hash_algorithm()

    hash_func = _HASH_FUNCTIONS.get(algorithm)
    if hash_func is None:
        raise ValueError(f"Unsupported hash algorithm: {algorithm}")

    return hash_func(val.encode("utf-8"))


def hash_from_dict(
    obj: dict[Any, Any],
    ignore_nan: bool = False,
    default: Optional[Callable[[Any], Any]] = None,
    algorithm: Optional[HashAlgorithm] = None,
) -> str:
    """
    Generate a hash from a dictionary using the configured or specified algorithm.

    Args:
        obj: Dictionary to hash
        ignore_nan: Whether to ignore NaN values in JSON serialization
        default: Default function for JSON serialization
        algorithm: Hash algorithm to use (defaults to configured algorithm)

    Returns:
        Hexadecimal hash digest string
    """
    json_data = json.dumps(
        obj, sort_keys=True, ignore_nan=ignore_nan, default=default, allow_nan=True
    )

    return hash_from_str(json_data, algorithm=algorithm)
