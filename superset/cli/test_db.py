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

from __future__ import annotations

import sys
from typing import Any, Dict, Type

import click
import yaml
from rich.console import Console
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import NoSuchModuleError

from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.lib import diagnose

LIMIT_METHODS = {
    "FORCE_LIMIT": "modifies the query, replacing an existing LIMIT or adding a new one",
    "WRAP_SQL": "wraps the original query in a SELECT * with a LIMIT",
    "FETCH_MANY": "runs the query unmodified but fetchs only LIMIT rows from the cursor",
}

DATABASE_DETAILS = {
    "Supports JOINs": "joins",
    "Supports subqueries": "subqueries",
    "Allows aliases in the SELECT statement": "alias_in_select",
    "Allows referencing aliases in the ORDER BY statement": "alias_in_orderby",
    "Supports secondary time columns": "secondary_time_columns",
    "Allows ommiting time filters from inline GROUP BYs": "time_groupby_inline",
    "Able to use source column when an alias overshadows it": "alias_to_source_column",
    "Allows aggregations in ORDER BY not present in the SELECT": "order_by_not_in_select",
    "Allows expressions in ORDER BY": "expressions_in_orderby",
    "Allows CTE as a subquery": "cte_in_subquery",
    "Allows LIMIT clause (instead of TOP)": "limit_clause",
    "Maximum column name": "max_column_name",
    "Allows comments": "sql_comments",
    "Colons must be escaped": "escaped_colons",
}

BASIC_FEATURES = {
    "Masks/unmasks encrypted_extra": "masked_encrypted_extra",
    "Has column type mappings": "column_type_mapping",
    "Returns a list of function names": "function_names",
}
NICE_TO_HAVE_FEATURES = {
    "Supports user impersonation": "user_impersonation",
    "Support file upload": "file_upload",
    "Returns extra table metadata": "extra_table_metadata",
    "Maps driver exceptions to Superset exceptions": "dbapi_exception_mapping",
    "Parses error messages and returns Superset errors": "custom_errors",
    "Supports changing the schema per-query": "dynamic_schema",
    "Supports catalogs": "catalog",
    "Supports changing the catalog per-query": "dynamic_catalog",
    "Can be connected thru an SSH tunnel": "ssh_tunneling",
    "Allows query to be canceled": "query_cancelation",
    "Returns additional metrics on dataset creation": "get_metrics",
    "Supports querying the latest partition only": "where_latest_partition",
}
ADVANCED_FEATURES = {
    "Expands complex types (arrays, structs) into rows/columns": "expand_data",
    "Supports query cost estimation": "query_cost_estimation",
    "Supports validating SQL before running query": "sql_validation",
}


@click.command()
@click.argument("sqlalchemy_uri")
@click.option(
    "--connect-args",
    "-c",
    "raw_connect_args",
    help="Connect args as JSON or YAML",
)
def test_db(sqlalchemy_uri: str, raw_connect_args: str | None = None) -> None:
    """
    Run a series of tests against an analytics database.

    This command tests:

      1. The Superset DB engine spec.
      2. The SQLAlchemy dialect.
      3. The database connectivity and performance.

    It's useful for people developing DB engine specs and/or SQLAlchemy dialects, and
    also to test new versions of DB API 2.0 drivers.

    TODO:

      - implement SSH tunneling
      - implement server certificates

    """
    console = Console()
    console.clear()

    console.print("[bold]Collecting additional connection information...")
    connect_args = collect_connection_info(console, sqlalchemy_uri, raw_connect_args)

    console.print("[bold]\nChecking for a DB engine spec...")
    test_db_engine_spec(console, sqlalchemy_uri)

    console.print("[bold]\nTesting the SQLAlchemy dialect...")
    engine = test_sqlalchemy_dialect(console, sqlalchemy_uri, connect_args)

    console.print("[bold]\nTesting the database connectivity...")
    test_database_connectivity(console, engine)


def collect_connection_info(
    console: Console,
    sqlalchemy_uri: str,
    raw_connect_args: str | None = None,
) -> Dict[str, Any]:
    """
    Collect ``connect_args`` if needed.
    """
    console.print(f"[green]SQLAlchemy URI: [bold]{sqlalchemy_uri}")
    if raw_connect_args is None:
        configure_connect_args = input(
            "> Do you want to configure connection arguments? [y/N] "
        )
        if configure_connect_args.strip().lower() == "y":
            console.print(
                "Please paste the connect_args as JSON or YAML and press CTRL-D when "
                "finished"
            )
            raw_connect_args = sys.stdin.read()
        else:
            raw_connect_args = "{}"

    return yaml.safe_load(raw_connect_args)


def test_db_engine_spec(
    console: Console,
    sqlalchemy_uri: str,
) -> Type[BaseEngineSpec] | None:
    """
    Test the DB engine spec, if available.
    """
    spec: Type[BaseEngineSpec] | None = None
    for spec in load_engine_specs():
        try:
            supported = spec.supports_url(make_url(sqlalchemy_uri))
        except NoSuchModuleError:
            console.print("[red]No SQLAlchemy dialect found for the URI!")
            console.print("[bold]Exiting...")
            sys.exit(1)

        if supported:
            if spec.__module__.startswith("superset.db_engine_specs"):
                console.print(
                    f":thumbs_up: [green]Found DB engine spec: [bold]{spec.engine_name}"
                )
            else:
                console.print(
                    ":warning: [yellow]Found 3rd party DB engine spec: "
                    f"[bold]{spec.engine_name} ({spec.__module__})"
                )
            break
    else:
        console.print(
            ":thumbs_down: [red]No DB engine spec found for the SQLAlchemy URI. The "
            "database can still be used with Superset, but some functionality may be "
            "limited."
        )

    if spec is None:
        return None

    info = diagnose(spec)

    console.print("About the database:")
    console.print("  - Method used to apply LIMIT to queries:", info["limit_method"])
    for k, v in LIMIT_METHODS.items():
        console.print(f"    - {k}: {v}")
    for feature, key in DATABASE_DETAILS.items():
        console.print(f"  - {feature}:", info[key])

    console.print("[bold]Checking for basic features...")
    console.print("Supported time grains:")
    for k, v in info["time_grains"].items():
        score = " (+1)" if v else ""
        console.print(f"  - {k}: {v}{score}")
    for k, v in BASIC_FEATURES.items():
        score = " (+10)" if info[v] else ""
        console.print(f"{k}: {info[v]}{score}")

    console.print("[bold]Checking for nice-to-have features...")
    for k, v in NICE_TO_HAVE_FEATURES.items():
        score = " (+10)" if info[v] else ""
        console.print(f"{k}: {info[v]}{score}")

    console.print("[bold]Checking for advanced features...")
    for k, v in ADVANCED_FEATURES.items():
        score = " (+10)" if info[v] else ""
        console.print(f"{k}: {info[v]}{score}")

    console.print("[bold]Overall score: {score}/{max_score}".format(**info))


def test_sqlalchemy_dialect(
    console: Console,
    sqlalchemy_uri: str,
    connect_args: Dict[str, Any],
) -> Engine:
    """
    Test the SQLAlchemy dialect, making sure it supports everything Superset needs.
    """
    engine = create_engine(sqlalchemy_uri, connect_args=connect_args)
    dialect = engine.dialect

    console.print("[bold]Checking functions used by the inspector...")
    keys = [
        "get_schema_names",
        "get_table_names",
        "get_view_names",
        "get_indexes",
        "get_table_comment",
        "get_columns",
        "get_unique_constraints",
        "get_check_constraints",
        "get_pk_constraint",
        "get_foreign_keys",
    ]
    for key in keys:
        console.print(f"  - {key}:", hasattr(dialect, key))

    console.print("[bold]Checking dialect attributes...")
    if hasattr(dialect, "dbapi"):
        console.print(f"  - dbapi: [bold]{dialect.dbapi.__name__}")
    else:
        console.print("  - dbapi:", None)

    attrs = [
        "name",
        "driver",
        "supports_multivalues_insert",
    ]
    for attr in attrs:
        console.print(f"  - {attr}:", getattr(dialect, attr, None))

    console.print("Supports do_ping:", hasattr(dialect, "do_ping"))
    console.print(
        "Can quote identifiers:",
        hasattr(dialect, "identifier_preparer")
        and hasattr(dialect.identifier_preparer, "quote"),
    )

    console.print(
        "Doesn't require name normalization:",
        not dialect.requires_name_normalize,
    )
    if dialect.requires_name_normalize:
        console.print(
            "  - Implements denormalize_name:", hasattr(dialect, "denormalize_name")
        )

    return engine


def test_database_connectivity(console: Console, engine: Engine) -> None:
    with console.status("[bold green]Connecting to database..."):
        try:
            conn = engine.raw_connection()
            engine.dialect.do_ping(conn)  # pylint: disable=attr-defined
            console.print(":thumbs_up: [green]Connected successfully!")
        except Exception as ex:  # pylint: disable=broad-except
            console.print(f":thumbs_down: [red]Failed to connect: {ex}")
            console.print("[bold]Exiting...")
            sys.exit(1)
