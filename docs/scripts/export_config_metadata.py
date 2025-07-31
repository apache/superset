#!/usr/bin/env python3
"""
Export configuration metadata to JSON for documentation generation.

This script loads configuration metadata from the Python metadata module
and exports it in JSON format for the documentation React components.

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
    try:
        # Import from Python metadata module
        from superset.config_metadata import export_for_documentation

        # Get metadata from Python source
        metadata_export = export_for_documentation()

        # Export as JSON for documentation
        output_dir = Path(__file__).parent.parent / "src" / "resources"
        output_dir.mkdir(exist_ok=True)

        # Write the full export (includes categories, etc.)
        with open(output_dir / "config_metadata.json", "w") as f:
            json_module.dump(metadata_export, f, indent=2)

        output_file = output_dir / "config_metadata.json"
        print(
            f"Exported {len(metadata_export['all_settings'])} configuration settings to {output_file}"
        )

        return metadata_export["all_settings"]

    except ImportError as e:
        print(f"Error importing config_metadata: {e}")
        print("Please ensure superset/config_metadata.py exists")
        return []


if __name__ == "__main__":
    export_config_metadata()
