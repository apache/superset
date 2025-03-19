#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
"""
This module contains utilities to auto-generate an
Entity-Relationship Diagram (ERD) from SQLAlchemy
and onto a plantuml file.
"""

import json
import os
from collections import defaultdict
from collections.abc import Iterable
from typing import Any, Optional

import click
import jinja2

from superset import db

GROUPINGS: dict[str, Iterable[str]] = {
    "Core": [
        "css_templates",
        "dynamic_plugin",
        "favstar",
        "dashboards",
        "slices",
        "user_attribute",
        "embedded_dashboards",
        "annotation",
        "annotation_layer",
        "tag",
        "tagged_object",
    ],
    "System": ["ssh_tunnels", "keyvalue", "cache_keys", "key_value", "logs"],
    "Alerts & Reports": ["report_recipient", "report_execution_log", "report_schedule"],
    "Inherited from Flask App Builder (FAB)": [
        "ab_user",
        "ab_permission",
        "ab_permission_view",
        "ab_view_menu",
        "ab_role",
        "ab_register_user",
    ],
    "SQL Lab": ["query", "saved_query", "tab_state", "table_schema"],
    "Data Assets": [
        "dbs",
        "table_columns",
        "sql_metrics",
        "tables",
        "row_level_security_filters",
        "sl_tables",
        "sl_datasets",
        "sl_columns",
        "database_user_oauth2_tokens",
    ],
}
# Table name to group name mapping (reversing the above one for easy lookup)
TABLE_TO_GROUP_MAP: dict[str, str] = {}
for group, tables in GROUPINGS.items():
    for table in tables:
        TABLE_TO_GROUP_MAP[table] = group


def sort_data_structure(data):  # type: ignore
    sorted_json = json.dumps(data, sort_keys=True)
    sorted_data = json.loads(sorted_json)
    return sorted_data


def introspect_sqla_model(mapper: Any, seen: set[str]) -> dict[str, Any]:
    """
    Introspects a SQLAlchemy model and returns a data structure that
    can be pass to a jinja2 template for instance

    Parameters:
    -----------
    mapper: SQLAlchemy model mapper
    seen: set of model identifiers to avoid duplicates

    Returns:
    --------
    Dict[str, Any]: data structure for jinja2 template
    """
    table_name = mapper.persist_selectable.name
    model_info: dict[str, Any] = {
        "class_name": mapper.class_.__name__,
        "table_name": table_name,
        "fields": [],
        "relationships": [],
    }
    # Collect fields (columns) and their types
    for column in mapper.columns:
        field_info: dict[str, str] = {
            "field_name": column.key,
            "type": str(column.type),
        }
        model_info["fields"].append(field_info)

    # Collect relationships and identify types
    for attr, relationship in mapper.relationships.items():
        related_table = relationship.mapper.persist_selectable.name
        # Create a unique identifier for the relationship to avoid duplicates
        relationship_id = "-".join(sorted([table_name, related_table]))

        if relationship_id not in seen:
            seen.add(relationship_id)
            squiggle = "||--|{"
            if relationship.direction.name == "MANYTOONE":
                squiggle = "}|--||"

            relationship_info: dict[str, str] = {
                "relationship_name": attr,
                "related_model": relationship.mapper.class_.__name__,
                "type": relationship.direction.name,
                "related_table": related_table,
            }
            # Identify many-to-many by checking for secondary table
            if relationship.secondary is not None:
                squiggle = "}|--|{"
                relationship_info["type"] = "many-to-many"
                relationship_info["secondary_table"] = relationship.secondary.name

            relationship_info["squiggle"] = squiggle
            model_info["relationships"].append(relationship_info)
    return sort_data_structure(model_info)  # type: ignore


def introspect_models() -> dict[str, list[dict[str, Any]]]:
    """
    Introspects SQLAlchemy models and returns a data structure that
    can be pass to a jinja2 template for rendering an ERD.

    Returns:
    --------
    Dict[str, List[Dict[str, Any]]]: data structure for jinja2 template
    """
    data: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen_models: set[str] = set()
    for model in db.Model.registry.mappers:
        group_name = (
            TABLE_TO_GROUP_MAP.get(model.mapper.persist_selectable.name)
            or "Uncategorized Models"
        )
        model_data = introspect_sqla_model(model, seen_models)
        data[group_name].append(model_data)
    return data


def generate_erd(file_path: str) -> None:
    """
    Generates a PlantUML ERD of the models/database

    Parameters:
    -----------
    file_path: str
        File path to write the ERD to
    """
    data = introspect_models()
    templates_path = os.path.dirname(__file__)
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(templates_path))

    # Load the template
    template = env.get_template("erd.template.puml")
    rendered = template.render(data=data)
    with open(file_path, "w") as f:
        click.secho(f"Writing to {file_path}...", fg="green")
        f.write(rendered)


@click.command()
@click.option(
    "--output",
    "-o",
    type=click.Path(dir_okay=False, writable=True),
    help="File to write the ERD to",
)
def erd(output: Optional[str] = None) -> None:
    """
    Generates a PlantUML ERD of the models/database

    Parameters:
    -----------
    output: str, optional
        File to write the ERD to, defaults to erd.plantuml if not provided
    """
    path = os.path.dirname(__file__)
    output = output or os.path.join(path, "erd.puml")

    from superset.app import create_app

    app = create_app()
    with app.app_context():
        generate_erd(output)


if __name__ == "__main__":
    erd()
