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
from contextlib import closing
from datetime import date, datetime, time, timedelta
from typing import Callable, Dict, List, Optional, Set, TYPE_CHECKING

import sqlparse
from flask_babel import lazy_gettext as _
from sqlalchemy import and_, inspect, or_
from sqlalchemy.engine import Engine
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy.orm import Session
from sqlalchemy.sql.type_api import TypeEngine

from superset.columns.models import Column as NewColumn
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetGenericDBErrorException,
    SupersetSecurityException,
)
from superset.models.core import Database
from superset.result_set import SupersetResultSet
from superset.sql_parse import has_table_query, insert_rls, ParsedQuery, Table
from superset.superset_typing import ResultSetColumnType
from superset.tables.models import Table as NewTable

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


TEMPORAL_TYPES = {date, datetime, time, timedelta}


def get_physical_table_metadata(
    database: Database,
    table_name: str,
    schema_name: Optional[str] = None,
) -> List[Dict[str, str]]:
    """Use SQLAlchemy inspector to get table metadata"""
    db_engine_spec = database.db_engine_spec
    db_dialect = database.get_dialect()
    # ensure empty schema
    _schema_name = schema_name if schema_name else None
    # Table does not exist or is not visible to a connection.

    if not (
        database.has_table_by_name(table_name=table_name, schema=_schema_name)
        or database.has_view_by_name(view_name=table_name, schema=_schema_name)
    ):
        raise NoSuchTableError

    cols = database.get_columns(table_name, schema=_schema_name)
    for col in cols:
        try:
            if isinstance(col["type"], TypeEngine):
                db_type = db_engine_spec.column_datatype_to_string(
                    col["type"], db_dialect
                )
                type_spec = db_engine_spec.get_column_spec(
                    db_type, db_extra=database.get_extra()
                )
                col.update(
                    {
                        "type": db_type,
                        "type_generic": type_spec.generic_type if type_spec else None,
                        "is_dttm": type_spec.is_dttm if type_spec else None,
                    }
                )
        # Broad exception catch, because there are multiple possible exceptions
        # from different drivers that fall outside CompileError
        except Exception:  # pylint: disable=broad-except
            col.update(
                {
                    "type": "UNKNOWN",
                    "generic_type": None,
                    "is_dttm": None,
                }
            )
    return cols


def get_virtual_table_metadata(dataset: "SqlaTable") -> List[ResultSetColumnType]:
    """Use SQLparser to get virtual dataset metadata"""
    if not dataset.sql:
        raise SupersetGenericDBErrorException(
            message=_("Virtual dataset query cannot be empty"),
        )

    db_engine_spec = dataset.database.db_engine_spec
    engine = dataset.database.get_sqla_engine(schema=dataset.schema)
    sql = dataset.get_template_processor().process_template(
        dataset.sql, **dataset.template_params_dict
    )
    parsed_query = ParsedQuery(sql)
    if not db_engine_spec.is_readonly_query(parsed_query):
        raise SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message=_("Only `SELECT` statements are allowed"),
                level=ErrorLevel.ERROR,
            )
        )
    statements = parsed_query.get_statements()
    if len(statements) > 1:
        raise SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message=_("Only single queries supported"),
                level=ErrorLevel.ERROR,
            )
        )
    # TODO(villebro): refactor to use same code that's used by
    #  sql_lab.py:execute_sql_statements
    try:
        with closing(engine.raw_connection()) as conn:
            cursor = conn.cursor()
            query = dataset.database.apply_limit_to_sql(statements[0])
            db_engine_spec.execute(cursor, query)
            result = db_engine_spec.fetch_data(cursor, limit=1)
            result_set = SupersetResultSet(result, cursor.description, db_engine_spec)
            cols = result_set.columns
    except Exception as ex:
        raise SupersetGenericDBErrorException(message=str(ex)) from ex
    return cols


def validate_adhoc_subquery(
    sql: str,
    database_id: int,
    default_schema: str,
) -> str:
    """
    Check if adhoc SQL contains sub-queries or nested sub-queries with table.

    If sub-queries are allowed, the adhoc SQL is modified to insert any applicable RLS
    predicates to it.

    :param sql: adhoc sql expression
    :raise SupersetSecurityException if sql contains sub-queries or
    nested sub-queries with table
    """
    # pylint: disable=import-outside-toplevel
    from superset import is_feature_enabled

    statements = []
    for statement in sqlparse.parse(sql):
        if has_table_query(statement):
            if not is_feature_enabled("ALLOW_ADHOC_SUBQUERY"):
                raise SupersetSecurityException(
                    SupersetError(
                        error_type=SupersetErrorType.ADHOC_SUBQUERY_NOT_ALLOWED_ERROR,
                        message=_("Custom SQL fields cannot contain sub-queries."),
                        level=ErrorLevel.ERROR,
                    )
                )
            statement = insert_rls(statement, database_id, default_schema)
        statements.append(statement)

    return ";\n".join(str(statement) for statement in statements)


def is_column_type_temporal(column_type: TypeEngine) -> bool:
    try:
        return column_type.python_type in TEMPORAL_TYPES
    except NotImplementedError:
        return False


def load_or_create_tables(  # pylint: disable=too-many-arguments
    session: Session,
    database_id: int,
    default_schema: Optional[str],
    tables: Set[Table],
    conditional_quote: Callable[[str], str],
    engine: Engine,
) -> List[NewTable]:
    """
    Load or create new table model instances.
    """
    if not tables:
        return []

    # set the default schema in tables that don't have it
    if default_schema:
        fixed_tables = list(tables)
        for i, table in enumerate(fixed_tables):
            if table.schema is None:
                fixed_tables[i] = Table(table.table, default_schema, table.catalog)
        tables = set(fixed_tables)

    # load existing tables
    predicate = or_(
        *[
            and_(
                NewTable.database_id == database_id,
                NewTable.schema == table.schema,
                NewTable.name == table.table,
            )
            for table in tables
        ]
    )
    new_tables = session.query(NewTable).filter(predicate).all()

    # add missing tables
    existing = {(table.schema, table.name) for table in new_tables}
    for table in tables:
        if (table.schema, table.table) not in existing:
            try:
                inspector = inspect(engine)
                column_metadata = inspector.get_columns(
                    table.table, schema=table.schema
                )
            except Exception:  # pylint: disable=broad-except
                continue
            columns = [
                NewColumn(
                    name=column["name"],
                    type=str(column["type"]),
                    expression=conditional_quote(column["name"]),
                    is_temporal=is_column_type_temporal(column["type"]),
                    is_aggregation=False,
                    is_physical=True,
                    is_spatial=False,
                    is_partition=False,
                    is_increase_desired=True,
                )
                for column in column_metadata
            ]
            new_tables.append(
                NewTable(
                    name=table.table,
                    schema=table.schema,
                    catalog=None,
                    database_id=database_id,
                    columns=columns,
                )
            )
            existing.add((table.schema, table.table))

    return new_tables
