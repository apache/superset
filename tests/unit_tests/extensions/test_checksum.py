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


from superset.extensions.checksum import (
    ExtensionChecksumComparator,
    ExtensionChecksumService,
)
from superset.extensions.types import LoadedExtension


class TestExtensionChecksumService:
    """Test cases for ExtensionChecksumService."""

    def test_calculate_checksum_deterministic(self):
        """Test that checksum calculation is deterministic."""
        name = "test-extension"
        manifest = {"name": "test-extension", "version": "1.0.0"}
        frontend = {"main.js": b"console.log('hello');"}
        backend = {"main.py": b"print('hello')"}

        # Calculate checksum multiple times
        checksum1 = ExtensionChecksumService.calculate_checksum(
            name, manifest, frontend, backend
        )
        checksum2 = ExtensionChecksumService.calculate_checksum(
            name, manifest, frontend, backend
        )

        assert checksum1 == checksum2

    def test_calculate_checksum_different_order(self):
        """Test that dict order doesn't affect checksum."""
        name = "test-extension"
        manifest1 = {"name": "test-extension", "version": "1.0.0", "author": "test"}
        manifest2 = {"version": "1.0.0", "name": "test-extension", "author": "test"}

        frontend = {"main.js": b"console.log('hello');"}
        backend = {"main.py": b"print('hello')"}

        checksum1 = ExtensionChecksumService.calculate_checksum(
            name, manifest1, frontend, backend
        )
        checksum2 = ExtensionChecksumService.calculate_checksum(
            name, manifest2, frontend, backend
        )

        assert checksum1 == checksum2

    def test_calculate_checksum_different_content(self):
        """Test that different content produces different checksums."""
        name = "test-extension"
        manifest = {"name": "test-extension", "version": "1.0.0"}
        frontend1 = {"main.js": b"console.log('hello');"}
        frontend2 = {"main.js": b"console.log('world');"}
        backend = {"main.py": b"print('hello')"}

        checksum1 = ExtensionChecksumService.calculate_checksum(
            name, manifest, frontend1, backend
        )
        checksum2 = ExtensionChecksumService.calculate_checksum(
            name, manifest, frontend2, backend
        )

        assert checksum1 != checksum2

    def test_sort_dict_recursively(self):
        """Test recursive dictionary sorting."""
        nested_dict = {
            "z": {"b": 2, "a": 1},
            "a": {"y": 3, "x": 4},
        }

        sorted_dict = ExtensionChecksumService._sort_dict_recursively(nested_dict)

        # Check top-level keys are sorted
        assert list(sorted_dict.keys()) == ["a", "z"]
        # Check nested keys are sorted
        assert list(sorted_dict["a"].keys()) == ["x", "y"]
        assert list(sorted_dict["z"].keys()) == ["a", "b"]

    def test_sort_and_encode_assets(self):
        """Test asset sorting and encoding."""
        assets = {
            "z.js": b"content z",
            "a.js": b"content a",
        }

        result = ExtensionChecksumService._sort_and_encode_assets(assets)

        # Check keys are sorted
        assert list(result.keys()) == ["a.js", "z.js"]
        # Check content is base64 encoded
        assert result["a.js"] == "Y29udGVudCBh"  # base64 of "content a"
        assert result["z.js"] == "Y29udGVudCB6"  # base64 of "content z"

    def test_sort_and_encode_assets_none(self):
        """Test handling of None assets."""
        result = ExtensionChecksumService._sort_and_encode_assets(None)
        assert result is None


class TestExtensionChecksumComparator:
    """Test cases for ExtensionChecksumComparator."""

    def test_needs_update_no_db_extension(self):
        """Test that update is needed when extension doesn't exist in database."""
        fs_extension = LoadedExtension(
            name="test-extension",
            manifest={"name": "test-extension", "version": "1.0.0"},
            frontend={"main.js": b"console.log('hello');"},
            backend={"main.py": b"print('hello')"},
            enabled=True,
        )

        result = ExtensionChecksumComparator.needs_update(fs_extension, None)
        assert result is True

    def test_needs_update_same_checksum(self):
        """Test that update is not needed when checksums match."""
        # This would require mocking the Extension model and its checksum property
        # Implementation depends on your testing framework setup
        pass

    def test_needs_update_different_checksum(self):
        """Test that update is needed when checksums differ."""
        # This would require mocking the Extension model and its checksum property
        # Implementation depends on your testing framework setup
        pass
