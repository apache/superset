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

from typing import Any, TYPE_CHECKING

from sqlalchemy.engine.url import make_url, URL
from sqlalchemy.exc import NoSuchTableError

from superset.commands.database.exceptions import DatabaseInvalidError
from superset.sql.parse import Table

if TYPE_CHECKING:
    from superset.databases.schemas import (
        TableMetadataColumnsResponse,
        TableMetadataForeignKeysIndexesResponse,
        TableMetadataResponse,
    )


def get_foreign_keys_metadata(
    database: Any,
    table: Table,
) -> list[TableMetadataForeignKeysIndexesResponse]:
    foreign_keys = database.get_foreign_keys(table)
    for fk in foreign_keys:
        fk["column_names"] = fk.pop("constrained_columns")
        fk["type"] = "fk"
    return foreign_keys


def get_indexes_metadata(
    database: Any,
    table: Table,
) -> list[TableMetadataForeignKeysIndexesResponse]:
    indexes = database.get_indexes(table)
    for idx in indexes:
        idx["type"] = "index"
    return indexes


def get_col_type(col: dict[Any, Any]) -> str:
    try:
        dtype = f"{col['type']}"
    except Exception:  # pylint: disable=broad-except
        # sqla.types.JSON __str__ has a bug, so using __class__.
        dtype = col["type"].__class__.__name__
    return dtype


def get_table_metadata(database: Any, table: Table) -> TableMetadataResponse:
    """
    Get table metadata information, including type, pk, fks.
    This function raises SQLAlchemyError when a schema is not found.

    :param database: The database model
    :param table: Table instance
    :return: Dict table metadata ready for API response
    """
    keys = []
    table_missing = False
    try:
        # get_columns is the table-existence check: SQLAlchemy 2.0's sqlite
        # dialect raises NoSuchTableError from reflection for a table that
        # doesn't exist - 1.4's sqlite dialect silently returned empty
        # results instead, which this API has always relied on to answer
        # with an empty-but-200 payload for sqlite specifically (other
        # backends' dialects already raised on missing tables pre-2.0, so
        # they're unaffected and still surface as the 422 below). Only
        # sqlite gets the graceful fallback, matching that pre-existing,
        # dialect-driven difference in behavior between backends. Only this
        # first call is guarded, so a NoSuchTableError raised later while
        # reflecting fks/indexes/comments for a table confirmed to exist
        # still propagates instead of being mistaken for a missing table.
        columns = database.get_columns(table)
    except NoSuchTableError:
        if database.backend != "sqlite":
            raise
        table_missing = True
        columns = []
    if not table_missing:
        primary_key = database.get_pk_constraint(table)
        foreign_keys = get_foreign_keys_metadata(database, table)
        indexes = get_indexes_metadata(database, table)
        table_comment = database.get_table_comment(table)
    else:
        primary_key = {"constrained_columns": None, "name": None}
        foreign_keys = []
        indexes = []
        table_comment = None
    if primary_key and primary_key.get("constrained_columns"):
        primary_key["column_names"] = primary_key.pop("constrained_columns")
        primary_key["type"] = "pk"
        keys += [primary_key]
    keys += foreign_keys + indexes
    payload_columns: list[TableMetadataColumnsResponse] = []
    for col in columns:
        dtype = get_col_type(col)
        payload_columns.append(
            {
                "name": col["column_name"],
                "type": dtype.split("(")[0] if "(" in dtype else dtype,
                "longType": dtype,
                "keys": [k for k in keys if col["column_name"] in k["column_names"]],
                "comment": col.get("comment"),
            }
        )
    return {
        "name": table.table,
        "columns": payload_columns,
        "selectStar": database.select_star(
            table,
            show_cols=True if columns else False,
            indent=True,
            cols=columns,
            # A missing table has no partitions to look up, and asking
            # anyway would just re-trigger the same NoSuchTableError via
            # select_star()'s own internal database.get_columns() fallback
            # (it re-fetches columns itself whenever `cols` is empty and
            # either show_cols or latest_partition is set).
            latest_partition=not table_missing,
        ),
        "primaryKey": primary_key,
        "foreignKeys": foreign_keys,
        "indexes": keys,
        "comment": table_comment,
    }


def make_url_safe(raw_url: str | URL) -> URL:
    """
    Wrapper for SQLAlchemy's make_url(), which tends to raise too detailed of
    errors, which inevitably find their way into server logs. ArgumentErrors
    tend to contain usernames and passwords, which makes them non-log-friendly
    :param raw_url:
    :return:
    """

    if isinstance(raw_url, str):
        url = raw_url.strip()
        try:
            return make_url(url)  # noqa
        except Exception as ex:
            raise DatabaseInvalidError() from ex

    else:
        return raw_url
