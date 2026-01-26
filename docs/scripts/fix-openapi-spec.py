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
Fix missing schema references in the OpenAPI spec.

This script patches the openapi.json file to add any missing schemas
that are referenced but not defined.
"""

import json  # noqa: TID251 - standalone docs script
import sys
from pathlib import Path


def add_missing_schemas(spec: dict) -> tuple[dict, list[str]]:
    """Add missing schema definitions to the OpenAPI spec."""
    schemas = spec.get("components", {}).get("schemas", {})
    fixed = []

    # DashboardScreenshotPostSchema - based on superset/dashboards/schemas.py
    if "DashboardScreenshotPostSchema" not in schemas:
        schemas["DashboardScreenshotPostSchema"] = {
            "type": "object",
            "properties": {
                "dataMask": {
                    "type": "object",
                    "description": "An object representing the data mask.",
                    "additionalProperties": True,
                },
                "activeTabs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "A list representing active tabs.",
                },
                "anchor": {
                    "type": "string",
                    "description": "A string representing the anchor.",
                },
                "urlParams": {
                    "type": "array",
                    "items": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 2,
                        "maxItems": 2,
                    },
                    "description": "A list of tuples, each containing two strings.",
                },
            },
        }
        fixed.append("DashboardScreenshotPostSchema")

    # DashboardNativeFiltersConfigUpdateSchema - based on superset/dashboards/schemas.py
    if "DashboardNativeFiltersConfigUpdateSchema" not in schemas:
        schemas["DashboardNativeFiltersConfigUpdateSchema"] = {
            "type": "object",
            "properties": {
                "deleted": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of deleted filter IDs.",
                },
                "modified": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "List of modified filter configurations.",
                },
                "reordered": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of filter IDs in new order.",
                },
            },
        }
        fixed.append("DashboardNativeFiltersConfigUpdateSchema")

    # DashboardColorsConfigUpdateSchema - based on superset/dashboards/schemas.py
    if "DashboardColorsConfigUpdateSchema" not in schemas:
        schemas["DashboardColorsConfigUpdateSchema"] = {
            "type": "object",
            "properties": {
                "color_namespace": {
                    "type": "string",
                    "nullable": True,
                    "description": "The color namespace.",
                },
                "color_scheme": {
                    "type": "string",
                    "nullable": True,
                    "description": "The color scheme name.",
                },
                "map_label_colors": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                    "description": "Mapping of labels to colors.",
                },
                "shared_label_colors": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                    "description": "Shared label colors across charts.",
                },
                "label_colors": {
                    "type": "object",
                    "additionalProperties": {"type": "string"},
                    "description": "Label to color mapping.",
                },
                "color_scheme_domain": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Color scheme domain values.",
                },
            },
        }
        fixed.append("DashboardColorsConfigUpdateSchema")

    # FormatQueryPayloadSchema - based on superset/sqllab/schemas.py
    if "FormatQueryPayloadSchema" not in schemas:
        schemas["FormatQueryPayloadSchema"] = {
            "type": "object",
            "required": ["sql"],
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "The SQL query to format.",
                },
                "engine": {
                    "type": "string",
                    "nullable": True,
                    "description": "The database engine.",
                },
                "database_id": {
                    "type": "integer",
                    "nullable": True,
                    "description": "The database id.",
                },
                "template_params": {
                    "type": "string",
                    "nullable": True,
                    "description": "The SQL query template params as JSON string.",
                },
            },
        }
        fixed.append("FormatQueryPayloadSchema")

    # get_slack_channels_schema - based on superset/reports/schemas.py
    if "get_slack_channels_schema" not in schemas:
        schemas["get_slack_channels_schema"] = {
            "type": "object",
            "properties": {
                "search_string": {
                    "type": "string",
                    "description": "String to search for in channel names.",
                },
                "types": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["public_channel", "private_channel"],
                    },
                    "description": "Types of channels to search.",
                },
                "exact_match": {
                    "type": "boolean",
                    "description": "Whether to match channel names exactly.",
                },
            },
        }
        fixed.append("get_slack_channels_schema")

    if "components" not in spec:
        spec["components"] = {}
    spec["components"]["schemas"] = schemas

    return spec, fixed


def path_to_operation_id(path: str, method: str) -> str:
    """Convert a path and method to an operationId."""
    # Remove /api/v1/ prefix
    clean_path = path.replace("/api/v1/", "").strip("/")

    # Replace path parameters
    clean_path = clean_path.replace("{", "by_").replace("}", "")

    # Convert to snake_case
    parts = clean_path.replace("/", "_").split("_")

    # Create operation name
    method_prefix = {
        "get": "get",
        "post": "create",
        "put": "update",
        "delete": "delete",
        "patch": "patch",
    }.get(method.lower(), method.lower())

    return f"{method_prefix}_{clean_path}".replace("/", "_").replace("-", "_")


def path_to_summary(path: str, method: str) -> str:
    """Generate a human-readable summary from path and method."""
    # Remove /api/v1/ prefix
    clean_path = path.replace("/api/v1/", "").strip("/")

    # Handle path parameters
    parts = []
    for part in clean_path.split("/"):
        if part.startswith("{") and part.endswith("}"):
            param = part[1:-1]
            parts.append(f"by {param}")
        else:
            parts.append(part.replace("_", " ").replace("-", " "))

    resource = " ".join(parts)

    method_verb = {
        "get": "Get",
        "post": "Create",
        "put": "Update",
        "delete": "Delete",
        "patch": "Update",
    }.get(method.lower(), method.capitalize())

    return f"{method_verb} {resource}"


def add_missing_operation_ids(spec: dict) -> int:
    """Add operationId and summary to operations that are missing them."""
    fixed_count = 0

    for path, methods in spec.get("paths", {}).items():
        for method, details in methods.items():
            if method not in ["get", "post", "put", "delete", "patch"]:
                continue

            if not isinstance(details, dict):
                continue

            summary = details.get("summary")
            operation_id = details.get("operationId")

            if not summary and not operation_id:
                details["operationId"] = path_to_operation_id(path, method)
                details["summary"] = path_to_summary(path, method)
                fixed_count += 1

    return fixed_count


TAG_DESCRIPTIONS = {
    "Advanced Data Type": "Endpoints for advanced data type operations and conversions.",
    "Annotation Layers": "Manage annotation layers and annotations for charts.",
    "AsyncEventsRestApi": "Real-time event streaming via Server-Sent Events (SSE).",
    "Available Domains": "Get available domains for the Superset instance.",
    "CSS Templates": "Manage CSS templates for custom dashboard styling.",
    "CacheRestApi": "Cache management and invalidation operations.",
    "Charts": "Create, read, update, and delete charts (slices).",
    "Current User": "Get information about the currently authenticated user.",
    "Dashboard Filter State": "Manage temporary filter state for dashboards.",
    "Dashboard Permanent Link": "Create and retrieve permanent links to dashboard states.",
    "Dashboards": "Create, read, update, and delete dashboards.",
    "Database": "Manage database connections and metadata.",
    "Datasets": "Manage datasets (tables) used for building charts.",
    "Datasources": "Query datasource metadata and column values.",
    "Embedded Dashboard": "Configure embedded dashboard settings.",
    "Explore": "Chart exploration and data querying endpoints.",
    "Explore Form Data": "Manage temporary form data for chart exploration.",
    "Explore Permanent Link": "Create and retrieve permanent links to chart explore states.",
    "Import/export": "Import and export Superset assets (dashboards, charts, databases).",
    "LogRestApi": "Access audit logs and activity history.",
    "Menu": "Get the Superset menu structure.",
    "OpenApi": "Access the OpenAPI specification.",
    "Queries": "View and manage SQL Lab query history.",
    "Report Schedules": "Configure scheduled reports and alerts.",
    "Row Level Security": "Manage row-level security rules for data access control.",
    "SQL Lab": "Execute SQL queries and manage SQL Lab sessions.",
    "SQL Lab Permanent Link": "Create and retrieve permanent links to SQL Lab states.",
    "Security": "Authentication and token management.",
    "Security Permissions": "View available permissions.",
    "Security Permissions on Resources (View Menus)": "Manage permission-resource mappings.",
    "Security Resources (View Menus)": "Manage security resources (view menus).",
    "Security Roles": "Manage security roles and their permissions.",
    "Security Users": "Manage user accounts.",
    "Tags": "Organize assets with tags.",
    "User": "User profile and preferences.",
}


def generate_code_sample(method: str, path: str, has_body: bool = False) -> list[dict]:
    """Generate code samples for an endpoint in multiple languages."""
    # Clean up path for display
    example_path = path.replace("{pk}", "1").replace("{id_or_slug}", "1")

    samples = []

    # cURL sample
    curl_cmd = f'curl -X {method.upper()} "http://localhost:8088{example_path}"'
    curl_cmd += ' \\\n  -H "Authorization: Bearer $ACCESS_TOKEN"'
    if has_body:
        curl_cmd += ' \\\n  -H "Content-Type: application/json"'
        curl_cmd += " \\\n  -d '{\"key\": \"value\"}'"

    samples.append({
        "lang": "cURL",
        "label": "cURL",
        "source": curl_cmd,
    })

    # Python sample
    if method.lower() == "get":
        python_code = f'''import requests

response = requests.get(
    "http://localhost:8088{example_path}",
    headers={{"Authorization": "Bearer " + access_token}}
)
print(response.json())'''
    elif method.lower() == "post":
        python_code = f'''import requests

response = requests.post(
    "http://localhost:8088{example_path}",
    headers={{"Authorization": "Bearer " + access_token}},
    json={{"key": "value"}}
)
print(response.json())'''
    elif method.lower() == "put":
        python_code = f'''import requests

response = requests.put(
    "http://localhost:8088{example_path}",
    headers={{"Authorization": "Bearer " + access_token}},
    json={{"key": "value"}}
)
print(response.json())'''
    elif method.lower() == "delete":
        python_code = f'''import requests

response = requests.delete(
    "http://localhost:8088{example_path}",
    headers={{"Authorization": "Bearer " + access_token}}
)
print(response.status_code)'''
    else:
        python_code = f'''import requests

response = requests.{method.lower()}(
    "http://localhost:8088{example_path}",
    headers={{"Authorization": "Bearer " + access_token}}
)
print(response.json())'''

    samples.append({
        "lang": "Python",
        "label": "Python",
        "source": python_code,
    })

    # JavaScript sample
    if method.lower() == "get":
        js_code = f'''const response = await fetch(
  "http://localhost:8088{example_path}",
  {{
    headers: {{
      "Authorization": `Bearer ${{accessToken}}`
    }}
  }}
);
const data = await response.json();
console.log(data);'''
    elif method.lower() in ["post", "put", "patch"]:
        js_code = f'''const response = await fetch(
  "http://localhost:8088{example_path}",
  {{
    method: "{method.upper()}",
    headers: {{
      "Authorization": `Bearer ${{accessToken}}`,
      "Content-Type": "application/json"
    }},
    body: JSON.stringify({{ key: "value" }})
  }}
);
const data = await response.json();
console.log(data);'''
    else:
        js_code = f'''const response = await fetch(
  "http://localhost:8088{example_path}",
  {{
    method: "{method.upper()}",
    headers: {{
      "Authorization": `Bearer ${{accessToken}}`
    }}
  }}
);
console.log(response.status);'''

    samples.append({
        "lang": "JavaScript",
        "label": "JavaScript",
        "source": js_code,
    })

    return samples


def add_code_samples(spec: dict) -> int:
    """Add code samples to all endpoints."""
    count = 0

    for path, methods in spec.get("paths", {}).items():
        for method, details in methods.items():
            if method not in ["get", "post", "put", "delete", "patch"]:
                continue
            if not isinstance(details, dict):
                continue

            # Skip if already has code samples
            if "x-codeSamples" in details:
                continue

            # Check if endpoint has a request body
            has_body = "requestBody" in details

            details["x-codeSamples"] = generate_code_sample(method, path, has_body)
            count += 1

    return count


def configure_servers(spec: dict) -> bool:
    """Configure server URLs with variables for flexible API testing."""
    new_servers = [
        {
            "url": "http://localhost:8088",
            "description": "Local development server",
        },
        {
            "url": "{protocol}://{host}:{port}",
            "description": "Custom server",
            "variables": {
                "protocol": {
                    "default": "http",
                    "enum": ["http", "https"],
                    "description": "HTTP protocol",
                },
                "host": {
                    "default": "localhost",
                    "description": "Server hostname or IP",
                },
                "port": {
                    "default": "8088",
                    "description": "Server port",
                },
            },
        },
    ]

    # Check if already configured
    existing = spec.get("servers", [])
    if len(existing) >= 2 and any("variables" in s for s in existing):
        return False

    spec["servers"] = new_servers
    return True


def add_tag_definitions(spec: dict) -> int:
    """Add tag definitions with descriptions to the OpenAPI spec."""
    # Collect all unique tags used in operations
    used_tags: set[str] = set()
    for path, methods in spec.get("paths", {}).items():
        for method, details in methods.items():
            if method not in ["get", "post", "put", "delete", "patch"]:
                continue
            if not isinstance(details, dict):
                continue
            tags = details.get("tags", [])
            used_tags.update(tags)

    # Create tag definitions
    tag_definitions = []
    for tag in sorted(used_tags):
        tag_def = {"name": tag}
        if tag in TAG_DESCRIPTIONS:
            tag_def["description"] = TAG_DESCRIPTIONS[tag]
        else:
            # Generate a generic description
            tag_def["description"] = f"Endpoints related to {tag}."
        tag_definitions.append(tag_def)

    # Only update if we have new tags
    existing_tags = {t.get("name") for t in spec.get("tags", [])}
    new_tags = [t for t in tag_definitions if t["name"] not in existing_tags]

    if new_tags or not spec.get("tags"):
        spec["tags"] = tag_definitions
        return len(tag_definitions)

    return 0


def make_summaries_unique(spec: dict) -> int:
    """Make duplicate summaries unique by adding context from the path."""
    summary_info: dict[str, list[tuple[str, str]]] = {}
    fixed_count = 0

    # First pass: collect all summaries and their paths (regardless of method)
    for path, methods in spec.get("paths", {}).items():
        for method, details in methods.items():
            if method not in ["get", "post", "put", "delete", "patch"]:
                continue
            if not isinstance(details, dict):
                continue
            summary = details.get("summary")
            if summary:
                if summary not in summary_info:
                    summary_info[summary] = []
                summary_info[summary].append((path, method))

    # Second pass: make duplicate summaries unique
    for path, methods in spec.get("paths", {}).items():
        for method, details in methods.items():
            if method not in ["get", "post", "put", "delete", "patch"]:
                continue
            if not isinstance(details, dict):
                continue
            summary = details.get("summary")
            if summary and len(summary_info.get(summary, [])) > 1:
                # Create a unique suffix from the full path
                # e.g., /api/v1/chart/{pk}/cache_screenshot/ -> "chart-cache-screenshot"
                clean_path = path.replace("/api/v1/", "").strip("/")
                # Remove parameter placeholders and convert to slug
                clean_path = clean_path.replace("{", "").replace("}", "")
                path_slug = clean_path.replace("/", "-").replace("_", "-")

                # Check if this suffix is already in the summary
                if path_slug not in summary.lower():
                    new_summary = f"{summary} ({path_slug})"
                    details["summary"] = new_summary
                    fixed_count += 1

    return fixed_count


def main() -> None:
    """Main function to fix the OpenAPI spec."""
    script_dir = Path(__file__).parent
    spec_path = script_dir.parent / "static" / "resources" / "openapi.json"

    if not spec_path.exists():
        print(f"Error: OpenAPI spec not found at {spec_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Reading OpenAPI spec from {spec_path}")

    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)

    spec, fixed_schemas = add_missing_schemas(spec)
    fixed_ops = add_missing_operation_ids(spec)
    fixed_tags = add_tag_definitions(spec)
    fixed_servers = configure_servers(spec)
    fixed_samples = add_code_samples(spec)

    changes_made = False

    if fixed_servers:
        print("Configured server URLs with variables for flexible API testing")
        changes_made = True

    if fixed_samples:
        print(f"Added code samples (cURL, Python, JavaScript) to {fixed_samples} endpoints")
        changes_made = True

    if fixed_schemas:
        print(f"Added missing schemas: {', '.join(fixed_schemas)}")
        changes_made = True

    if fixed_ops:
        print(f"Added operationId/summary to {fixed_ops} operations")
        changes_made = True

    if fixed_tags:
        print(f"Added {fixed_tags} tag definitions with descriptions")
        changes_made = True

    if fixed_summaries := make_summaries_unique(spec):
        print(f"Made {fixed_summaries} duplicate summaries unique")
        changes_made = True

    if changes_made:
        with open(spec_path, "w", encoding="utf-8") as f:
            json.dump(spec, f, indent=2)

        print(f"Updated {spec_path}")
    else:
        print("No fixes needed")


if __name__ == "__main__":
    main()
