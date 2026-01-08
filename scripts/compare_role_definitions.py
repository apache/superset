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
Compare role definitions between two JSON files and generate a report.

This script compares the output of extract_role_definitions.py between
two commits to identify changes in role permissions.

Usage:
    python scripts/compare_role_definitions.py base.json head.json [--format FORMAT]
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


def load_definitions(path: Path) -> dict[str, Any]:
    """Load role definitions from a JSON file."""
    return json.loads(path.read_text())


def compare_sets(
    base_values: list[str],
    head_values: list[str],
) -> tuple[list[str], list[str], list[str]]:
    """Compare two lists and return added, removed, and unchanged items."""
    base_set = set(base_values)
    head_set = set(head_values)

    added = sorted(head_set - base_set)
    removed = sorted(base_set - head_set)
    unchanged = sorted(base_set & head_set)

    return added, removed, unchanged


def generate_diff(
    base: dict[str, Any],
    head: dict[str, Any],
) -> dict[str, Any]:
    """Generate a diff between base and head definitions."""
    base_constants = base.get("constants", {})
    head_constants = head.get("constants", {})

    all_keys = sorted(set(base_constants.keys()) | set(head_constants.keys()))

    diff: dict[str, Any] = {
        "changes": {},
        "summary": {
            "total_constants": len(all_keys),
            "constants_with_changes": 0,
            "total_added": 0,
            "total_removed": 0,
        },
    }

    for key in all_keys:
        base_values = base_constants.get(key, [])
        head_values = head_constants.get(key, [])

        added, removed, _ = compare_sets(base_values, head_values)

        if added or removed:
            diff["changes"][key] = {
                "added": added,
                "removed": removed,
            }
            diff["summary"]["constants_with_changes"] += 1
            diff["summary"]["total_added"] += len(added)
            diff["summary"]["total_removed"] += len(removed)

    return diff


def format_markdown(diff: dict[str, Any]) -> str:
    """Format the diff as markdown for PR comments."""
    lines = []
    summary = diff["summary"]
    changes = diff["changes"]

    if not changes:
        lines.append("## Role Definitions: No Changes Detected")
        lines.append("")
        lines.append(
            "No changes to role-defining constants in `superset/security/manager.py`."
        )
        return "\n".join(lines)

    lines.append("## Role Definitions: Changes Detected")
    lines.append("")
    lines.append(
        f"Found changes in **{summary['constants_with_changes']}** "
        f"role-defining constant(s):"
    )
    lines.append(
        f"- **{summary['total_added']}** permission(s) added"
    )
    lines.append(
        f"- **{summary['total_removed']}** permission(s) removed"
    )
    lines.append("")

    # Map constant names to their role implications
    role_implications = {
        "ADMIN_ONLY_VIEW_MENUS": "Admin",
        "ADMIN_ONLY_PERMISSIONS": "Admin",
        "ALPHA_ONLY_VIEW_MENUS": "Alpha",
        "ALPHA_ONLY_PERMISSIONS": "Alpha",
        "ALPHA_ONLY_PMVS": "Alpha",
        "GAMMA_READ_ONLY_MODEL_VIEWS": "Gamma",
        "READ_ONLY_MODEL_VIEWS": "All roles (read-only)",
        "READ_ONLY_PERMISSION": "All roles (read-only)",
        "SQLLAB_ONLY_PERMISSIONS": "SQL Lab",
        "SQLLAB_EXTRA_PERMISSION_VIEWS": "SQL Lab",
        "ACCESSIBLE_PERMS": "All authenticated users",
        "OBJECT_SPEC_PERMISSIONS": "Data access (user-defined)",
        "USER_MODEL_VIEWS": "Admin (user management)",
        "data_access_permissions": "Data access",
    }

    for const_name, const_changes in sorted(changes.items()):
        role_hint = role_implications.get(const_name, "Various")
        lines.append(f"### `{const_name}` (affects: {role_hint})")
        lines.append("")

        if const_changes["added"]:
            lines.append("**Added:**")
            for item in const_changes["added"]:
                lines.append(f"- `{item}`")
            lines.append("")

        if const_changes["removed"]:
            lines.append("**Removed:**")
            for item in const_changes["removed"]:
                lines.append(f"- `{item}`")
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(
        "*This report was generated by the role tracking workflow. "
        "Please review these changes carefully as they affect user permissions. "
        "If these permission changes are a breaking change, please document them "
        "in `UPDATING.md`.*"
    )

    return "\n".join(lines)


def format_json(diff: dict[str, Any]) -> str:
    """Format the diff as JSON."""
    return json.dumps(diff, indent=2, sort_keys=True)


def format_text(diff: dict[str, Any]) -> str:
    """Format the diff as plain text."""
    lines = []
    summary = diff["summary"]
    changes = diff["changes"]

    if not changes:
        lines.append("No changes to role definitions detected.")
        return "\n".join(lines)

    lines.append("Role Definition Changes")
    lines.append("=" * 50)
    lines.append(f"Constants with changes: {summary['constants_with_changes']}")
    lines.append(f"Total added: {summary['total_added']}")
    lines.append(f"Total removed: {summary['total_removed']}")
    lines.append("")

    for const_name, const_changes in sorted(changes.items()):
        lines.append(f"{const_name}:")
        if const_changes["added"]:
            lines.append("  Added:")
            for item in const_changes["added"]:
                lines.append(f"    + {item}")
        if const_changes["removed"]:
            lines.append("  Removed:")
            for item in const_changes["removed"]:
                lines.append(f"    - {item}")
        lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare role definitions between two commits"
    )
    parser.add_argument(
        "base",
        type=str,
        help="Path to base (before) definitions JSON",
    )
    parser.add_argument(
        "head",
        type=str,
        help="Path to head (after) definitions JSON",
    )
    parser.add_argument(
        "--format",
        "-f",
        type=str,
        choices=["markdown", "json", "text"],
        default="markdown",
        help="Output format (default: markdown)",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        help="Output file path (default: stdout)",
    )
    parser.add_argument(
        "--github-output",
        action="store_true",
        help="Write to GITHUB_OUTPUT for GitHub Actions",
    )
    args = parser.parse_args()

    base_path = Path(args.base)
    head_path = Path(args.head)

    if not base_path.exists():
        print(f"Error: Base file not found: {base_path}")
        return 1
    if not head_path.exists():
        print(f"Error: Head file not found: {head_path}")
        return 1

    try:
        base = load_definitions(base_path)
        head = load_definitions(head_path)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return 1

    diff = generate_diff(base, head)

    formatters = {
        "markdown": format_markdown,
        "json": format_json,
        "text": format_text,
    }
    output = formatters[args.format](diff)

    if args.output:
        Path(args.output).write_text(output)
    else:
        print(output)

    # Write GitHub Actions output if requested
    if args.github_output:
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            has_changes = "true" if diff["changes"] else "false"
            with open(github_output, "a") as f:
                f.write(f"has_changes={has_changes}\n")
                f.write(f"added_count={diff['summary']['total_added']}\n")
                f.write(f"removed_count={diff['summary']['total_removed']}\n")

    # Return non-zero if there are changes (useful for CI)
    return 0


if __name__ == "__main__":
    sys.exit(main())
