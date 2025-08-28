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
from pathlib import Path
from typing import Any


def assert_file_exists(path: Path, description: str = "") -> None:
    """
    Assert that a file exists with a descriptive error message.

    Args:
        path: Path to the file that should exist
        description: Optional description for better error messages
    """
    desc_msg = f" ({description})" if description else ""
    assert path.exists(), f"Expected file {path}{desc_msg} to exist, but it doesn't"
    assert path.is_file(), f"Expected {path}{desc_msg} to be a file, but it's not"


def assert_directory_exists(path: Path, description: str = "") -> None:
    """
    Assert that a directory exists with a descriptive error message.

    Args:
        path: Path to the directory that should exist
        description: Optional description for better error messages
    """
    desc_msg = f" ({description})" if description else ""
    assert (
        path.exists()
    ), f"Expected directory {path}{desc_msg} to exist, but it doesn't"
    assert path.is_dir(), f"Expected {path}{desc_msg} to be a directory, but it's not"


def assert_file_structure(base_path: Path, expected_files: list[str]) -> None:
    """
    Assert that all expected files exist under the base path.

    Args:
        base_path: Base directory path
        expected_files: List of relative file paths that should exist
    """
    for file_path in expected_files:
        full_path = base_path / file_path
        assert_file_exists(full_path, "part of expected structure")


def assert_directory_structure(base_path: Path, expected_dirs: list[str]) -> None:
    """
    Assert that all expected directories exist under the base path.

    Args:
        base_path: Base directory path
        expected_dirs: List of relative directory paths that should exist
    """
    for dir_path in expected_dirs:
        full_path = base_path / dir_path
        assert_directory_exists(full_path, "part of expected structure")


def get_directory_tree(path: Path, ignore: set[str] | None = None) -> set[str]:
    """
    Get all files and directories under a path as relative string paths.

    Args:
        path: Base path to scan
        ignore: Set of file/directory names to ignore

    Returns:
        Set of relative path strings
    """
    ignore = ignore or {".DS_Store", "__pycache__", ".pytest_cache"}
    tree: set[str] = set()

    if not path.exists():
        return tree

    for item in path.rglob("*"):
        if any(ignored in item.parts for ignored in ignore):
            continue
        relative = item.relative_to(path)
        tree.add(str(relative))

    return tree


def load_json_file(path: Path) -> dict[str, Any]:
    """
    Load and parse a JSON file.

    Args:
        path: Path to the JSON file

    Returns:
        Parsed JSON content

    Raises:
        AssertionError: If file doesn't exist or isn't valid JSON
    """
    assert_file_exists(path, "JSON file")
    try:
        content = json.loads(path.read_text())
        return content
    except json.JSONDecodeError as e:
        raise AssertionError(f"File {path} contains invalid JSON: {e}")


def assert_json_content(path: Path, expected_values: dict[str, Any]) -> None:
    """
    Assert that a JSON file contains expected key-value pairs.

    Args:
        path: Path to the JSON file
        expected_values: Dictionary of expected key-value pairs
    """
    content = load_json_file(path)

    for key, expected_value in expected_values.items():
        assert key in content, f"Expected key '{key}' not found in {path}"
        actual_value = content[key]
        assert (
            actual_value == expected_value
        ), f"Expected {key}='{expected_value}' but got '{actual_value}' in {path}"


def assert_file_contains(path: Path, text: str) -> None:
    """
    Assert that a file contains specific text.

    Args:
        path: Path to the file
        text: Text that should be present in the file
    """
    assert_file_exists(path, "text file")
    content = path.read_text()
    assert text in content, f"Expected text '{text}' not found in {path}"


def assert_file_content_matches(path: Path, expected_content: str) -> None:
    """
    Assert that a file's content exactly matches expected content.

    Args:
        path: Path to the file
        expected_content: Expected file content
    """
    assert_file_exists(path, "content file")
    actual_content = path.read_text()
    assert actual_content == expected_content, (
        f"File content mismatch in {path}\n"
        f"Expected:\n{expected_content}\n"
        f"Actual:\n{actual_content}"
    )


def create_test_extension_structure(
    base_path: Path,
    id_: str,
    include_frontend: bool = True,
    include_backend: bool = True,
) -> dict[str, Any]:
    """
    Helper to create expected extension structure for testing.

    Args:
        base_path: Base path where extension should be created
        id_: Unique identifier for extension
        name: Extension name
        include_frontend: Whether frontend should be included
        include_backend: Whether backend should be included

    Returns:
        Dictionary with expected paths and metadata
    """
    extension_path = base_path / id_
    expected_files = ["extension.json"]
    expected_dirs: list[str] = []

    if include_frontend:
        expected_dirs.append("frontend")
        expected_files.append("frontend/package.json")

    if include_backend:
        expected_dirs.append("backend")
        expected_files.append("backend/pyproject.toml")

    expected = {
        "extension_path": extension_path,
        "expected_files": expected_files,
        "expected_dirs": expected_dirs,
    }

    return expected
