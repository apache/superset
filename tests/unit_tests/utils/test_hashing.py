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
from unittest.mock import patch

import pytest

from superset.utils.hashing import (
    hash_from_dict,
    hash_from_str,
)


def test_hash_from_str_sha256():
    """Test SHA-256 hashing produces expected output."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        result = hash_from_str("test")
        expected = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        assert result == expected


def test_hash_from_str_md5():
    """Test MD5 hashing for backward compatibility."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="md5"):
        result = hash_from_str("test")
        expected = "098f6bcd4621d373cade4e832627b4f6"
        assert result == expected


def test_hash_from_dict_deterministic():
    """Test dictionary hashing is deterministic."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        obj = {"key": "value", "number": 42}
        hash1 = hash_from_dict(obj)
        hash2 = hash_from_dict(obj)
        assert hash1 == hash2


def test_hash_from_dict_key_order_invariant():
    """Test dictionary hashing is invariant to key order."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        obj1 = {"a": 1, "b": 2, "c": 3}
        obj2 = {"c": 3, "a": 1, "b": 2}
        assert hash_from_dict(obj1) == hash_from_dict(obj2)


def test_hash_algorithm_override():
    """Test explicit algorithm override."""
    # Config set to SHA-256
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        # Force MD5 via parameter
        result = hash_from_str("test", algorithm="md5")
        expected_md5 = "098f6bcd4621d373cade4e832627b4f6"
        assert result == expected_md5

        # Force SHA-256 via parameter (redundant but valid)
        result = hash_from_str("test", algorithm="sha256")
        expected_sha256 = (
            "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        )
        assert result == expected_sha256


def test_backward_compatibility_alias_md5():
    """Test legacy function names work with MD5."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="md5"):
        result = hash_from_str("test")
        expected = "098f6bcd4621d373cade4e832627b4f6"
        assert result == expected


def test_backward_compatibility_alias_sha256():
    """Test legacy function names work with SHA-256."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        result = hash_from_str("test")
        # Should return SHA-256, not MD5
        assert len(result) == 64  # SHA-256 hex length
        expected = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        assert result == expected


def test_backward_compatibility_dict_alias():
    """Test legacy dict function name."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        obj = {"key": "value"}
        result = hash_from_dict(obj)
        # Should use SHA-256
        assert len(result) == 64


def test_invalid_algorithm_raises():
    """Test invalid algorithm raises ValueError."""
    with pytest.raises(ValueError, match="Unsupported hash algorithm"):
        hash_from_str("test", algorithm="sha1")


def test_empty_string():
    """Test hashing empty string."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        result = hash_from_str("")
        # SHA-256 of empty string
        expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        assert result == expected


def test_empty_dict():
    """Test hashing empty dictionary."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        result = hash_from_dict({})
        # Should hash the JSON representation "{}"
        assert isinstance(result, str)
        assert len(result) == 64


def test_unicode_string():
    """Test hashing Unicode strings."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        result = hash_from_str("Hello 世界 🌍")
        # Should handle Unicode correctly
        assert isinstance(result, str)
        assert len(result) == 64


def test_nested_dict():
    """Test hashing nested dictionaries."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        obj = {"outer": {"inner": {"deep": "value"}}, "list": [1, 2, 3]}
        result = hash_from_dict(obj)
        assert isinstance(result, str)
        assert len(result) == 64


def test_dict_with_nan():
    """Test hashing dictionary with NaN values."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        import math

        obj = {"value": math.nan, "normal": 42}
        # Should handle NaN with ignore_nan parameter
        result = hash_from_dict(obj, ignore_nan=True)
        assert isinstance(result, str)
        assert len(result) == 64


def test_hash_consistency_across_runs():
    """Test that hashing is consistent across multiple invocations."""
    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        test_string = "consistency_test"
        results = [hash_from_str(test_string) for _ in range(10)]

        # All results should be identical
        assert len(set(results)) == 1


def test_md5_vs_sha256_different_outputs():
    """Test that MD5 and SHA-256 produce different hashes."""
    test_string = "compare"

    with patch("superset.utils.hashing.get_hash_algorithm", return_value="md5"):
        md5_result = hash_from_str(test_string)

    with patch("superset.utils.hashing.get_hash_algorithm", return_value="sha256"):
        sha256_result = hash_from_str(test_string)

    # Hashes should be different
    assert md5_result != sha256_result
    # MD5 produces 32 character hex string
    assert len(md5_result) == 32
    # SHA-256 produces 64 character hex string
    assert len(sha256_result) == 64
