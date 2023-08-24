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
    Column("user_id", Integer, ForeignKey("user.user_id"), nullable=False),
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
    Create a table with a timestamp column.
    """
    console.print("[bold]Testing datetime support...")

    md = MetaData()
    table = Table(
        "test",
        md,
        Column("ts", DateTime),
    )

    try:
        console.print("Creating a table with a timestamp column...")
        md.create_all(engine)
        console.print("[green]Table created!")

        now = datetime.now()

        console.print("Inserting timestamp value...")
        stmt = insert(table).values(ts=now)
        engine.execute(stmt)

        console.print("Reading timestamp value...")
        stmt = select(table)
        row = engine.execute(stmt).fetchone()
        assert row[0] == now
        console.print(":thumbs_up: [green]Succcess!")
    except Exception as ex:  # pylint: disable=broad-except
        console.print(f"[red]Test failed: {ex}")
        console.print("[bold]Exiting...")
        sys.exit(1)


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
) -> dict[str, Any]:
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
    connect_args: dict[str, Any],
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


# pylint: disable=too-many-statements
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

    console.print("[bold]Checking that we can create tables...")
    try:
        metadata_obj.create_all(engine)
        console.print("[green]Tables created!")
    except Exception as ex:  # pylint: disable=broad-except
        console.print(f"[red]Unable to create tables: {ex}")
        console.print("[bold]Exiting...")
        sys.exit(1)

    console.print("[bold]Checking that we can insert data...")
    stmt = insert(user).values(
        user_name="beto",
        email="beto@example.org",
        nickname="Beto",
    )
    try:
        console.print(
            "sql>",
            stmt.compile(
                dialect=engine.dialect,
                compile_kwargs={"literal_binds": True},
            ),
        )
        engine.execute(stmt)
    except Exception as ex:  # pylint: disable=broad-except
        console.print(f"[red]Unable to insert data: {ex}")
        console.print("[bold]Exiting...")
        sys.exit(1)

    console.print("[bold]Checking that we can read data...")
    stmt = select(user).where(user.c.user_name == "beto")
    try:
        console.print(
            "sql>",
            stmt.compile(
                dialect=engine.dialect,
                compile_kwargs={"literal_binds": True},
            ),
        )
        result = engine.execute(stmt).fetchall()
        console.print(f"[green]> {result}")
    except Exception as ex:  # pylint: disable=broad-except
        console.print(f"[red]Unable to read data: {ex}")
        console.print("[bold]Exiting...")
        sys.exit(1)

    console.print("[bold]Checking that we can drop tables...")
    try:
        metadata_obj.drop_all(engine)
        console.print("[green]Done!")
    except Exception as ex:  # pylint: disable=broad-except
        console.print(f"[red]Unable to drop tables: {ex}")
        console.print("[bold]Exiting...")
        sys.exit(1)

    # run engine-specific tests
    if tests := registry.get_tests(engine.dialect.name):
        console.print("[bold]Running engine-specific tests...")
        for test in tests:
            test(console, engine)
