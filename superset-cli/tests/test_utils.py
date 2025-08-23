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


# Read JSON Tests
@pytest.mark.unit
def test_read_json_with_valid_file(isolated_filesystem):
    """Test read_json with valid JSON file."""
    json_data = {"name": "test", "version": "1.0.0"}
    json_file = isolated_filesystem / "test.json"
    json_file.write_text(json.dumps(json_data))

    result = read_json(json_file)

    assert result == json_data


@pytest.mark.unit
def test_read_json_with_nonexistent_file(isolated_filesystem):
    """Test read_json returns None when file doesn't exist."""
    nonexistent_file = isolated_filesystem / "nonexistent.json"

    result = read_json(nonexistent_file)

    assert result is None


@pytest.mark.unit
def test_read_json_with_invalid_json(isolated_filesystem):
    """Test read_json with invalid JSON content."""
    invalid_json_file = isolated_filesystem / "invalid.json"
    invalid_json_file.write_text("{ invalid json content")

    with pytest.raises(json.JSONDecodeError):
        read_json(invalid_json_file)


@pytest.mark.unit
def test_read_json_with_directory_instead_of_file(isolated_filesystem):
    """Test read_json returns None when path is a directory."""
    directory = isolated_filesystem / "test_dir"
    directory.mkdir()

    result = read_json(directory)

    assert result is None


@pytest.mark.unit
@pytest.mark.parametrize(
    "json_content,expected",
    [
        ({"simple": "value"}, {"simple": "value"}),
        ({"nested": {"key": "value"}}, {"nested": {"key": "value"}}),
        ({"array": [1, 2, 3]}, {"array": [1, 2, 3]}),
        ({}, {}),  # Empty JSON object
    ],
)
def test_read_json_with_various_valid_content(
    isolated_filesystem, json_content, expected
):
    """Test read_json with various valid JSON content types."""
    json_file = isolated_filesystem / "test.json"
    json_file.write_text(json.dumps(json_content))

    result = read_json(json_file)

    assert result == expected


# Read TOML Tests
@pytest.mark.unit
def test_read_toml_with_valid_file(isolated_filesystem):
    """Test read_toml with valid TOML file."""
    toml_content = '[project]\nname = "test"\nversion = "1.0.0"'
    toml_file = isolated_filesystem / "pyproject.toml"
    toml_file.write_text(toml_content)

    result = read_toml(toml_file)

    assert result is not None
    assert result["project"]["name"] == "test"
    assert result["project"]["version"] == "1.0.0"


@pytest.mark.unit
def test_read_toml_with_nonexistent_file(isolated_filesystem):
    """Test read_toml returns None when file doesn't exist."""
    nonexistent_file = isolated_filesystem / "nonexistent.toml"

    result = read_toml(nonexistent_file)

    assert result is None


@pytest.mark.unit
def test_read_toml_with_directory_instead_of_file(isolated_filesystem):
    """Test read_toml returns None when path is a directory."""
    directory = isolated_filesystem / "test_dir"
    directory.mkdir()

    result = read_toml(directory)

    assert result is None


@pytest.mark.unit
def test_read_toml_with_invalid_toml(isolated_filesystem):
    """Test read_toml with invalid TOML content."""
    invalid_toml_file = isolated_filesystem / "invalid.toml"
    invalid_toml_file.write_text("[ invalid toml content")

    with pytest.raises(Exception):  # tomli raises various exceptions for invalid TOML
        read_toml(invalid_toml_file)


@pytest.mark.unit
@pytest.mark.parametrize(
    "toml_content,expected_keys",
    [
        ('[project]\nname = "test"', ["project"]),
        ('[build-system]\nrequires = ["setuptools"]', ["build-system"]),
        (
            '[project]\nname = "test"\n[build-system]\nrequires = ["setuptools"]',
            ["project", "build-system"],
        ),
    ],
)
def test_read_toml_with_various_valid_content(
    isolated_filesystem, toml_content, expected_keys
):
    """Test read_toml with various valid TOML content types."""
    toml_file = isolated_filesystem / "test.toml"
    toml_file.write_text(toml_content)

    result = read_toml(toml_file)

    assert result is not None
    for key in expected_keys:
        assert key in result


@pytest.mark.unit
def test_read_toml_with_complex_structure(isolated_filesystem):
    """Test read_toml with complex TOML structure."""
    complex_toml = """
[project]
name = "my-package"
version = "1.0.0"
authors = [
    {name = "Author Name", email = "author@example.com"}
]

[project.dependencies]
requests = "^2.25.0"

[build-system]
requires = ["setuptools", "wheel"]
build-backend = "setuptools.build_meta"
"""
    toml_file = isolated_filesystem / "complex.toml"
    toml_file.write_text(complex_toml)

    result = read_toml(toml_file)

    assert result is not None
    assert result["project"]["name"] == "my-package"
    assert result["project"]["version"] == "1.0.0"
    assert len(result["project"]["authors"]) == 1
    assert result["project"]["authors"][0]["name"] == "Author Name"
    assert result["build-system"]["requires"] == ["setuptools", "wheel"]


@pytest.mark.unit
def test_read_toml_with_empty_file(isolated_filesystem):
    """Test read_toml with empty TOML file."""
    toml_file = isolated_filesystem / "empty.toml"
    toml_file.write_text("")

    result = read_toml(toml_file)

    assert result == {}


@pytest.mark.unit
@pytest.mark.parametrize(
    "invalid_content",
    [
        "[ invalid section",
        "key = ",
        "key = unquoted string",
        "[section\nkey = value",
    ],
)
def test_read_toml_with_various_invalid_content(isolated_filesystem, invalid_content):
    """Test read_toml with various types of invalid TOML content."""
    toml_file = isolated_filesystem / "invalid.toml"
    toml_file.write_text(invalid_content)

    with pytest.raises(Exception):  # Various TOML parsing exceptions
        read_toml(toml_file)


# File System Edge Cases
@pytest.mark.unit
def test_read_json_with_permission_denied(isolated_filesystem):
    """Test read_json behavior when file permissions are denied."""
    json_file = isolated_filesystem / "restricted.json"
    json_file.write_text('{"test": "value"}')

    # This test may not work on all systems, so we'll skip it if chmod doesn't work
    try:
        json_file.chmod(0o000)  # No permissions
        result = read_json(json_file)
        # If we get here without exception, the file was still readable
        # This is system-dependent behavior
        assert result is None or result == {"test": "value"}
    except (OSError, PermissionError):
        # Expected on some systems
        pass
    finally:
        # Restore permissions for cleanup
        try:
            json_file.chmod(0o644)
        except (OSError, PermissionError):
            pass


@pytest.mark.unit
def test_read_toml_with_permission_denied(isolated_filesystem):
    """Test read_toml behavior when file permissions are denied."""
    toml_file = isolated_filesystem / "restricted.toml"
    toml_file.write_text('[test]\nkey = "value"')

    # This test may not work on all systems, so we'll skip it if chmod doesn't work
    try:
        toml_file.chmod(0o000)  # No permissions
        result = read_toml(toml_file)
        # If we get here without exception, the file was still readable
        # This is system-dependent behavior
        assert result is None or "test" in result
    except (OSError, PermissionError):
        # Expected on some systems
        pass
    finally:
        # Restore permissions for cleanup
        try:
            toml_file.chmod(0o644)
        except (OSError, PermissionError):
            pass
