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

import logging
from contextlib import closing
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    Iterator,
    List,
    Optional,
    Type,
    TYPE_CHECKING,
    TypeVar,
)
from uuid import UUID

import sqlparse
from flask_babel import lazy_gettext as _
from sqlalchemy.engine.url import URL as SqlaURL
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy.ext.declarative import DeclarativeMeta
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import ObjectDeletedError
from sqlalchemy.sql.type_api import TypeEngine

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetGenericDBErrorException,
    SupersetSecurityException,
)
from superset.models.core import Database
from superset.result_set import SupersetResultSet
from superset.sql_parse import has_table_query, insert_rls, ParsedQuery
from superset.superset_typing import ResultSetColumnType
from superset.utils.memoized import memoized

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


def get_physical_table_metadata(
    database: Database,
    table_name: str,
    schema_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
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
                    "type_generic": None,
                    "is_dttm": None,
                }
            )
    return cols


def get_virtual_table_metadata(dataset: SqlaTable) -> List[ResultSetColumnType]:
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
            query = dataset.database.apply_limit_to_sql(statements[0], limit=1)
            db_engine_spec.execute(cursor, query)
            result = db_engine_spec.fetch_data(cursor, limit=1)
            result_set = SupersetResultSet(result, cursor.description, db_engine_spec)
            cols = result_set.columns
    except Exception as ex:
        raise SupersetGenericDBErrorException(message=str(ex)) from ex
    return cols


def get_columns_description(
    database: Database,
    query: str,
) -> List[ResultSetColumnType]:
    db_engine_spec = database.db_engine_spec
    try:
        with closing(database.get_sqla_engine().raw_connection()) as conn:
            cursor = conn.cursor()
            query = database.apply_limit_to_sql(query, limit=1)
            cursor.execute(query)
            db_engine_spec.execute(cursor, query)
            result = db_engine_spec.fetch_data(cursor, limit=1)
            result_set = SupersetResultSet(result, cursor.description, db_engine_spec)
            return result_set.columns
    except Exception as ex:
        raise SupersetGenericDBErrorException(message=str(ex)) from ex


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


@memoized
def get_dialect_name(drivername: str) -> str:
    return SqlaURL.create(drivername).get_dialect().name


@memoized
def get_identifier_quoter(drivername: str) -> Dict[str, Callable[[str], str]]:
    return SqlaURL.create(drivername).get_dialect()().identifier_preparer.quote


DeclarativeModel = TypeVar("DeclarativeModel", bound=DeclarativeMeta)
logger = logging.getLogger(__name__)


def find_cached_objects_in_session(
    session: Session,
    cls: Type[DeclarativeModel],
    ids: Optional[Iterable[int]] = None,
    uuids: Optional[Iterable[UUID]] = None,
) -> Iterator[DeclarativeModel]:
    """Find known ORM instances in cached SQLA session states.

    :param session: a SQLA session
    :param cls: a SQLA DeclarativeModel
    :param ids: ids of the desired model instances (optional)
    :param uuids: uuids of the desired instances, will be ignored if `ids` are provides
    """
    if not ids and not uuids:
        return iter([])
    uuids = uuids or []
    try:
        items = list(session)
    except ObjectDeletedError:
        logger.warning("ObjectDeletedError", exc_info=True)
        return iter(())

    return (
        item
        # `session` is an iterator of all known items
        for item in items
        if isinstance(item, cls) and (item.id in ids if ids else item.uuid in uuids)
    )
