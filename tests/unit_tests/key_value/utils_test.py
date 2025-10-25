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

from uuid import UUID

import pytest

from superset.key_value.exceptions import KeyValueParseKeyError
from superset.key_value.types import KeyValueResource

RESOURCE = KeyValueResource.APP
UUID_KEY = UUID("3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc")
ID_KEY = 123


def test_get_filter_uuid() -> None:
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=UUID_KEY) == {
        "resource": RESOURCE,
        "uuid": UUID_KEY,
    }


def test_get_filter_id() -> None:
    from superset.key_value.utils import get_filter

    assert get_filter(resource=RESOURCE, key=ID_KEY) == {
        "resource": RESOURCE,
        "id": ID_KEY,
    }


def test_encode_permalink_id_valid() -> None:
    from superset.key_value.utils import encode_permalink_key

    salt = "abc"
    assert encode_permalink_key(1, salt) == "AyBn4lm9qG8"


def test_decode_permalink_id_invalid() -> None:
    from superset.key_value.utils import decode_permalink_id

    with pytest.raises(KeyValueParseKeyError):
        decode_permalink_id("foo", "bar")


def test_get_uuid_namespace_md5() -> None:
    """Test UUID namespace generation with MD5 (legacy mode)."""
    from unittest.mock import MagicMock

    from superset.key_value.utils import get_uuid_namespace

    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "md5"}
    namespace = get_uuid_namespace("test_seed", app=mock_app)
    # MD5-based UUID should be consistent
    assert isinstance(namespace, UUID)
    assert namespace == UUID("d81a8c4d-6522-9513-525d-6a5cef1c7c9d")


def test_get_uuid_namespace_sha256() -> None:
    """Test UUID namespace generation with SHA-256 (FedRAMP compliant mode)."""
    from unittest.mock import MagicMock

    from superset.key_value.utils import get_uuid_namespace

    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}
    namespace = get_uuid_namespace("test_seed", app=mock_app)
    # SHA-256-based UUID (first 16 bytes)
    assert isinstance(namespace, UUID)
    # SHA-256("test_seed") first 16 bytes as UUID
    assert namespace == UUID("4504d44d-861b-6919-7db1-d95e47344234")


def test_get_uuid_namespace_deterministic() -> None:
    """Test that UUID namespace generation is deterministic."""
    from unittest.mock import MagicMock

    from superset.key_value.utils import get_uuid_namespace

    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}
    namespace1 = get_uuid_namespace("same_seed", app=mock_app)
    namespace2 = get_uuid_namespace("same_seed", app=mock_app)
    assert namespace1 == namespace2


def test_get_uuid_namespace_different_seeds() -> None:
    """Test that different seeds produce different UUID namespaces."""
    from unittest.mock import MagicMock

    from superset.key_value.utils import get_uuid_namespace

    mock_app = MagicMock()
    mock_app.config = {"HASH_ALGORITHM": "sha256"}
    namespace1 = get_uuid_namespace("seed1", app=mock_app)
    namespace2 = get_uuid_namespace("seed2", app=mock_app)
    assert namespace1 != namespace2
