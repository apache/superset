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
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable

import click
import yaml
from rich.console import Console
from sqlalchemy import (
    Column,
    create_engine,
    DateTime,
    ForeignKey,
    insert,
    Integer,
    MetaData,
    select,
    String,
    Table,
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import NoSuchModuleError

from superset.databases.utils import make_url_safe
from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.lib import (
    ADVANCED_FEATURES,
    BASIC_FEATURES,
    DATABASE_DETAILS,
    diagnose,
    LIMIT_METHODS,
    NICE_TO_HAVE_FEATURES,
)

metadata_obj = MetaData()

user = Table(
    "tmp_superset_test_table_user",
    metadata_obj,
    Column("user_id", Integer, primary_key=True),
    Column("user_name", String(16), nullable=False),
    Column("email_address", String(60), key="email"),
    Column("nickname", String(50), nullable=False),
)

user_prefs = Table(
    "tmp_superset_test_table_user_prefs",
    metadata_obj,
    Column("pref_id", Integer, primary_key=True),
    Column(
        "user_id",
        Integer,
        ForeignKey("tmp_superset_test_table_user.user_id"),
        nullable=False,
    ),
    Column("pref_name", String(40), nullable=False),
    Column("pref_value", String(100)),
)


TestType = Callable[[Console, Engine], None]


class TestRegistry:
    def __init__(self) -> None:
        self.tests: dict[str, Any] = defaultdict(list)

    def add(self, *dialects: str) -> Callable[[TestType], TestType]:
        def decorator(func: TestType) -> TestType:
            for dialect in dialects:
                self.tests[dialect].append(func)

            return func

        return decorator

    def get_tests(self, dialect: str) -> list[TestType]:
        return self.tests[dialect]


registry = TestRegistry()


@registry.add("sqlite", "postgresql")
def test_datetime(console: Console, engine: Engine) -> None:
    """
    Create a table with a timestamp column and read value back.
    """
    md = MetaData()
    table = Table(
        "test",
        md,
        Column("ts", DateTime),
    )

    console.print("Creating a table with a timestamp column...")
    md.create_all(engine)
    console.print("[green]Table created!")

    now = datetime.now()

    console.print("Inserting timestamp value...")
    insert_stmt = insert(table).values(ts=now)
    engine.execute(insert_stmt)

    console.print("Reading timestamp value...")
    select_stmt = select(table)
    row = engine.execute(select_stmt).fetchone()
    assert row[0] == now
    console.print(":thumbs_up: [green]Success!")


@click.command()
@click.argument("sqlalchemy_uri")
@click.option(
    "--connect-args",
    "-c",
    "raw_engine_kwargs",
    help="Connect args as JSON or YAML",
)
def test_db(sqlalchemy_uri: str, raw_engine_kwargs: str | None = None) -> None:
    """
    Run a series of tests against an analytical database.

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
    engine_kwargs = collect_connection_info(console, sqlalchemy_uri, raw_engine_kwargs)

    console.print("[bold]\nChecking for a DB engine spec...")
    test_db_engine_spec(console, sqlalchemy_uri)

    console.print("[bold]\nTesting the SQLAlchemy dialect...")
    engine = test_sqlalchemy_dialect(console, sqlalchemy_uri, engine_kwargs)

    console.print("[bold]\nTesting the database connectivity...")
    test_database_connectivity(console, engine)


def collect_connection_info(
    console: Console,
    sqlalchemy_uri: str,
    raw_engine_kwargs: str | None = None,
) -> dict[str, Any]:
    """
    Collect ``engine_kwargs`` if needed.
    """
    console.print(f"[green]SQLAlchemy URI: [bold]{sqlalchemy_uri}")
    if raw_engine_kwargs is None:
        configure_engine_kwargs = input(
            "> Do you want to configure connection arguments? [y/N] "
        )
        if configure_engine_kwargs.strip().lower() == "y":
            console.print(
                "Please paste the engine_kwargs as JSON or YAML and press CTRL-D when "
                "finished"
            )
            raw_engine_kwargs = sys.stdin.read()
        else:
            raw_engine_kwargs = "{}"

    return yaml.safe_load(raw_engine_kwargs)


def test_db_engine_spec(  # noqa: C901
    console: Console,
    sqlalchemy_uri: str,
) -> type[BaseEngineSpec] | None:
    """
    Test the DB engine spec, if available.
    """
    spec: type[BaseEngineSpec] | None = None
    for spec in load_engine_specs():
        try:
            supported = spec.supports_url(make_url_safe(sqlalchemy_uri))
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
    for key, feature in DATABASE_DETAILS.items():
        console.print(f"  - {feature}:", info[key])

    console.print("[bold]Checking for basic features...")
    console.print("Supported time grains:")
    for k, v in info["time_grains"].items():
        score = " (+1)" if v else ""
        console.print(f"  - {k}: {v}{score}")
    for k, v in BASIC_FEATURES.items():
        score = " (+10)" if info[k] else ""
        console.print(f"{v}: {info[k]}{score}")

    console.print("[bold]Checking for nice-to-have features...")
    for k, v in NICE_TO_HAVE_FEATURES.items():
        score = " (+10)" if info[k] else ""
        console.print(f"{v}: {info[k]}{score}")

    console.print("[bold]Checking for advanced features...")
    for k, v in ADVANCED_FEATURES.items():
        score = " (+10)" if info[k] else ""
        console.print(f"{v}: {info[k]}{score}")

    # pylint: disable=consider-using-f-string
    console.print("[bold]Overall score: {score}/{max_score}".format(**info))

    return spec


def test_sqlalchemy_dialect(
    console: Console,
    sqlalchemy_uri: str,
    engine_kwargs: dict[str, Any],
) -> Engine:
    """
    Test the SQLAlchemy dialect, making sure it supports everything Superset needs.
    """
    engine = create_engine(sqlalchemy_uri, **engine_kwargs)
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
    """
    Tests the DB API 2.0 driver.
    """
    with console.status("[bold green]Connecting to database..."):
        try:
            conn = engine.raw_connection()
            engine.dialect.do_ping(conn)
            console.print(":thumbs_up: [green]Connected successfully!")
        except Exception as ex:  # pylint: disable=broad-except
            console.print(f":thumbs_down: [red]Failed to connect: {ex}")
            console.print("[bold]Exiting...")
            sys.exit(1)

    cursor = conn.cursor()

    console.print("[bold]Checking that we can run queries...")
    console.print("sql> SELECT 1;")
    cursor.execute("SELECT 1")
    result = cursor.fetchone()[0]
    color = "green" if result == 1 else "red"
    console.print(f"[{color}]> {result}")

    # run engine-specific tests
    if tests := registry.get_tests(engine.dialect.name):
        console.print("[bold]Running engine-specific tests...")
        for test in tests:
            docstring = (test.__doc__ or test.__name__).strip().splitlines()[0]
            try:
                console.print(f"[bold]{docstring}...")
                test(console, engine)
            except Exception as ex:  # pylint: disable=broad-except
                console.print(f"[red]Test failed: {ex}")
                console.print("[bold]Exiting...")
                sys.exit(1)
