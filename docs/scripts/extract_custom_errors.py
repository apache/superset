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

"""
Extract custom_errors from database engine specs for documentation.

This script parses engine spec files to extract error handling information
that can be displayed on database documentation pages.

Usage: python scripts/extract_custom_errors.py
Output: JSON mapping of engine spec module names to their custom errors
"""

import ast
import json  # noqa: TID251 - standalone docs script, not part of superset
import sys
from pathlib import Path
from typing import Any

# Map SupersetErrorType values to human-readable categories and issue codes
ERROR_TYPE_INFO = {
    "CONNECTION_INVALID_USERNAME_ERROR": {
        "category": "Authentication",
        "description": "Invalid username",
        "issue_codes": [1012],
    },
    "CONNECTION_INVALID_PASSWORD_ERROR": {
        "category": "Authentication",
        "description": "Invalid password",
        "issue_codes": [1013],
    },
    "CONNECTION_ACCESS_DENIED_ERROR": {
        "category": "Authentication",
        "description": "Access denied",
        "issue_codes": [1014, 1015],
    },
    "CONNECTION_INVALID_HOSTNAME_ERROR": {
        "category": "Connection",
        "description": "Invalid hostname",
        "issue_codes": [1007],
    },
    "CONNECTION_PORT_CLOSED_ERROR": {
        "category": "Connection",
        "description": "Port closed or refused",
        "issue_codes": [1008],
    },
    "CONNECTION_HOST_DOWN_ERROR": {
        "category": "Connection",
        "description": "Host unreachable",
        "issue_codes": [1009],
    },
    "CONNECTION_UNKNOWN_DATABASE_ERROR": {
        "category": "Connection",
        "description": "Unknown database",
        "issue_codes": [1015],
    },
    "CONNECTION_DATABASE_PERMISSIONS_ERROR": {
        "category": "Permissions",
        "description": "Insufficient permissions",
        "issue_codes": [1017],
    },
    "CONNECTION_MISSING_PARAMETERS_ERROR": {
        "category": "Configuration",
        "description": "Missing parameters",
        "issue_codes": [1018],
    },
    "CONNECTION_DATABASE_TIMEOUT": {
        "category": "Connection",
        "description": "Connection timeout",
        "issue_codes": [1001, 1009],
    },
    "COLUMN_DOES_NOT_EXIST_ERROR": {
        "category": "Query",
        "description": "Column not found",
        "issue_codes": [1003, 1004],
    },
    "TABLE_DOES_NOT_EXIST_ERROR": {
        "category": "Query",
        "description": "Table not found",
        "issue_codes": [1003, 1005],
    },
    "SCHEMA_DOES_NOT_EXIST_ERROR": {
        "category": "Query",
        "description": "Schema not found",
        "issue_codes": [1003, 1016],
    },
    "SYNTAX_ERROR": {
        "category": "Query",
        "description": "SQL syntax error",
        "issue_codes": [1030],
    },
    "OBJECT_DOES_NOT_EXIST_ERROR": {
        "category": "Query",
        "description": "Object not found",
        "issue_codes": [1029],
    },
    "GENERIC_DB_ENGINE_ERROR": {
        "category": "General",
        "description": "Database engine error",
        "issue_codes": [1002],
    },
}


def extract_string_from_call(node: ast.Call) -> str | None:
    """Extract string from __() or _() translation calls."""
    if not node.args:
        return None
    arg = node.args[0]
    if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
        return arg.value
    elif isinstance(arg, ast.JoinedStr):
        # f-string - try to reconstruct
        parts = []
        for value in arg.values:
            if isinstance(value, ast.Constant):
                parts.append(str(value.value))
            elif isinstance(value, ast.FormattedValue):
                # Just use a placeholder
                parts.append("{...}")
        return "".join(parts)
    return None


def extract_custom_errors_from_file(filepath: Path) -> dict[str, list[dict[str, Any]]]:
    """
    Extract custom_errors definitions from a Python engine spec file.

    Returns a dict mapping class names to their custom errors list.
    """
    results = {}

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            source = f.read()

        tree = ast.parse(source)

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                class_name = node.name

                for item in node.body:
                    # Look for custom_errors = { ... }
                    if (
                        isinstance(item, ast.AnnAssign)
                        and isinstance(item.target, ast.Name)
                        and item.target.id == "custom_errors"
                        and isinstance(item.value, ast.Dict)
                    ):
                        errors = extract_errors_from_dict(item.value, source)
                        if errors:
                            results[class_name] = errors

                    # Also handle simple assignment: custom_errors = { ... }
                    elif (
                        isinstance(item, ast.Assign)
                        and len(item.targets) == 1
                        and isinstance(item.targets[0], ast.Name)
                        and item.targets[0].id == "custom_errors"
                        and isinstance(item.value, ast.Dict)
                    ):
                        errors = extract_errors_from_dict(item.value, source)
                        if errors:
                            results[class_name] = errors

    except Exception as e:
        print(f"Error parsing {filepath}: {e}", file=sys.stderr)

    return results


def extract_regex_info(key: ast.expr) -> dict[str, Any]:
    """Extract regex pattern info from the dict key."""
    if isinstance(key, ast.Name):
        return {"regex_name": key.id}
    if isinstance(key, ast.Call):
        if (
            isinstance(key.func, ast.Attribute)
            and key.func.attr == "compile"
            and key.args
            and isinstance(key.args[0], ast.Constant)
        ):
            return {"regex_pattern": key.args[0].value}
    return {}


def extract_invalid_fields(extra_node: ast.Dict) -> list[str]:
    """Extract invalid fields from the extra dict."""
    for k, v in zip(extra_node.keys, extra_node.values, strict=False):
        if (
            isinstance(k, ast.Constant)
            and k.value == "invalid"
            and isinstance(v, ast.List)
        ):
            return [elem.value for elem in v.elts if isinstance(elem, ast.Constant)]
    return []


def extract_error_tuple_info(value: ast.Tuple) -> dict[str, Any]:
    """Extract error info from the (message, error_type, extra) tuple."""
    result: dict[str, Any] = {}

    # First element: message template
    msg_node = value.elts[0]
    if isinstance(msg_node, ast.Call):
        message = extract_string_from_call(msg_node)
        if message:
            result["message_template"] = message
    elif isinstance(msg_node, ast.Constant):
        result["message_template"] = msg_node.value

    # Second element: SupersetErrorType.SOMETHING
    type_node = value.elts[1]
    if isinstance(type_node, ast.Attribute):
        error_type = type_node.attr
        result["error_type"] = error_type
        if error_type in ERROR_TYPE_INFO:
            type_info = ERROR_TYPE_INFO[error_type]
            result["category"] = type_info["category"]
            result["description"] = type_info["description"]
            result["issue_codes"] = type_info["issue_codes"]

    # Third element: extra dict with invalid fields
    if len(value.elts) >= 3 and isinstance(value.elts[2], ast.Dict):
        invalid_fields = extract_invalid_fields(value.elts[2])
        if invalid_fields:
            result["invalid_fields"] = invalid_fields

    return result


def extract_errors_from_dict(dict_node: ast.Dict, source: str) -> list[dict[str, Any]]:
    """Extract error information from a custom_errors dict AST node."""
    errors = []

    for key, value in zip(dict_node.keys, dict_node.values, strict=False):
        if key is None or value is None:
            continue

        error_info = extract_regex_info(key)

        if isinstance(value, ast.Tuple) and len(value.elts) >= 2:
            error_info.update(extract_error_tuple_info(value))

        if error_info.get("error_type") and error_info.get("message_template"):
            errors.append(error_info)

    return errors


def main() -> None:
    """Main function to extract custom_errors from all engine specs."""
    # Find the superset root directory
    script_dir = Path(__file__).parent
    root_dir = script_dir.parent.parent
    specs_dir = root_dir / "superset" / "db_engine_specs"

    if not specs_dir.exists():
        print(f"Error: Engine specs directory not found: {specs_dir}", file=sys.stderr)
        sys.exit(1)

    all_errors = {}

    # Process each Python file in the specs directory
    for filepath in sorted(specs_dir.glob("*.py")):
        if filepath.name.startswith("_"):
            continue

        module_name = filepath.stem
        class_errors = extract_custom_errors_from_file(filepath)

        if class_errors:
            # Store errors by module and class
            all_errors[module_name] = class_errors

    # Output as JSON
    print(json.dumps(all_errors, indent=2))


if __name__ == "__main__":
    main()
