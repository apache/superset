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
"""Test hash algorithm migration for shared entries."""

from unittest.mock import MagicMock, patch
from uuid import uuid3


def test_get_shared_value_fallback_to_md5() -> None:
    """Test that get_shared_value falls back to MD5 when SHA-256 doesn't find entry."""
    from superset.key_value.shared_entries import get_shared_value
    from superset.key_value.types import SharedKey
    from superset.key_value.utils import get_uuid_namespace_with_algorithm

    key = SharedKey.DASHBOARD_PERMALINK_SALT
    expected_value = "test_salt_value_12345"

    # Calculate what the MD5 UUID would be
    namespace_md5 = get_uuid_namespace_with_algorithm("", "md5")
    uuid_md5 = uuid3(namespace_md5, key)

    # Mock KeyValueDAO to simulate MD5 entry exists, SHA-256 doesn't
    mock_dao = MagicMock()

    def mock_get_value(resource, uuid_key, codec):
        # Only return value if UUID matches MD5 version
        if uuid_key == uuid_md5:
            return expected_value
        return None

    mock_dao.get_value.side_effect = mock_get_value

    # Mock current_app to use SHA-256 with MD5 fallback
    mock_app = MagicMock()
    mock_app.config = {
        "HASH_ALGORITHM": "sha256",
        "HASH_ALGORITHM_FALLBACKS": ["md5"],
    }

    with patch("superset.key_value.shared_entries.KeyValueDAO", mock_dao):
        with patch("superset.key_value.utils.current_app", mock_app):
            result = get_shared_value(key)

    # Should have found the MD5 entry
    assert result == expected_value

    # Should have called get_value twice (SHA-256 first, then MD5)
    assert mock_dao.get_value.call_count == 2


def test_get_shared_value_no_fallback_when_md5() -> None:
    """Test get_shared_value with MD5 primary and MD5 in fallbacks."""
    from superset.key_value.shared_entries import get_shared_value
    from superset.key_value.types import SharedKey

    key = SharedKey.DASHBOARD_PERMALINK_SALT

    # Mock KeyValueDAO to return None (entry not found)
    mock_dao = MagicMock()
    mock_dao.get_value.return_value = None

    # Mock current_app to use MD5 with MD5 fallback (same algorithm)
    # This would cause 2 lookups if fallback included same algorithm
    mock_app = MagicMock()
    mock_app.config = {
        "HASH_ALGORITHM": "md5",
        "HASH_ALGORITHM_FALLBACKS": ["md5"],  # Fallback is same as primary
    }

    with patch("superset.key_value.shared_entries.KeyValueDAO", mock_dao):
        with patch("superset.key_value.utils.current_app", mock_app):
            result = get_shared_value(key)

    # Should return None (not found)
    assert result is None

    # Should have called get_value twice (primary + fallback, even though same algo)
    # This is expected behavior with current implementation
    assert mock_dao.get_value.call_count == 2


def test_get_shared_value_finds_sha256_first() -> None:
    """Test that get_shared_value finds SHA-256 entry first without fallback."""
    from superset.key_value.shared_entries import get_shared_value
    from superset.key_value.types import SharedKey
    from superset.key_value.utils import get_uuid_namespace_with_algorithm

    key = SharedKey.DASHBOARD_PERMALINK_SALT
    expected_value = "new_sha256_salt"

    # Calculate what the SHA-256 UUID would be
    namespace_sha256 = get_uuid_namespace_with_algorithm("", "sha256")
    uuid_sha256 = uuid3(namespace_sha256, key)

    # Mock KeyValueDAO to return value for SHA-256
    mock_dao = MagicMock()

    def mock_get_value(resource, uuid_key, codec):
        # Return value if UUID matches SHA-256 version
        if uuid_key == uuid_sha256:
            return expected_value
        return None

    mock_dao.get_value.side_effect = mock_get_value

    # Mock current_app to use SHA-256 with MD5 fallback
    mock_app = MagicMock()
    mock_app.config = {
        "HASH_ALGORITHM": "sha256",
        "HASH_ALGORITHM_FALLBACKS": ["md5"],
    }

    with patch("superset.key_value.shared_entries.KeyValueDAO", mock_dao):
        with patch("superset.key_value.utils.current_app", mock_app):
            result = get_shared_value(key)

    # Should have found the SHA-256 entry
    assert result == expected_value

    # Should have called get_value only once (found immediately)
    assert mock_dao.get_value.call_count == 1
