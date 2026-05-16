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

from unittest.mock import MagicMock
from uuid import UUID

import pytest

from superset.key_value.exceptions import KeyValueParseKeyError
from superset.key_value.types import KeyValueResource

RESOURCE = KeyValueResource.APP
UUID_KEY = UUID("3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc")
ID_KEY = 123


@pytest.mark.parametrize(
    "key,expected_filter",
    [
        (UUID_KEY, {"resource": RESOURCE, "uuid": UUID_KEY}),
        (ID_KEY, {"resource": RESOURCE, "id": ID_KEY}),
    ],
    ids=["uuid_key", "id_key"],
)
def test_get_filter(key, expected_filter) -> None:
    """Test get_filter with different key types."""
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=key) == expected_filter


def test_encode_permalink_id_valid() -> None:
    """Test encoding permalink ID with valid input."""
    from superset.key_value.utils import encode_permalink_key

    salt = "abc"
    assert encode_permalink_key(1, salt) == "AyBn4lm9qG8"


def test_decode_permalink_id_invalid() -> None:
    """Test decoding permalink ID with invalid input."""
    from superset.key_value.utils import decode_permalink_id

    with pytest.raises(KeyValueParseKeyError):
        decode_permalink_id("foo", "bar")


@pytest.mark.parametrize(
    "algorithm,seed,expected_uuid",
    [
        ("md5", "test_seed", UUID("d81a8c4d-6522-9513-525d-6a5cef1c7c9d")),
        ("sha256", "test_seed", UUID("4504d44d-861b-6919-7db1-d95e47344234")),
    ],
    ids=["md5", "sha256"],
)
def test_get_uuid_namespace(algorithm, seed, expected_uuid) -> None:
    """Test UUID namespace generation with different algorithms."""
    from superset.key_value.utils import get_uuid_namespace

    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": algorithm}
    namespace = get_uuid_namespace(seed, app=mock_app)

    assert isinstance(namespace, UUID)
    assert namespace == expected_uuid


def test_get_uuid_namespace_deterministic() -> None:
    """Test that UUID namespace generation is deterministic."""
    from superset.key_value.utils import get_uuid_namespace

    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}
    namespace1 = get_uuid_namespace("same_seed", app=mock_app)
    namespace2 = get_uuid_namespace("same_seed", app=mock_app)
    assert namespace1 == namespace2


def test_get_uuid_namespace_different_seeds() -> None:
    """Test that different seeds produce different UUID namespaces."""
    from superset.key_value.utils import get_uuid_namespace

    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}
    namespace1 = get_uuid_namespace("seed1", app=mock_app)
    namespace2 = get_uuid_namespace("seed2", app=mock_app)
    assert namespace1 != namespace2


@pytest.mark.parametrize(
    "algorithm,seed,expected_uuid",
    [
        ("md5", "test_seed", UUID("d81a8c4d-6522-9513-525d-6a5cef1c7c9d")),
        ("sha256", "test_seed", UUID("4504d44d-861b-6919-7db1-d95e47344234")),
    ],
    ids=["md5", "sha256"],
)
def test_get_uuid_namespace_with_algorithm(algorithm, seed, expected_uuid) -> None:
    """Test UUID namespace generation with explicit algorithm."""
    from superset.key_value.utils import get_uuid_namespace_with_algorithm

    namespace = get_uuid_namespace_with_algorithm(seed, algorithm)
    assert isinstance(namespace, UUID)
    assert namespace == expected_uuid


def test_get_uuid_namespace_with_algorithm_different_results() -> None:
    """Test that MD5 and SHA-256 produce different UUIDs for same seed."""
    from superset.key_value.utils import get_uuid_namespace_with_algorithm

    namespace_md5 = get_uuid_namespace_with_algorithm("test_seed", "md5")
    namespace_sha256 = get_uuid_namespace_with_algorithm("test_seed", "sha256")
    assert namespace_md5 != namespace_sha256


@pytest.mark.parametrize(
    "algorithm",
    ["md5", "sha256"],
    ids=["md5", "sha256"],
)
def test_get_deterministic_uuid_with_algorithm(algorithm) -> None:
    """Test deterministic UUID generation with explicit algorithm."""
    from superset.key_value.utils import get_deterministic_uuid_with_algorithm

    payload = {"key": "value", "number": 123}

    # Test that same algorithm produces same UUID (deterministic)
    uuid_1 = get_deterministic_uuid_with_algorithm("salt", payload, algorithm)
    uuid_2 = get_deterministic_uuid_with_algorithm("salt", payload, algorithm)
    assert uuid_1 == uuid_2


def test_get_deterministic_uuid_different_algorithms() -> None:
    """Test that different algorithms produce different UUIDs."""
    from superset.key_value.utils import get_deterministic_uuid_with_algorithm

    payload = {"key": "value", "number": 123}

    uuid_md5 = get_deterministic_uuid_with_algorithm("salt", payload, "md5")
    uuid_sha256 = get_deterministic_uuid_with_algorithm("salt", payload, "sha256")
    assert uuid_md5 != uuid_sha256


@pytest.mark.parametrize(
    "config_value,expected_fallbacks",
    [
        (["md5"], ["md5"]),
        (["md5", "sha256"], ["md5", "sha256"]),
        ([], []),
    ],
    ids=["single_fallback", "multiple_fallbacks", "no_fallbacks"],
)
def test_get_fallback_algorithms(config_value, expected_fallbacks) -> None:
    """Test getting fallback algorithms from config."""
    from superset.key_value.utils import get_fallback_algorithms

    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM_FALLBACKS": config_value}
    fallbacks = get_fallback_algorithms(app=mock_app)

    assert fallbacks == expected_fallbacks


def test_get_fallback_algorithms_default() -> None:
    """Test fallback algorithms default to empty list if not configured."""
    from superset.key_value.utils import get_fallback_algorithms

    mock_app = MagicMock()
    mock_app.config = {}  # No HASH_ALGORITHM_FALLBACKS key
    fallbacks = get_fallback_algorithms(app=mock_app)

    assert fallbacks == []
