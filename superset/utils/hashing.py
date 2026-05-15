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

# Hash function lookup table for efficient dispatch
_HASH_FUNCTIONS: dict[str, Callable[[bytes], str]] = {
    "sha256": lambda data: hashlib.sha256(data).hexdigest(),
    "md5": lambda data: hashlib.md5(data).hexdigest(),  # noqa: S324
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
