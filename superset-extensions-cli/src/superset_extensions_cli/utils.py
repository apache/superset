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

import json  # noqa: TID251
import re
import sys
from pathlib import Path
from typing import Any

from superset_extensions_cli.exceptions import ExtensionNameError
from superset_extensions_cli.types import ExtensionNames

if sys.version_info >= (3, 11):
    import tomllib
else:
    import tomli as tomllib

# Python reserved keywords to avoid in package names
PYTHON_KEYWORDS = {
    "and",
    "as",
    "assert",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "exec",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "not",
    "or",
    "pass",
    "print",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
    "False",
    "None",
    "True",
}

# npm reserved names to avoid
NPM_RESERVED = {
    "node_modules",
    "favicon.ico",
    "www",
    "http",
    "https",
    "ftp",
    "localhost",
    "package.json",
    "npm",
    "yarn",
    "bower_components",
}

# Extension name pattern: lowercase, start with letter or number, alphanumeric + hyphens
EXTENSION_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9]*(?:-[a-z0-9]+)*$")


def read_toml(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None

    with path.open("rb") as f:
        return tomllib.load(f)


def read_json(path: Path) -> dict[str, Any] | None:
    path = Path(path)
    if not path.is_file():
        return None

    return json.loads(path.read_text())


def _normalize_for_identifiers(name: str) -> str:
    """
    Normalize display name to clean lowercase words.

    Args:
        name: Raw display name (e.g., "Hello World!")

    Returns:
        Normalized string (e.g., "hello world")
    """
    # Convert to lowercase
    normalized = name.lower().strip()

    # Convert underscores and existing hyphens to spaces for consistent processing
    normalized = normalized.replace("_", " ").replace("-", " ")

    # Remove any non-alphanumeric characters except spaces
    normalized = re.sub(r"[^a-z0-9\s]", "", normalized)

    # Normalize whitespace (collapse multiple spaces, strip)
    normalized = " ".join(normalized.split())

    return normalized


def _normalized_to_kebab(normalized: str) -> str:
    """Convert normalized string to kebab-case."""
    return normalized.replace(" ", "-")


def _normalized_to_snake(normalized: str) -> str:
    """Convert normalized string to snake_case."""
    return normalized.replace(" ", "_")


def _normalized_to_camel(normalized: str) -> str:
    """Convert normalized string to camelCase."""
    parts = normalized.split()
    if not parts:
        return ""
    # First part lowercase, subsequent parts capitalized
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


def kebab_to_camel_case(kebab_name: str) -> str:
    """Convert kebab-case to camelCase (e.g., 'hello-world' -> 'helloWorld')."""
    parts = kebab_name.split("-")
    if not parts:
        return ""
    # First part lowercase, subsequent parts capitalized
    return parts[0] + "".join(word.capitalize() for word in parts[1:])


def kebab_to_snake_case(kebab_name: str) -> str:
    """Convert kebab-case to snake_case (e.g., 'hello-world' -> 'hello_world')."""
    return kebab_name.replace("-", "_")


def name_to_kebab_case(name: str) -> str:
    """Convert display name directly to kebab-case (e.g., 'Hello World' -> 'hello-world')."""
    normalized = _normalize_for_identifiers(name)
    return _normalized_to_kebab(normalized)


# Legacy functions for backward compatibility
def to_kebab_case(name: str) -> str:
    """Convert display name to kebab-case. For new code, use name_to_kebab_case."""
    return name_to_kebab_case(name)


def to_snake_case(kebab_name: str) -> str:
    """Convert kebab-case to snake_case. For new code, use kebab_to_snake_case."""
    return kebab_to_snake_case(kebab_name)


def validate_extension_id(extension_id: str) -> None:
    """
    Validate extension ID format (kebab-case).

    Raises:
        ExtensionNameError: If ID is invalid
    """
    if not extension_id:
        raise ExtensionNameError("Extension ID cannot be empty")

    # Check for leading/trailing hyphens first
    if extension_id.startswith("-"):
        raise ExtensionNameError("Extension ID cannot start with hyphens")

    if extension_id.endswith("-"):
        raise ExtensionNameError("Extension ID cannot end with hyphens")

    # Check for consecutive hyphens
    if "--" in extension_id:
        raise ExtensionNameError("Extension ID cannot have consecutive hyphens")

    # Check overall pattern
    if not EXTENSION_NAME_PATTERN.match(extension_id):
        raise ExtensionNameError(
            "Use lowercase letters, numbers, and hyphens only (e.g. hello-world)"
        )


def validate_extension_name(name: str) -> str:
    """
    Validate and normalize extension name (human-readable).

    Args:
        extension_name: Raw extension name input

    Returns:
        Cleaned extension name

    Raises:
        ExtensionNameError: If extension name is invalid
    """
    if not name or not name.strip():
        raise ExtensionNameError("Extension name cannot be empty")

    # Normalize whitespace: strip and collapse multiple spaces
    normalized = " ".join(name.strip().split())

    # Check for only whitespace/special chars after normalization
    if not any(c.isalnum() for c in normalized):
        raise ExtensionNameError(
            "Extension name must contain at least one letter or number"
        )

    return normalized


def validate_python_package_name(name: str) -> None:
    """
    Validate Python package name (snake_case format).

    Raises:
        ExtensionNameError: If name is invalid
    """
    # Check if it starts with a number (invalid for Python identifiers)
    if name[0].isdigit():
        raise ExtensionNameError(f"Package name '{name}' cannot start with a number")

    # Check if the first part (before any underscore) is a Python keyword
    if (first_part := name.split("_")[0]) in PYTHON_KEYWORDS:
        raise ExtensionNameError(
            f"Package name cannot start with Python keyword '{first_part}'"
        )

    # Check if it's a valid Python identifier
    if not name.replace("_", "a").isalnum():
        raise ExtensionNameError(f"'{name}' is not a valid Python package name")


def validate_npm_package_name(name: str) -> None:
    """
    Validate npm package name (kebab-case format).

    Raises:
        ExtensionNameError: If name is invalid
    """
    if name.lower() in NPM_RESERVED:
        raise ExtensionNameError(f"'{name}' is a reserved npm package name")


def generate_extension_names(name: str) -> ExtensionNames:
    """
    Generate all extension name variants from display name input.

    Flow: Display Name -> Generate ID -> Derive Technical Names from ID
    Example: "Hello World" -> "hello-world" -> "helloWorld"/"hello_world" (from ID)

    Returns:
        ExtensionNames: Dictionary with all name variants

    Raises:
        ExtensionNameError: If any generated name is invalid
    """
    # Validate and normalize the extension name
    name = validate_extension_name(name)

    # Generate ID from display name
    kebab_name = name_to_kebab_case(name)

    # Derive all technical names from the generated ID (not display name)
    snake_name = kebab_to_snake_case(kebab_name)
    camel_name = kebab_to_camel_case(kebab_name)

    # Validate the generated names
    validate_extension_id(kebab_name)
    validate_python_package_name(snake_name)
    validate_npm_package_name(kebab_name)

    return ExtensionNames(
        name=name,
        id=kebab_name,
        mf_name=camel_name,
        backend_name=snake_name,
        backend_package=f"superset_extensions.{snake_name}",
        backend_entry=f"superset_extensions.{snake_name}.entrypoint",
    )
