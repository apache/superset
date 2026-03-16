#!/usr/bin/env python3
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
Extract feature flag metadata from superset/config.py.

This script parses the annotated feature flags in config.py and outputs
a JSON file that can be consumed by the documentation site to generate
dynamic feature flag tables.

Usage:
    python scripts/extract_feature_flags.py > docs/static/feature-flags.json

Annotations supported:
    @lifecycle: development | testing | stable | deprecated
    @docs: URL to documentation
    @category: runtime_config | path_to_deprecation | internal (for stable flags)
"""

import json
import re
import sys
from pathlib import Path
from typing import TypedDict


class FeatureFlag(TypedDict, total=False):
    name: str
    default: bool
    lifecycle: str
    description: str
    docs: str | None
    category: str | None


def extract_feature_flags(config_path: Path) -> list[FeatureFlag]:
    """
    Parse config.py and extract feature flag metadata from comments.

    Each flag should have a comment block above it with:
    - Description (first line(s) before @annotations)
    - @lifecycle: development | testing | stable | deprecated
    - @docs: URL (optional)
    - @category: runtime_config | path_to_deprecation | internal (optional)
    """
    content = config_path.read_text()

    # Find the DEFAULT_FEATURE_FLAGS dict (type annotation is optional)
    match = re.search(
        r"DEFAULT_FEATURE_FLAGS(?:\s*:\s*[^=]+)?\s*=\s*\{(.+?)\n\}",
        content,
        re.DOTALL,
    )
    if not match:
        print(
            "ERROR: Could not find DEFAULT_FEATURE_FLAGS in config.py", file=sys.stderr
        )
        sys.exit(1)

    flags_content = match.group(1)
    flags: list[FeatureFlag] = []

    # Split content into lines for easier processing
    lines = flags_content.split("\n")

    current_comments: list[str] = []

    for line in lines:
        stripped = line.strip()

        # Skip section headers and dividers
        if "====" in stripped or "----" in stripped:
            current_comments = []
            continue

        # Collect comment lines
        if stripped.startswith("#"):
            comment_text = stripped[1:].strip()
            # Skip section description comments
            if comment_text.startswith("These features") or comment_text.startswith(
                "These flags"
            ):
                current_comments = []
                continue
            current_comments.append(comment_text)
            continue

        # Check for flag definition
        flag_match = re.match(r'"([A-Z0-9_]+)":\s*(True|False),?', stripped)
        if flag_match:
            if current_comments:
                flag_name = flag_match.group(1)
                default_value = flag_match.group(2) == "True"

                flag = parse_comment_lines(current_comments, flag_name, default_value)
                if flag:
                    flags.append(flag)

            current_comments = []  # Always reset after a flag definition

    return flags


def parse_comment_lines(
    comment_lines: list[str], flag_name: str, default: bool
) -> FeatureFlag | None:
    """Parse comment lines to extract flag metadata."""
    if not comment_lines:
        return None

    lifecycle = None
    docs = None
    category = None
    description_lines = []

    for line in comment_lines:
        if line.startswith("@lifecycle:"):
            lifecycle = line.split(":", 1)[1].strip()
        elif line.startswith("@docs:"):
            docs = line.split(":", 1)[1].strip()
        elif line.startswith("@category:"):
            category = line.split(":", 1)[1].strip()
        elif line and not line.startswith("@"):
            description_lines.append(line)

    if not lifecycle:
        # Skip flags without lifecycle annotation
        return None

    description = " ".join(description_lines)

    flag: FeatureFlag = {
        "name": flag_name,
        "default": default,
        "lifecycle": lifecycle,
        "description": description,
    }

    if docs:
        flag["docs"] = docs
    if category:
        flag["category"] = category

    return flag


def main() -> None:
    # Find config.py relative to this script
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    config_path = repo_root / "superset" / "config.py"

    if not config_path.exists():
        print(f"ERROR: Could not find {config_path}", file=sys.stderr)
        sys.exit(1)

    flags = extract_feature_flags(config_path)

    # Group by lifecycle
    grouped: dict[str, list[FeatureFlag]] = {
        "development": [],
        "testing": [],
        "stable": [],
        "deprecated": [],
    }

    for flag in flags:
        lifecycle = flag.get("lifecycle", "stable")
        if lifecycle in grouped:
            grouped[lifecycle].append(flag)

    # Sort each group alphabetically by name
    for lifecycle in grouped:
        grouped[lifecycle].sort(key=lambda f: f["name"])

    output = {
        "generated": True,
        "source": "superset/config.py",
        "flags": grouped,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
