#!/usr/bin/env python3
"""
Export configuration metadata to JSON for documentation generation.

This script extracts configuration metadata from SupersetConfig and generates
JSON files that can be imported into the documentation site.
"""

import sys
from pathlib import Path
from typing import Any, Dict, List

# Add the superset directory to Python path
superset_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(superset_root))

from superset.config_extensions import SupersetConfig  # noqa: E402
from superset.utils import json  # noqa: E402


def export_config_metadata() -> List[Dict[str, Any]]:
    """Export configuration metadata as JSON."""
    config = SupersetConfig()

    # Get all settings metadata
    settings_metadata = config.DATABASE_SETTINGS_SCHEMA

    # Transform metadata for documentation
    docs_metadata = []

    for key, schema in settings_metadata.items():
        # Skip readonly settings for user documentation
        if schema.get("readonly", False):
            continue

        # Build environment variable name
        env_var = f"SUPERSET__{key}"

        # Extract nested example if available
        nested_example = None
        if schema.get("type") == "object" and "example" in schema:
            nested_example = f"SUPERSET__{key}__example__nested_key=value"

        # Format type information
        type_info = str(schema.get("type", "unknown"))
        if type_info == "integer":
            min_val = schema.get("minimum")
            max_val = schema.get("maximum")
            if min_val is not None or max_val is not None:
                min_str = str(min_val) if min_val is not None else "N/A"
                max_str = str(max_val) if max_val is not None else "N/A"
                type_info += f" ({min_str} - {max_str})"

        doc_entry = {
            "key": key,
            "title": schema.get("title", key),
            "description": schema.get("description", ""),
            "type": type_info,
            "category": schema.get("category", "general"),
            "impact": schema.get("impact", "medium"),
            "requires_restart": schema.get("requires_restart", True),
            "default": schema.get("default"),
            "env_var": env_var,
            "nested_example": nested_example,
            "documentation_url": schema.get("documentation_url"),
        }

        docs_metadata.append(doc_entry)

    # Group by category
    categories: Dict[str, List[Dict[str, Any]]] = {}
    for entry in docs_metadata:
        category = str(entry["category"])
        if category not in categories:
            categories[category] = []
        categories[category].append(entry)

    # Sort entries within each category
    for category in categories:
        categories[category].sort(key=lambda x: x["key"])

    # Export as JSON
    output_dir = Path(__file__).parent.parent / "src" / "resources"
    output_dir.mkdir(exist_ok=True)

    # Export all settings
    with open(output_dir / "config_metadata.json", "w") as f:
        f.write(
            json.dumps(
                {
                    "all_settings": docs_metadata,
                    "by_category": categories,
                    "categories": list(categories.keys()),
                },
                indent=2,
            )
        )

    output_file = output_dir / "config_metadata.json"
    print(f"Exported {len(docs_metadata)} configuration settings to {output_file}")
    return docs_metadata


if __name__ == "__main__":
    export_config_metadata()
