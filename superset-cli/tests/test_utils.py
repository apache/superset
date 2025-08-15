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

import json

import pytest
from superset_cli.utils import read_json, read_toml


@pytest.mark.unit
class TestUtils:
    """Unit tests for utility functions."""

    def test_read_json_with_valid_file(self, isolated_filesystem):
        """Test read_json with valid JSON file."""
        json_data = {"name": "test", "version": "1.0.0"}
        json_file = isolated_filesystem / "test.json"
        json_file.write_text(json.dumps(json_data))

        result = read_json(json_file)

        assert result == json_data

    def test_read_json_with_nonexistent_file(self, isolated_filesystem):
        """Test read_json returns None when file doesn't exist."""
        nonexistent_file = isolated_filesystem / "nonexistent.json"

        result = read_json(nonexistent_file)

        assert result is None

    def test_read_json_with_invalid_json(self, isolated_filesystem):
        """Test read_json with invalid JSON content."""
        invalid_json_file = isolated_filesystem / "invalid.json"
        invalid_json_file.write_text("{ invalid json content")

        with pytest.raises(json.JSONDecodeError):
            read_json(invalid_json_file)

    def test_read_toml_with_valid_file(self, isolated_filesystem):
        """Test read_toml with valid TOML file."""
        toml_content = '[project]\nname = "test"\nversion = "1.0.0"'
        toml_file = isolated_filesystem / "pyproject.toml"
        toml_file.write_text(toml_content)

        result = read_toml(toml_file)

        assert result is not None
        assert result["project"]["name"] == "test"
        assert result["project"]["version"] == "1.0.0"

    def test_read_toml_with_nonexistent_file(self, isolated_filesystem):
        """Test read_toml returns None when file doesn't exist."""
        nonexistent_file = isolated_filesystem / "nonexistent.toml"

        result = read_toml(nonexistent_file)

        assert result is None

    def test_read_toml_with_directory_instead_of_file(self, isolated_filesystem):
        """Test read_toml returns None when path is a directory."""
        directory = isolated_filesystem / "test_dir"
        directory.mkdir()

        result = read_toml(directory)

        assert result is None

    def test_read_json_with_directory_instead_of_file(self, isolated_filesystem):
        """Test read_json returns None when path is a directory."""
        directory = isolated_filesystem / "test_dir"
        directory.mkdir()

        result = read_json(directory)

        assert result is None

    def test_read_toml_with_invalid_toml(self, isolated_filesystem):
        """Test read_toml with invalid TOML content."""
        invalid_toml_file = isolated_filesystem / "invalid.toml"
        invalid_toml_file.write_text("[ invalid toml content")

        with pytest.raises(
            Exception
        ):  # tomli raises various exceptions for invalid TOML
            read_toml(invalid_toml_file)
