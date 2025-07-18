#!/usr/bin/env python3
"""
Extract configuration schema from config_defaults.py.

This script parses the existing config_defaults.py file and extracts:
- All configuration keys and their default values
- Comments above each key as descriptions
- Types inferred from the default values

The output is a comprehensive JSON schema that can be used for:
- Documentation generation
- Configuration validation
- IDE autocomplete
"""

import ast
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


def infer_type(value: Any) -> str:
    """Infer the configuration type from the default value."""
    if value is None:
        return "null"
    elif isinstance(value, bool):
        return "boolean"
    elif isinstance(value, int):
        return "integer"
    elif isinstance(value, float):
        return "number"
    elif isinstance(value, str):
        return "string"
    elif isinstance(value, (list, tuple)):
        return "array"
    elif isinstance(value, dict):
        return "object"
    else:
        return "unknown"


def extract_comments_before_line(lines: List[str], line_num: int) -> List[str]:
    """Extract comments immediately before a configuration line."""
    comments: List[str] = []
    current_line = line_num - 2  # line_num is 1-based, so -2 to get previous line

    # Look backwards for comments, but only go back a few lines to avoid
    # picking up unrelated comments
    max_lookback = min(5, current_line + 1)

    for i in range(max_lookback):
        if current_line - i < 0:
            break

        line = lines[current_line - i].strip()
        if line.startswith("#"):
            # Remove the '#' and clean up the comment
            comment = line[1:].strip()
            if comment:  # Only add non-empty comments
                comments.insert(0, comment)
        elif line == "":
            # Empty line - continue looking
            continue
        else:
            # Non-comment, non-empty line - stop looking
            break

    return comments


def safe_eval(node: ast.AST) -> Any:  # noqa: C901
    """Safely evaluate an AST node to get its value."""
    try:
        if isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.Num):  # Python < 3.8
            return node.n
        elif isinstance(node, ast.Str):  # Python < 3.8
            return node.s
        elif isinstance(node, ast.List):
            return [safe_eval(item) for item in node.elts]
        elif isinstance(node, ast.Dict):
            return {
                safe_eval(k): safe_eval(v)
                for k, v in zip(node.keys, node.values, strict=False)
                if k is not None
            }
        elif isinstance(node, ast.Name):
            # Handle common constants
            if node.id == "True":
                return True
            elif node.id == "False":
                return False
            elif node.id == "None":
                return None
            else:
                return f"<{node.id}>"  # Placeholder for variables
        elif isinstance(node, ast.Call):
            # Handle specific function calls we know about
            if isinstance(node.func, ast.Name):
                if node.func.id == "int" and len(node.args) == 1:
                    # Handle int() calls
                    inner = safe_eval(node.args[0])
                    if isinstance(inner, str) and inner.startswith("<"):
                        return 30  # Common default for timeouts
                    return inner
                elif node.func.id == "timedelta":
                    # Handle timedelta calls - just return a reasonable default
                    return 30
                else:
                    return f"<{node.func.id}()>"
            else:
                return "<function_call>"
        elif isinstance(node, ast.Attribute):
            # Handle attribute access like obj.attr
            try:
                return f"<{ast.unparse(node)}>"
            except Exception:
                return "<attribute>"
        elif isinstance(node, ast.BoolOp):
            # Handle boolean operations like 'or'
            return None  # Common pattern: value or None
        else:
            # For complex expressions, return a placeholder
            return f"<{type(node).__name__}>"
    except Exception:
        return "<unknown>"


def extract_config_schema(config_file: Path) -> Dict[str, Any]:
    """Extract configuration schema from config_defaults.py."""
    with open(config_file, "r") as f:
        content = f.read()
        lines = content.splitlines()

    # Parse the Python file
    tree = ast.parse(content)

    schema = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            # Check if this is a simple assignment to a variable
            if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                var_name = node.targets[0].id

                # Only include uppercase variables (configuration convention)
                if var_name.isupper():
                    # Get the default value
                    default_value = safe_eval(node.value)

                    # Get comments before this line
                    comments = extract_comments_before_line(lines, node.lineno)
                    description = " ".join(comments) if comments else ""

                    # Infer type from default value
                    config_type = infer_type(default_value)

                    # Determine category based on variable name patterns
                    category = categorize_config(var_name)

                    schema[var_name] = {
                        "type": config_type,
                        "default": default_value,
                        "description": description,
                        "category": category,
                    }

    return schema


def categorize_config(var_name: str) -> str:
    """Categorize configuration variables based on their names."""
    name_lower = var_name.lower()

    if any(term in name_lower for term in ["limit", "timeout", "cache", "pool"]):
        return "performance"
    elif any(term in name_lower for term in ["feature", "flag", "enable", "disable"]):
        return "features"
    elif any(term in name_lower for term in ["theme", "color", "style", "ui"]):
        return "ui"
    elif any(term in name_lower for term in ["db", "database", "sql", "query"]):
        return "database"
    elif any(term in name_lower for term in ["auth", "security", "login", "oauth"]):
        return "security"
    elif any(term in name_lower for term in ["log", "debug", "stats"]):
        return "logging"
    elif any(term in name_lower for term in ["mail", "smtp", "email"]):
        return "email"
    elif any(term in name_lower for term in ["celery", "async", "worker"]):
        return "async"
    else:
        return "general"


def main() -> None:
    """Extract configuration schema and save to JSON."""
    superset_root = Path(__file__).parent.parent
    config_file = superset_root / "superset" / "config_defaults.py"

    if not config_file.exists():
        print(f"Error: {config_file} not found")
        sys.exit(1)

    print("Extracting configuration schema...")
    schema = extract_config_schema(config_file)

    # Create output structure
    output = {
        "metadata": {
            "generated_from": str(config_file),
            "total_configs": len(schema),
            "description": (
                "Superset configuration schema extracted from config_defaults.py"
            ),
        },
        "configs": schema,
        "by_category": {},
    }

    # Group by category
    for key, config in schema.items():
        category = config["category"]
        if category not in output["by_category"]:
            output["by_category"][category] = {}
        output["by_category"][category][key] = config

    # Save to JSON
    output_file = superset_root / "superset" / "config_schema.json"
    with open(output_file, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print("✅ Schema extracted successfully!")
    print(f"📊 Total configurations: {len(schema)}")
    print(f"📂 Categories: {list(output['by_category'].keys())}")
    print(f"💾 Saved to: {output_file}")

    # Show some stats
    print("\n📈 Category breakdown:")
    for category, configs in output["by_category"].items():
        print(f"   {category}: {len(configs)} configs")


if __name__ == "__main__":
    main()
