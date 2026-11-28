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

import re
from collections.abc import Collection
from datetime import datetime
from typing import Any, TYPE_CHECKING

from marshmallow import fields
from sqlalchemy import text
from sqlalchemy.types import Date, DateTime

from superset.db_engine_specs.base import BasicParametersType, DatabaseCategory
from superset.db_engine_specs.postgres import (
    _named_schemas,
    _table_spellings,
    PostgresEngineSpec,
    PostgresParametersSchema,
)
from superset.utils import core as utils

if TYPE_CHECKING:
    from sqlalchemy.engine import Inspector

    from superset.models.core import Database
    from superset.models.sql_lab import Query


def _split_cluster_option(options: str) -> tuple[str | None, str]:
    """Extract the last cluster setting, preserving other startup arguments."""
    # Cluster has its own form input, so separate it from the options kept in
    # the additional parameters field.
    # Startup arguments use backslash escapes for whitespace and backslashes.
    tokens = re.findall(r"(?:\\[\s\S]|[^\s\\]|\\$)+", options)
    remaining: list[str] = []
    cluster: str | None = None
    index = 0
    while index < len(tokens):
        argument = tokens[index]
        setting = argument
        count = 1
        if argument == "-c" and index + 1 < len(tokens):
            setting = tokens[index + 1]
            count = 2
        elif argument.startswith("--"):
            setting = argument[2:]
        elif argument.startswith("-c"):
            setting = argument[2:]
        else:
            remaining.append(argument)
            index += 1
            continue
        if setting.startswith("cluster="):
            cluster = re.sub(r"\\([\s\S])", r"\1", setting[len("cluster=") :])
        else:
            remaining.extend(tokens[index : index + count])
        index += count
    return cluster, " ".join(remaining)


class MaterializeParametersSchema(PostgresParametersSchema):
    """Postgres connection parameters plus the Materialize cluster."""

    materializedb_cluster = fields.String(
        required=False,
        allow_none=True,
        metadata={"description": "Materialize cluster to run queries on"},
    )


class MaterializeEngineSpec(PostgresEngineSpec):
    """Adapt PostgreSQL connections and catalog queries for Materialize."""

    engine = "materialize"
    engine_name = "Materialize"

    default_driver = "psycopg2"

    sqlalchemy_uri_placeholder = (
        "materialize+psycopg2://username:password@host:port/database"
        "?options=--cluster%3Dquickstart"
    )

    metadata = {
        "description": (
            "Materialize is a streaming SQL database that maintains "
            "up-to-date query results as underlying data changes."
        ),
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["sqlalchemy-materialize"],
        "connection_string": (
            "materialize+psycopg2://{username}:{password}@{host}:{port}/{database}"
            "?options=--cluster%3D{cluster}"
        ),
        "homepage_url": "https://materialize.com/",
        "default_port": 6875,
    }

    supports_file_upload = False
    supports_grouping_sets = False

    # Materialize has no ``percentile_cont ... WITHIN GROUP``; keep
    # STDDEV_SAMP/VAR_SAMP and drop MEDIAN.
    _extended_aggregations = {
        name: func
        for name, func in PostgresEngineSpec._extended_aggregations.items()
        if name != "MEDIAN"
    }

    parameters_schema = MaterializeParametersSchema()

    @classmethod
    def get_allow_cost_estimate(cls, extra: dict[str, Any]) -> bool:
        # Materialize's EXPLAIN output has no ``cost=`` estimate to parse.
        return False

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: BasicParametersType,
        encrypted_extra: dict[str, str] | None = None,
    ) -> str:
        """Merge startup options, giving the form's nonempty cluster precedence."""
        if cluster := parameters.get("materializedb_cluster"):
            query = dict(parameters.get("query", {}))
            _, options = _split_cluster_option(query.get("options", ""))
            escaped_cluster = re.sub(r"([\s\\])", r"\\\1", cluster)
            query["options"] = " ".join(
                value for value in (options, f"--cluster={escaped_cluster}") if value
            )
            parameters = {**parameters, "query": query}
        return super().build_sqlalchemy_uri(parameters, encrypted_extra)

    @classmethod
    def get_parameters_from_uri(
        cls, uri: str, encrypted_extra: dict[str, Any] | None = None
    ) -> BasicParametersType:
        """Move the cluster to its form field and retain other startup options."""
        parameters = super().get_parameters_from_uri(uri, encrypted_extra)
        query = dict(parameters.get("query", {}))
        cluster, options = _split_cluster_option(query.get("options", ""))
        if cluster is not None:
            if options:
                query["options"] = options
            else:
                query.pop("options", None)
            parameters = {
                **parameters,
                "query": query,
                "materializedb_cluster": cluster,
            }
        return parameters

    @classmethod
    def prepare_connection(cls, connection: Any) -> None:
        """Run statements independently unless an explicit transaction is opened."""
        if not connection.autocommit:
            connection.autocommit = True

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        """Convert a datetime to a Materialize date or timestamp CAST expression."""
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, Date):
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if isinstance(sqla_type, DateTime):
            dttm_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            timestamp_type = (
                "TIMESTAMPTZ" if dttm.utcoffset() is not None else "TIMESTAMP"
            )
            return f"CAST('{dttm_formatted}' AS {timestamp_type})"
        return None

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> str | None:
        """Get the connection ID used to cancel a Materialize query."""
        # Materialize pins a transaction to the cluster of its first statement;
        # end it so the user's query isn't stuck on mz_catalog_server.
        cursor.execute("SELECT pg_backend_pid()")
        row = cursor.fetchone()
        cursor.connection.commit()  # pylint: disable=consider-using-transaction
        return row[0]

    @classmethod
    def get_schema_names(cls, inspector: Inspector) -> set[str]:
        """List user schemas, excluding PostgreSQL and Materialize system schemas."""
        with inspector.engine.connect() as conn:
            return {
                name
                for (name,) in conn.execute(
                    text("SELECT nspname FROM pg_namespace ORDER BY nspname")
                )
                if not name.startswith("pg_")
                and not name.startswith("mz_")
                and name != "information_schema"
            }

    @classmethod
    def get_search_path(
        cls,
        database: Database,
        catalog: str | None,
        tables: Collection[str] = (),
    ) -> tuple[list[str], dict[str, list[str]]]:
        """
        Resolve unqualified relation names using Materialize's system catalog.

        Return the search path and the first matching schemas for each table's
        quoted and unquoted spellings. Relations come from the current database
        or shared schemas. Include configured but nonexistent schemas in the
        returned path, but use only the effective path for relation lookup.
        """

        names = {table: _table_spellings(table) for table in tables}

        with database.get_raw_connection(catalog=catalog) as connection:
            cursor = connection.cursor()
            cursor.execute(
                "SELECT pg_catalog.current_schemas(true)::text[], "
                "pg_catalog.current_setting('search_path'), current_user::text"
            )
            row = cursor.fetchone()
            if not row or not isinstance(row[0], list):
                # An invalid result must not be treated as an empty search path.
                raise ValueError(f"Unexpected search path: {row!r}")
            schemas: list[str] = utils.remove_duplicates(
                row[0] + _named_schemas(row[1], row[2])
            )
            holders: set[tuple[str, str]] = set()
            if names:
                # A quoted spelling names the relation as written (quotes
                # stripped, doubled quotes undone); an unquoted one is folded.
                # Unlike PostgreSQL, Materialize folds unquoted identifiers with same
                # Unicode lowercasing as lower(), so both agree on non-ASCII names.
                cursor.execute(
                    "SELECT s.name, sp.spelling "
                    "FROM unnest(%s::text[]) AS sp(spelling) "
                    "JOIN mz_catalog.mz_relations AS r ON r.name = CASE "
                    "WHEN left(sp.spelling, 1) = '\"' THEN replace("
                    "substr(sp.spelling, 2, length(sp.spelling) - 2), '\"\"', '\"') "
                    "ELSE lower(sp.spelling) END "
                    "JOIN mz_catalog.mz_schemas AS s ON s.id = r.schema_id "
                    "LEFT JOIN mz_catalog.mz_databases AS d ON d.id = s.database_id "
                    "WHERE (d.name = current_database() OR s.database_id IS NULL) "
                    "AND s.name = ANY(%s::text[])",
                    ([n for ns in names.values() for n in ns], row[0]),
                )

                holders = set(cursor.fetchall())  # {(schema, spelling), ...}

            resolved: dict[str, list[str]] = {}

            for table, spellings in names.items():
                for name in spellings:
                    schema = next((s for s in schemas if (s, name) in holders), None)
                    if schema and schema not in resolved.get(table, []):
                        resolved.setdefault(table, []).append(schema)

            return schemas, resolved

    @classmethod
    def cancel_query(
        cls,
        cursor: Any,
        query: Query,
        cancel_query_id: str,
    ) -> bool:
        """
        Cancel the running query on the given Materialize connection.

        Materialize does not expose ``pg_stat_activity``; it accepts the
        connection ID from ``pg_backend_pid()`` directly in
        ``pg_cancel_backend``, which returns whether that connection exists.
        """
        if not cls.validate_cancel_query_id(cancel_query_id, r"^\d+$"):
            return False

        try:
            cursor.execute("SELECT pg_cancel_backend(%s)", (int(cancel_query_id),))
            row = cursor.fetchone()
        except Exception:
            return False

        return bool(row and row[0])
