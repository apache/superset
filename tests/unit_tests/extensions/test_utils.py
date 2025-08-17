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

import pytest
from superset_core.extensions.types import Manifest

from superset.extensions.utils import calculate_extension_checksum


@pytest.mark.parametrize(
    "name,manifest,frontend,backend,expected_checksum",
    [
        # Basic test case
        (
            "test-extension",
            {"name": "test-extension", "version": "1.0.0"},
            {"main.js": b"console.log('hello');"},
            {"main.py": b"print('hello')"},
            "0fab0317a0388d3586493953ab083d05",
        ),
        # Different order in manifest (should produce same checksum as above)
        (
            "test-extension",
            {"version": "1.0.0", "name": "test-extension"},
            {"main.js": b"console.log('hello');"},
            {"main.py": b"print('hello')"},
            "0fab0317a0388d3586493953ab083d05",
        ),
        # None assets
        (
            "test-extension",
            {"name": "test-extension", "version": "1.0.0"},
            None,
            None,
            "4b96f558d71374047d7fc5b11875892a",
        ),
        # Empty assets, same as above
        (
            "test-extension",
            {"name": "test-extension", "version": "1.0.0"},
            {},
            {},
            "4b96f558d71374047d7fc5b11875892a",
        ),
        # Different extension name
        (
            "different-extension",
            {"name": "different-extension", "version": "1.0.0"},
            {"main.js": b"console.log('hello');"},
            {"main.py": b"print('hello')"},
            "a5f2f92ed23c5858580c513aa72cdd9e",
        ),
        # Different frontend content
        (
            "test-extension",
            {"name": "test-extension", "version": "1.0.0"},
            {"main.js": b"console.log('world');"},
            {"main.py": b"print('hello')"},
            "c399ae44aa2717ce3dbfd899bea0dbd8",
        ),
        # Different backend content
        (
            "test-extension",
            {"name": "test-extension", "version": "1.0.0"},
            {"main.js": b"console.log('hello');"},
            {"main.py": b"print('world')"},
            "58cddd1a6f2a73c28d6ef047cf5502dc",
        ),
        # Different manifest version
        (
            "test-extension",
            {"name": "test-extension", "version": "2.0.0"},
            {"main.js": b"console.log('hello');"},
            {"main.py": b"print('hello')"},
            "50e3a9d2702999aa58159f6841b64235",
        ),
    ],
)
def test_calculate_extension_checksum(
    name: str,
    manifest: Manifest,
    frontend: dict[str, bytes] | None,
    backend: dict[str, bytes] | None,
    expected_checksum: str,
) -> None:
    """Test that checksum calculation produces expected values."""
    actual_checksum = calculate_extension_checksum(name, manifest, frontend, backend)

    # Validate checksum format
    assert isinstance(actual_checksum, str)
    assert len(actual_checksum) == 32  # MD5 hex digest length

    # Validate against expected value
    assert actual_checksum == expected_checksum, (
        f"Expected {expected_checksum}, got {actual_checksum}"
    )
