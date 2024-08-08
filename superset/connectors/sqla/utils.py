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
from collections.abc import Iterable, Iterator
from functools import lru_cache
from typing import Callable, TYPE_CHECKING, TypeVar
from uuid import UUID

from flask_babel import lazy_gettext as _
from sqlalchemy.engine.url import URL as SqlaURL
from sqlalchemy.exc import NoSuchTableError
from sqlalchemy.ext.declarative import DeclarativeMeta
from sqlalchemy.orm.exc import ObjectDeletedError
from sqlalchemy.sql.type_api import TypeEngine

from superset import db
from superset.constants import LRU_CACHE_MAX_SIZE
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetGenericDBErrorException,
    SupersetSecurityException,
)
from superset.models.core import Database
from superset.result_set import SupersetResultSet
from superset.sql_parse import ParsedQuery, Table
from superset.superset_typing import ResultSetColumnType

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


def get_physical_table_metadata(
    database: Database,
    table: Table,
    normalize_columns: bool,
) -> list[ResultSetColumnType]:
    """Use SQLAlchemy inspector to get table metadata"""
    db_engine_spec = database.db_engine_spec
    db_dialect = database.get_dialect()

    # Table does not exist or is not visible to a connection.
    if not (database.has_table(table) or database.has_view(table)):
        raise NoSuchTableError(table)

    cols = database.get_columns(table)
    for col in cols:
        try:
            if isinstance(col["type"], TypeEngine):
                name = col["column_name"]
                if not normalize_columns:
                    name = db_engine_spec.denormalize_name(db_dialect, name)

                db_type = db_engine_spec.column_datatype_to_string(
                    col["type"], db_dialect
                )
                type_spec = db_engine_spec.get_column_spec(
                    db_type, db_extra=database.get_extra()
                )
                col.update(
                    {
                        "name": name,
                        "column_name": name,
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


def get_virtual_table_metadata(dataset: SqlaTable) -> list[ResultSetColumnType]:
    """Use SQLparser to get virtual dataset metadata"""
    if not dataset.sql:
        raise SupersetGenericDBErrorException(
            message=_("Virtual dataset query cannot be empty"),
        )

    db_engine_spec = dataset.database.db_engine_spec
    sql = dataset.get_template_processor().process_template(
        dataset.sql, **dataset.template_params_dict
    )
    parsed_query = ParsedQuery(sql, engine=db_engine_spec.engine)
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
    return get_columns_description(
        dataset.database,
        dataset.catalog,
        dataset.schema,
        statements[0],
    )


def get_columns_description(
    database: Database,
    catalog: str | None,
    schema: str | None,
    query: str,
) -> list[ResultSetColumnType]:
    # TODO(villebro): refactor to use same code that's used by
    #  sql_lab.py:execute_sql_statements
    db_engine_spec = database.db_engine_spec
    try:
        with database.get_raw_connection(catalog=catalog, schema=schema) as conn:
            cursor = conn.cursor()
            query = database.apply_limit_to_sql(query, limit=1)
            mutated_query = database.mutate_sql_based_on_config(query)
            cursor.execute(mutated_query)
            db_engine_spec.execute(cursor, mutated_query, database)
            result = db_engine_spec.fetch_data(cursor, limit=1)
            result_set = SupersetResultSet(result, cursor.description, db_engine_spec)
            return result_set.columns
    except Exception as ex:
        raise SupersetGenericDBErrorException(message=str(ex)) from ex


@lru_cache(maxsize=LRU_CACHE_MAX_SIZE)
def get_dialect_name(drivername: str) -> str:
    return SqlaURL.create(drivername).get_dialect().name


@lru_cache(maxsize=LRU_CACHE_MAX_SIZE)
def get_identifier_quoter(drivername: str) -> dict[str, Callable[[str], str]]:
    return SqlaURL.create(drivername).get_dialect()().identifier_preparer.quote


DeclarativeModel = TypeVar("DeclarativeModel", bound=DeclarativeMeta)
logger = logging.getLogger(__name__)


def find_cached_objects_in_session(
    cls: type[DeclarativeModel],
    ids: Iterable[int] | None = None,
    uuids: Iterable[UUID] | None = None,
) -> Iterator[DeclarativeModel]:
    """Find known ORM instances in cached SQLA session states.

    :param cls: a SQLA DeclarativeModel
    :param ids: ids of the desired model instances (optional)
    :param uuids: uuids of the desired instances, will be ignored if `ids` are provides
    """
    if not ids and not uuids:
        return iter([])
    uuids = uuids or []
    try:
        items = list(db.session)
    except ObjectDeletedError:
        logger.warning("ObjectDeletedError", exc_info=True)
        return iter(())

    return (
        item
        # `session` is an iterator of all known items
        for item in items
        if isinstance(item, cls) and (item.id in ids if ids else item.uuid in uuids)
    )
