from __future__ import annotations

from collections.abc import Collection
from datetime import datetime
from typing import Any, TYPE_CHECKING

from sqlalchemy import text
from sqlalchemy.types import Date, DateTime

from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.postgres import (
    _named_schemas,
    _table_spellings,
    PostgresEngineSpec,
)
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.models.core import Database
from marshmallow import fields

from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersType,
    DatabaseCategory,
)
from superset.db_engine_specs.postgres import (
    PostgresEngineSpec,
    PostgresParametersSchema,
)


class MaterializeParametersSchema(PostgresParametersSchema):
    """Postgres connection parameters plus the Materialize cluster."""

    materializedb_cluster = fields.String(
        required=False,
        allow_none=True,
        metadata={"description": "Materialize cluster to run queries on"},
    )


class MaterializeEngineSpec(PostgresEngineSpec):
    engine = "materialize"
    engine_name = "Materialize"
    
    default_driver = "psycopg2"
    
    parameters_schema = MaterializeParametersSchema()
    
    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: BasicParametersType,
        encrypted_extra: dict[str, str] | None = None,
    ) -> str:
        """Pass the form's cluster to Materialize as ``options=--cluster=<name>``."""
        if cluster := parameters.get("materializedb_cluster"):
            query = {**parameters.get("query", {}), "options": f"--cluster={cluster}"}
            parameters = {**parameters, "query": query}
        return super().build_sqlalchemy_uri(parameters, encrypted_extra)
    
    # TODO: Fix the URI after making the dialect, also for connection_string
    sqlalchemy_uri_placeholder = (
        "materialize+psycopg2://username:password@host:port/database"
        "?options=--cluster%3Dquickstart"
    )
    
    metadata = {
        # Required fields
        "description": "A brief description of the database.",
        "categories": [
            DatabaseCategory.CLOUD_AWS,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        # TODO: Add connecting string builder after integrated 'cluster' in input form
        "pypi_packages": ["psycopg2", "sqlalchemy-materialize"],
        "connection_string": (
            "materialize+psycopg2://{username}:{password}@{host}:{port}/{database}"
            "?options=--cluster%3Dquickstart"
        ),

        # Recommended fields
        "homepage_url": "https://materialize.com/",
        "default_port": 6875,
    }
    
    supports_file_upload = False
    
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
            return f"CAST('{dttm_formatted}' AS TIMESTAMP)"
        return None


    @classmethod
    def get_cancel_query_id(cls, cursor, query) -> str | None:
        # Materialize pins a transaction to the cluster of its first statement;
        # end it so the user's query isn't stuck on mz_catalog_server.
        cursor.execute("SELECT pg_backend_pid()")
        row = cursor.fetchone()
        cursor.connection.commit()
        return row[0]
    
    @classmethod
    def get_schema_names(cls, inspector) -> set[str]:
        with inspector.engine.connect() as conn:
            return {
                name
                for (name,) in conn.execute(
                    text("SELECT nspname FROM pg_namespace ORDER BY nspname")
                )
                if not name.startswith("pg_") and not name.startswith("mz_") and name != "information_schema"
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

        Read the effective schema search order from ``current_schemas(true)``
        and find matching relations in ``mz_catalog.mz_relations`` within the
        current database or shared schemas. For each spelling produced by
        ``_table_spellings``, select the first matching schema on the path.
        Multiple spellings account for parsed names whose original quoting is
        unknown; each table maps to the distinct schemas resolving its spellings.

        Append configured schema names from ``_named_schemas`` to the returned
        path, including schemas that do not exist yet. Relation lookup uses only
        the effective path; a later statement may create a configured schema.

        :param database: The Superset database configuration
        :param catalog: The database to connect to
        :param tables: Relation names referenced without a schema
        :return: The schema search path and schemas resolving each found name
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
                # reported as an empty path, it would match no table's rules
                raise ValueError(f"Unexpected search path: {row!r}")
            schemas: list[str] = utils.remove_duplicates(
                row[0] + _named_schemas(row[1], row[2])
            )
            holders: set[tuple[str, str]] = set()
            if names:
                # A quoted spelling names the relation as written (quotes
                # stripped, doubled quotes undone); an unquoted one is folded.
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
            
            # Find the first schema appeared in 'schemas' that also appear in 'holders'
            for table, spellings in names.items():
                for name in spellings:
                    # first schema on the search path holding this name
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
        if not cls.validate_cancel_query_id(cancel_query_id, r"^\d+$"):
            return False

        try:
            cursor.execute(
                "SELECT pg_terminate_backend(pid) "
                "FROM pg_stat_activity "
                f"WHERE pid='{cancel_query_id}'"
            )
        except Exception:
            return False

        return True
