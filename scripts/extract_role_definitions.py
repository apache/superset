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
Extract role definitions from the security manager for CI comparison.

This script parses the SupersetSecurityManager class and extracts the constants
that define role permissions. It outputs JSON that can be compared between
commits to detect role changes.

Usage:
    python scripts/extract_role_definitions.py [--output FILE]
"""

import argparse
import ast
import json
import sys
from pathlib import Path
from typing import Any


# Constants that define role permissions in SupersetSecurityManager
ROLE_DEFINING_CONSTANTS = [
    "READ_ONLY_MODEL_VIEWS",
    "USER_MODEL_VIEWS",
    "GAMMA_READ_ONLY_MODEL_VIEWS",
    "ADMIN_ONLY_VIEW_MENUS",
    "ALPHA_ONLY_VIEW_MENUS",
    "ALPHA_ONLY_PMVS",
    "ADMIN_ONLY_PERMISSIONS",
    "READ_ONLY_PERMISSION",
    "ALPHA_ONLY_PERMISSIONS",
    "OBJECT_SPEC_PERMISSIONS",
    "ACCESSIBLE_PERMS",
    "SQLLAB_ONLY_PERMISSIONS",
    "SQLLAB_EXTRA_PERMISSION_VIEWS",
    "data_access_permissions",
]


def _is_set_or_frozenset_call(node: ast.Call) -> bool:
    """Check if an AST Call node is a set() or frozenset() call."""
    if isinstance(node.func, ast.Name):
        return node.func.id in ("frozenset", "set")
    if isinstance(node.func, ast.Attribute):
        # Handle builtins.frozenset, builtins.set, etc.
        return node.func.attr in ("frozenset", "set")
    return False


def parse_set_or_tuple(node: ast.expr) -> list[Any]:
    """Parse an AST node representing a set, frozenset, tuple, list, or set operations."""
    if isinstance(node, ast.Set):
        return [parse_element(elt) for elt in node.elts]
    if isinstance(node, ast.Tuple):
        return [parse_element(elt) for elt in node.elts]
    if isinstance(node, ast.List):
        return [parse_element(elt) for elt in node.elts]
    if isinstance(node, ast.Call):
        # Handle frozenset() or set() calls (including attribute access like builtins.set)
        if _is_set_or_frozenset_call(node):
            if node.args:
                return parse_set_or_tuple(node.args[0])
        return []
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        # Handle set union operations like {a} | {b}
        left = parse_set_or_tuple(node.left)
        right = parse_set_or_tuple(node.right)
        return left + right
    if isinstance(node, ast.Name):
        # Reference to another constant - return a placeholder
        return [f"${node.id}"]
    return []


def parse_element(node: ast.expr) -> Any:
    """Parse a single element from a set or tuple."""
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Str):  # Python 3.7 compatibility
        return node.s
    if isinstance(node, ast.Tuple):
        return tuple(parse_element(elt) for elt in node.elts)
    if isinstance(node, ast.Name):
        return f"${node.id}"
    return str(ast.dump(node))


def extract_class_attributes(
    class_def: ast.ClassDef,
    target_names: list[str],
) -> dict[str, list[Any]]:
    """Extract specified attributes from a class definition."""
    results: dict[str, list[Any]] = {}

    for node in class_def.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in target_names:
                    results[target.id] = sorted(
                        parse_set_or_tuple(node.value),
                        key=lambda x: str(x),
                    )
        elif isinstance(node, ast.AnnAssign):
            if (
                isinstance(node.target, ast.Name)
                and node.target.id in target_names
                and node.value
            ):
                results[node.target.id] = sorted(
                    parse_set_or_tuple(node.value),
                    key=lambda x: str(x),
                )

    return results


def resolve_references(
    definitions: dict[str, list[Any]],
) -> dict[str, list[Any]]:
    """Resolve references to other constants (marked with $) with cycle detection."""
    resolved: dict[str, list[Any]] = {}

    def resolve_value(
        value: Any,
        seen: set[str],
    ) -> list[Any]:
        """Recursively resolve a single value, tracking seen references for cycles."""
        if not (isinstance(value, str) and value.startswith("$")):
            return [value]

        ref_name = value[1:]

        # Cycle detection: if we've seen this reference, skip it
        if ref_name in seen:
            return []

        if ref_name not in definitions:
            return [value]  # Keep unresolved reference as-is

        # Mark as seen and recursively resolve
        new_seen = seen | {ref_name}
        result = []
        for ref_value in definitions[ref_name]:
            result.extend(resolve_value(ref_value, new_seen))
        return result

    for name, values in definitions.items():
        resolved_values = []
        for value in values:
            resolved_values.extend(resolve_value(value, {name}))
        resolved[name] = sorted(set(str(v) for v in resolved_values))

    return resolved


def extract_role_definitions(security_manager_path: Path) -> dict[str, Any]:
    """Extract role definitions from the security manager source file."""
    source_code = security_manager_path.read_text()
    tree = ast.parse(source_code)

    # Find the SupersetSecurityManager class
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "SupersetSecurityManager":
            raw_definitions = extract_class_attributes(node, ROLE_DEFINING_CONSTANTS)
            resolved = resolve_references(raw_definitions)
            return {
                "constants": resolved,
                "source_file": str(security_manager_path),
            }

    raise ValueError("SupersetSecurityManager class not found")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract role definitions from security manager"
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        help="Output file path (default: stdout)",
    )
    parser.add_argument(
        "--security-manager",
        type=str,
        default="superset/security/manager.py",
        help="Path to security manager file",
    )
    args = parser.parse_args()

    # Find the security manager file
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    security_manager_path = repo_root / args.security_manager

    if not security_manager_path.exists():
        print(f"Error: Security manager not found at {security_manager_path}")
        return 1

    try:
        definitions = extract_role_definitions(security_manager_path)
    except Exception as e:
        print(f"Error extracting definitions: {e}")
        return 1

    output = json.dumps(definitions, indent=2, sort_keys=True)

    if args.output:
        Path(args.output).write_text(output)
    else:
        print(output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
