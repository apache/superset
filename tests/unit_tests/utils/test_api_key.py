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
"""Unit tests for API key utilities."""

from superset.utils.api_key import (
    extract_api_key_from_header,
    generate_api_key,
    validate_api_key,
)


def test_generate_api_key():
    """Test API key generation."""
    plaintext_key, key_hash, key_prefix = generate_api_key()

    # Check plaintext key format
    assert plaintext_key.startswith("pst_")
    assert len(plaintext_key) > 40  # Should be prefix + base64 encoded random bytes

    # Check key prefix
    assert key_prefix == plaintext_key[:8]
    assert key_prefix.startswith("pst_")

    # Check hash is bcrypt
    assert key_hash.startswith("$2b$")  # bcrypt hash prefix
    assert len(key_hash) == 60  # bcrypt hashes are always 60 chars


def test_generate_api_key_uniqueness():
    """Test that generated keys are unique."""
    key1, hash1, _ = generate_api_key()
    key2, hash2, _ = generate_api_key()

    assert key1 != key2
    assert hash1 != hash2


def test_validate_api_key_success():
    """Test successful API key validation."""
    plaintext_key, key_hash, _ = generate_api_key()

    # Validation should succeed with correct key
    assert validate_api_key(plaintext_key, key_hash) is True


def test_validate_api_key_failure():
    """Test failed API key validation with wrong key."""
    _, key_hash, _ = generate_api_key()
    wrong_key = "pst_wrong_key_123456789"

    # Validation should fail with wrong key
    assert validate_api_key(wrong_key, key_hash) is False


def test_validate_api_key_invalid_hash():
    """Test validation with invalid hash format."""
    plaintext_key, _, _ = generate_api_key()

    # Invalid hash should return False
    assert validate_api_key(plaintext_key, "invalid_hash") is False
    assert validate_api_key(plaintext_key, "") is False
    assert validate_api_key(plaintext_key, None) is False


def test_extract_api_key_from_header_bearer():
    """Test extracting API key from Bearer token header."""
    key = "pst_abc123def456"
    header = f"Bearer {key}"

    extracted = extract_api_key_from_header(header)
    assert extracted == key


def test_extract_api_key_from_header_raw():
    """Test extracting API key from raw header (no Bearer prefix)."""
    key = "pst_abc123def456"

    extracted = extract_api_key_from_header(key)
    assert extracted == key


def test_extract_api_key_from_header_case_insensitive():
    """Test Bearer prefix is case-insensitive."""
    key = "pst_abc123def456"

    assert extract_api_key_from_header(f"bearer {key}") == key
    assert extract_api_key_from_header(f"BEARER {key}") == key
    assert extract_api_key_from_header(f"Bearer {key}") == key


def test_extract_api_key_from_header_none():
    """Test extracting from None header."""
    assert extract_api_key_from_header(None) is None


def test_extract_api_key_from_header_empty():
    """Test extracting from empty header."""
    assert extract_api_key_from_header("") is None
    assert extract_api_key_from_header("   ") is None


def test_extract_api_key_from_header_whitespace():
    """Test extracting with extra whitespace."""
    key = "pst_abc123def456"

    assert extract_api_key_from_header(f"  Bearer  {key}  ") == key
    assert extract_api_key_from_header(f"  {key}  ") == key
