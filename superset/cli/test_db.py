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

from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.lib import diagnose

LIMIT_METHODS = {
    "FORCE_LIMIT": "modifies the query, replacing an existing LIMIT or adding a new one",
    "WRAP_SQL": "wraps the original query in a SELECT * with a LIMIT",
    "FETCH_MANY": "runs the query unmodified but fetchs only LIMIT rows from the cursor",
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
    also to test new DB API 2.0 drivers.

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
        if spec.supports_url(make_url(sqlalchemy_uri)):
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
    console.print("  - Supports JOINs: ", info["joins"])

    console.print("Supported time grains:")
    for k, v in info["time_grains"].items():
        console.print(f"  - {k}: {v}")


def test_sqlalchemy_dialect(
    console: Console,
    sqlalchemy_uri: str,
    connect_args: Dict[str, Any],
) -> Engine:
    """
    Test the SQLAlchemy dialect, making sure it supports everything Superset needs.
    """
    engine = create_engine(sqlalchemy_uri, connect_args=connect_args)
    return engine


def test_database_connectivity(console: Console, engine: Engine) -> None:
    with console.status("[bold green]Connecting to database..."):
        try:
            conn = engine.raw_connection()
            engine.dialect.do_ping(conn)  # pylint: disable=attr-defined
            console.print(":thumbs_up: [green]Connected successfully!")
        except Exception as ex:  # pylint: disable=broad-except
            console.print(f":thumbs_down: [red]Failed to connect: {ex}")
            sys.exit(1)
