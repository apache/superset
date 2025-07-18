#!/usr/bin/env python3
"""
Export configuration metadata to JSON for documentation generation.

This script loads the comprehensive configuration schema from config_schema.json
and formats it for documentation generation.

This script is called by docs/scripts/generate_docs.sh as part of the
unified documentation generation process.
"""

import json as json_module
import sys
from pathlib import Path
from typing import Any, Dict, List

# Add the superset directory to Python path
superset_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(superset_root))


def infer_impact(key: str) -> str:
    """Infer the impact level based on the configuration key name."""
    name_lower = key.lower()

    # High impact - security, database, core functionality
    if any(
        term in name_lower
        for term in [
            "secret",
            "key",
            "password",
            "database",
            "uri",
            "url",
            "security",
            "auth",
        ]
    ):
        return "high"

    # Medium impact - performance, features, UI
    elif any(
        term in name_lower
        for term in ["limit", "timeout", "cache", "feature", "flag", "theme"]
    ):
        return "medium"

    # Low impact - logging, debugging, minor settings
    else:
        return "low"


def infer_requires_restart(key: str) -> bool:
    """Infer if the configuration requires a restart based on the key name."""
    name_lower = key.lower()

    # These typically require restart
    if any(
        term in name_lower
        for term in [
            "secret",
            "key",
            "database",
            "uri",
            "url",
            "security",
            "auth",
            "ssl",
            "tls",
        ]
    ):
        return True

    # These typically don't require restart
    elif any(
        term in name_lower for term in ["limit", "timeout", "cache", "log", "debug"]
    ):
        return False

    # Default to requiring restart for safety
    return True


def export_config_metadata() -> List[Dict[str, Any]]:
    """Export configuration metadata as JSON."""
    # Load the comprehensive configuration schema
    schema_file = superset_root / "superset" / "config_schema.json"

    if not schema_file.exists():
        print(
            "Warning: config_schema.json not found. "
            "Please run scripts/extract_config_schema.py first."
        )
        return []

    with open(schema_file, "r") as f:
        schema_data = json_module.load(f)

    configs = schema_data.get("configs", {})

    # Transform metadata for documentation
    docs_metadata = []

    for key, config in configs.items():
        # Build environment variable name
        env_var = f"SUPERSET__{key}"

        # Extract nested example if available
        nested_example = None
        if config.get("type") == "object":
            nested_example = f"SUPERSET__{key}__example__nested_key=value"

        # Format type information (keep it simple, no boundaries)
        type_info = str(config.get("type", "unknown"))

        doc_entry = {
            "key": key,
            "title": key.replace("_", " ").title(),  # Convert SNAKE_CASE to Title Case
            "description": config.get("description", ""),
            "type": type_info,
            "category": config.get("category", "general"),
            "default": config.get("default"),
            "env_var": env_var,
            "nested_example": nested_example,
            "impact": infer_impact(key),
            "requires_restart": infer_requires_restart(key),
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
        json_module.dump(
            {
                "all_settings": docs_metadata,
                "by_category": categories,
                "categories": list(categories.keys()),
            },
            f,
            indent=2,
        )

    output_file = output_dir / "config_metadata.json"
    print(f"Exported {len(docs_metadata)} configuration settings to {output_file}")
    return docs_metadata


if __name__ == "__main__":
    export_config_metadata()
