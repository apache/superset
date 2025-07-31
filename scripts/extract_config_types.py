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
"""Extract configuration types from runtime inspection of config.py.

This script imports the actual config module and extracts type information
through runtime introspection, providing more accurate type data than
static analysis.
"""

import ast
import inspect
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add superset to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def get_source_comment(module_path: str, var_name: str) -> Optional[str]:
    """Extract comment from source code for a variable."""
    try:
        with open(module_path, "r") as f:
            content = f.read()

        tree = ast.parse(content)
        lines = content.splitlines()

        for node in ast.walk(tree):
            if isinstance(node, ast.Assign):
                if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                    if node.targets[0].id == var_name:
                        # Look for comments above this line
                        line_num = node.lineno - 1  # Convert to 0-based
                        comments = []

                        # Look backwards for comments
                        for i in range(min(5, line_num)):
                            check_line = line_num - i - 1
                            if check_line < 0:
                                break

                            line = lines[check_line].strip()
                            if line.startswith("#"):
                                comment = line[1:].strip()
                                if comment:
                                    comments.insert(0, comment)
                            elif line and not line.startswith("#"):
                                break

                        return " ".join(comments) if comments else None

        return None
    except Exception:
        return None


def analyze_value(value: Any) -> Dict[str, Any]:
    """Analyze a configuration value to extract type information."""
    analysis = {
        "python_type": type(value),
        "type_name": type(value).__name__,
        "module": getattr(type(value), "__module__", None),
        "is_callable": callable(value),
        "is_none": value is None,
    }

    # Basic type categorization
    if value is None:
        analysis["category"] = "null"
    elif isinstance(value, bool):
        analysis["category"] = "boolean"
    elif isinstance(value, int):
        analysis["category"] = "integer"
    elif isinstance(value, float):
        analysis["category"] = "number"
    elif isinstance(value, str):
        analysis["category"] = "string"
    elif isinstance(value, (list, tuple)):
        analysis["category"] = "array"
        # Sample item types
        if value:
            item_types = list(set(type(item).__name__ for item in value[:5]))
            analysis["item_types"] = item_types
    elif isinstance(value, dict):
        analysis["category"] = "object"
        # Sample key/value types
        if value:
            keys = list(value.keys())[:5]
            key_types = list(set(type(k).__name__ for k in keys))
            val_types = list(set(type(value[k]).__name__ for k in keys))
            analysis["key_types"] = key_types
            analysis["value_types"] = val_types
    elif callable(value):
        analysis["category"] = "function"
        try:
            analysis["signature"] = str(inspect.signature(value))
        except Exception:
            pass
    else:
        analysis["category"] = "object"
        analysis["class_name"] = f"{type(value).__module__}.{type(value).__name__}"

    # Serialization check
    try:
        import json

        json.dumps(value)
        analysis["serializable"] = True
    except Exception:
        analysis["serializable"] = False

    return analysis


def categorize_config_key(key: str) -> str:
    """Categorize a configuration key based on its name."""
    key_lower = key.lower()

    if any(
        term in key_lower
        for term in ["secret", "key", "password", "auth", "oauth", "login"]
    ):
        return "security"
    elif any(
        term in key_lower for term in ["db", "database", "sql", "query", "engine"]
    ):
        return "database"
    elif any(
        term in key_lower for term in ["limit", "timeout", "cache", "pool", "async"]
    ):
        return "performance"
    elif any(term in key_lower for term in ["feature", "flag", "enable", "disable"]):
        return "features"
    elif any(
        term in key_lower for term in ["theme", "color", "style", "ui", "frontend"]
    ):
        return "ui"
    elif any(term in key_lower for term in ["log", "debug", "stats", "event"]):
        return "logging"
    elif any(term in key_lower for term in ["mail", "smtp", "email"]):
        return "email"
    elif any(term in key_lower for term in ["celery", "worker", "beat", "task"]):
        return "async"
    else:
        return "general"


def extract_config_types() -> Dict[str, Any]:
    """Extract type information from the config module."""
    try:
        # Import the config module
        from superset import config

        # Get module path for comment extraction
        config_path = inspect.getfile(config)

        results = {}

        # Get all uppercase attributes (configuration convention)
        for name in dir(config):
            if name.isupper() and not name.startswith("_"):
                value = getattr(config, name)

                # Analyze the value
                analysis = analyze_value(value)

                # Get source comment
                comment = get_source_comment(config_path, name)

                # Categorize
                category = categorize_config_key(name)

                results[name] = {
                    "key": name,
                    "value_analysis": analysis,
                    "description": comment,
                    "category": category,
                    "current_value": value
                    if analysis.get("serializable")
                    else f"<{analysis['type_name']} instance>",
                }

        return results

    except ImportError as e:
        print(f"Error importing config: {e}")
        return {}


def compare_with_metadata() -> Dict[str, Any]:
    """Compare runtime config with defined metadata."""
    from superset.config_metadata import CONFIG_METADATA

    runtime_configs = extract_config_types()

    comparison = {
        "in_metadata_only": [],
        "in_runtime_only": [],
        "type_mismatches": [],
        "matching": [],
    }

    metadata_keys = set(CONFIG_METADATA.keys())
    runtime_keys = set(runtime_configs.keys())

    # Keys only in metadata
    comparison["in_metadata_only"] = sorted(metadata_keys - runtime_keys)

    # Keys only in runtime
    comparison["in_runtime_only"] = sorted(runtime_keys - metadata_keys)

    # Check for type mismatches
    for key in metadata_keys & runtime_keys:
        metadata_type = CONFIG_METADATA[key].type
        runtime_type = runtime_configs[key]["value_analysis"]["python_type"]

        if metadata_type != runtime_type:
            comparison["type_mismatches"].append(
                {
                    "key": key,
                    "metadata_type": str(metadata_type),
                    "runtime_type": str(runtime_type),
                }
            )
        else:
            comparison["matching"].append(key)

    return comparison


def suggest_metadata_entries() -> List[str]:
    """Suggest metadata entries for configs not yet documented."""
    runtime_configs = extract_config_types()
    from superset.config_metadata import CONFIG_METADATA

    suggestions = []

    for key, info in runtime_configs.items():
        if key not in CONFIG_METADATA:
            analysis = info["value_analysis"]

            # Build suggested metadata entry
            suggestion = f"""    "{key}": ConfigMetadata(
        key="{key}",
        type={analysis["type_name"]},
        default={repr(info["current_value"]) if analysis["serializable"] else f"{analysis['type_name']}()"},
        description="{info.get("description", "TODO: Add description")}",
        category="{info["category"]}",
        impact="medium",
        requires_restart={"True" if info["category"] in ["security", "database"] else "False"},"""

            if analysis["category"] == "integer":
                suggestion += "\n        min_value=1,"

            if not analysis["serializable"]:
                suggestion += f'\n        serializable=False,\n        doc_default="<{analysis["type_name"]} instance>",'

            suggestion += "\n    ),"

            suggestions.append(suggestion)

    return suggestions


def main():
    """Main function to run type extraction."""
    print("Extracting configuration types from runtime...")

    # Extract types
    runtime_configs = extract_config_types()
    print(f"Found {len(runtime_configs)} configuration variables")

    # Compare with metadata
    print("\nComparing with defined metadata...")
    comparison = compare_with_metadata()

    print(f"  - Matching: {len(comparison['matching'])}")
    print(f"  - Only in metadata: {len(comparison['in_metadata_only'])}")
    print(f"  - Only in runtime: {len(comparison['in_runtime_only'])}")
    print(f"  - Type mismatches: {len(comparison['type_mismatches'])}")

    if comparison["in_runtime_only"]:
        print(f"\nConfigs missing metadata: {len(comparison['in_runtime_only'])}")
        print("Generating suggestions...")

        suggestions = suggest_metadata_entries()

        # Save suggestions to file
        output_file = Path(__file__).parent / "suggested_metadata.py"
        with open(output_file, "w") as f:
            f.write("# Suggested metadata entries for undocumented configs\n\n")
            f.write("\n\n".join(suggestions))

        print(f"Suggestions saved to: {output_file}")

    # Show type distribution
    type_dist = {}
    for config in runtime_configs.values():
        cat = config["value_analysis"]["category"]
        type_dist[cat] = type_dist.get(cat, 0) + 1

    print("\nType distribution:")
    for cat, count in sorted(type_dist.items()):
        print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
