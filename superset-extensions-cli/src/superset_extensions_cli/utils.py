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

from superset_core.extensions.constants import (
    DISPLAY_NAME_PATTERN,
    PUBLISHER_PATTERN,
    TECHNICAL_NAME_PATTERN,
)
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

# Compiled patterns for publisher/name validation
PUBLISHER_REGEX = re.compile(PUBLISHER_PATTERN)
TECHNICAL_NAME_REGEX = re.compile(TECHNICAL_NAME_PATTERN)
DISPLAY_NAME_REGEX = re.compile(DISPLAY_NAME_PATTERN)


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


def validate_publisher(publisher: str) -> None:
    """
    Validate publisher namespace format.

    Args:
        publisher: Publisher namespace (e.g., 'my-org')

    Raises:
        ExtensionNameError: If publisher is invalid
    """
    if not publisher:
        raise ExtensionNameError("Publisher cannot be empty")

    if not PUBLISHER_REGEX.match(publisher):
        raise ExtensionNameError(
            "Publisher must start with a letter and contain only lowercase letters, numbers, and hyphens (e.g., 'my-org')"
        )


def validate_technical_name(name: str) -> None:
    """
    Validate technical extension name format.

    Args:
        name: Technical extension name (e.g., 'dashboard-widgets')

    Raises:
        ExtensionNameError: If name is invalid
    """
    if not name:
        raise ExtensionNameError("Extension name cannot be empty")

    if not TECHNICAL_NAME_REGEX.match(name):
        raise ExtensionNameError(
            "Extension name must start with a letter and contain only lowercase letters, numbers, and hyphens (e.g., 'dashboard-widgets')"
        )


def validate_display_name(display_name: str) -> str:
    """
    Validate and normalize display name format.

    Args:
        display_name: Human-readable extension name

    Returns:
        Cleaned display name

    Raises:
        ExtensionNameError: If display name is invalid
    """
    if not display_name or not display_name.strip():
        raise ExtensionNameError("Display name cannot be empty")

    # Normalize whitespace: strip and collapse multiple spaces
    normalized = " ".join(display_name.strip().split())

    if not DISPLAY_NAME_REGEX.match(normalized):
        raise ExtensionNameError(
            "Display name must start with a letter and can contain letters, numbers, spaces, hyphens, underscores, and dots (e.g., 'Dashboard Widgets')"
        )

    # Check for only whitespace/special chars after normalization
    if not any(c.isalnum() for c in normalized):
        raise ExtensionNameError(
            "Display name must contain at least one letter or number"
        )

    return normalized


def suggest_technical_name(display_name: str) -> str:
    """
    Suggest technical name from display name.

    Args:
        display_name: Human-readable name (e.g., "Dashboard Widgets!")

    Returns:
        Technical name suggestion (e.g., "dashboard-widgets")
    """
    # Normalize for identifiers
    normalized = _normalize_for_identifiers(display_name)

    # Convert to kebab-case
    technical_name = _normalized_to_kebab(normalized)

    # Remove any leading/trailing hyphens that might result from edge cases
    technical_name = technical_name.strip("-")

    # Ensure we have something left
    if not technical_name:
        raise ExtensionNameError(
            "Display name must contain at least one letter or number"
        )

    return technical_name


def get_module_federation_name(publisher: str, name: str) -> str:
    """
    Generate Module Federation container name.

    Args:
        publisher: Publisher namespace (e.g., 'my-org')
        name: Technical name (e.g., 'dashboard-widgets')

    Returns:
        Module Federation name (e.g., 'myOrg_dashboardWidgets')
    """
    publisher_camel = kebab_to_camel_case(publisher)
    name_camel = kebab_to_camel_case(name)
    return f"{publisher_camel}_{name_camel}"


def generate_extension_names(
    display_name: str, publisher: str, technical_name: str | None = None
) -> ExtensionNames:
    """
    Generate all extension name variants from input.

    Args:
        display_name: Human-readable name (e.g., "Dashboard Widgets")
        publisher: Publisher namespace (e.g., "my-org")
        technical_name: Technical name override, or None to auto-generate

    Returns:
        ExtensionNames: Dictionary with all name variants

    Raises:
        ExtensionNameError: If any name is invalid
    """
    # Validate and normalize inputs
    display_name = validate_display_name(display_name)
    validate_publisher(publisher)

    # Use provided technical name or generate from display name
    if technical_name is None:
        technical_name = suggest_technical_name(display_name)
    else:
        validate_technical_name(technical_name)

    # Generate composite ID
    composite_id = f"{publisher}.{technical_name}"

    # Generate NPM package name
    npm_name = f"@{publisher}/{technical_name}"

    # Generate Module Federation name
    mf_name = get_module_federation_name(publisher, technical_name)

    # Generate backend names with collision protection
    publisher_snake = kebab_to_snake_case(publisher)
    name_snake = kebab_to_snake_case(technical_name)
    backend_package = f"{publisher_snake}-{name_snake}"
    backend_path = f"superset_extensions.{publisher_snake}.{name_snake}"
    backend_entry = f"{backend_path}.entrypoint"

    # Validate the generated names
    validate_python_package_name(publisher_snake)
    validate_python_package_name(name_snake)
    validate_npm_package_name(technical_name)

    return ExtensionNames(
        publisher=publisher,
        name=technical_name,
        display_name=display_name,
        id=composite_id,
        npm_name=npm_name,
        mf_name=mf_name,
        backend_package=backend_package,
        backend_path=backend_path,
        backend_entry=backend_entry,
    )
