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
from typing import Any, Optional, TYPE_CHECKING

from sqlalchemy import select, text
from sqlalchemy.engine.base import Engine

from superset.databases.schemas import (
    TableMetadataColumnsResponse,
    TableMetadataResponse,
)
from superset.databases.utils import (
    get_col_type,
    get_foreign_keys_metadata,
    get_indexes_metadata,
)
from superset.db_engine_specs.base import BaseEngineSpec, BasicParametersMixin
from superset.sql.parse import Partition, SQLScript
from superset.sql_parse import Table
from superset.superset_typing import ResultSetColumnType

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)


class OdpsBaseEngineSpec(BaseEngineSpec):
    @classmethod
    def get_table_metadata(
        cls,
        database: Database,
        table: Table,
        partition: Optional[Partition] = None,
    ) -> TableMetadataResponse:
        """
        Returns basic table metadata
        :param database: Database instance
        :param table: A Table instance
        :param partition: A Table partition info
        :return: Basic table metadata
        """
        return cls.get_table_metadata(database, table, partition)


class OdpsEngineSpec(BasicParametersMixin, OdpsBaseEngineSpec):
    default_driver = "odps"

    @classmethod
    def get_table_metadata(
        cls, database: Any, table: Table, partition: Optional[Partition] = None
    ) -> TableMetadataResponse:
        """
        Get table metadata information, including type, pk, fks.
        This function raises SQLAlchemyError when a schema is not found.

        :param partition: The table's partition info
        :param database: The database model
        :param table: Table instance
        :return: Dict table metadata ready for API response
        """
        keys = []
        columns = database.get_columns(table)
        primary_key = database.get_pk_constraint(table)
        if primary_key and primary_key.get("constrained_columns"):
            primary_key["column_names"] = primary_key.pop("constrained_columns")
            primary_key["type"] = "pk"
            keys += [primary_key]
        foreign_keys = get_foreign_keys_metadata(database, table)
        indexes = get_indexes_metadata(database, table)
        keys += foreign_keys + indexes
        payload_columns: list[TableMetadataColumnsResponse] = []
        table_comment = database.get_table_comment(table)
        for col in columns:
            dtype = get_col_type(col)
            payload_columns.append(
                {
                    "name": col["column_name"],
                    "type": dtype.split("(")[0] if "(" in dtype else dtype,
                    "longType": dtype,
                    "keys": [
                        k for k in keys if col["column_name"] in k["column_names"]
                    ],
                    "comment": col.get("comment"),
                }
            )

        with database.get_sqla_engine(
            catalog=table.catalog, schema=table.schema
        ) as engine:
            return {
                "name": table.table,
                "columns": payload_columns,
                "selectStar": cls.select_star(
                    database=database,
                    table=table,
                    engine=engine,
                    limit=100,
                    show_cols=False,
                    indent=True,
                    latest_partition=True,
                    cols=columns,
                    partition=partition,
                ),
                "primaryKey": primary_key,
                "foreignKeys": foreign_keys,
                "indexes": keys,
                "comment": table_comment,
            }

    @classmethod
    def select_star(  # pylint: disable=too-many-arguments
        cls,
        database: Database,
        table: Table,
        engine: Engine,
        limit: int = 100,
        show_cols: bool = False,
        indent: bool = True,
        latest_partition: bool = True,
        cols: list[ResultSetColumnType] | None = None,
        partition: Optional[Partition] = None,
    ) -> str:
        """
        Generate a "SELECT * from [schema.]table_name" query with appropriate limit.

        WARNING: expects only unquoted table and schema names.

        :param partition: The table's partition info
        :param database: Database instance
        :param table: Table instance
        :param engine: SqlAlchemy Engine instance
        :param limit: limit to impose on query
        :param show_cols: Show columns in query; otherwise use "*"
        :param indent: Add indentation to query
        :param latest_partition: Only query the latest partition
        :param cols: Columns to include in query
        :return: SQL query
        """
        # pylint: disable=redefined-outer-name
        fields: str | list[Any] = "*"
        cols = cols or []
        if (show_cols or latest_partition) and not cols:
            cols = database.get_columns(table)

        if show_cols:
            fields = cls._get_fields(cols)
        full_table_name = cls.quote_table(table, engine.dialect)
        qry = select(fields).select_from(text(full_table_name))
        if database.backend == "odps":
            if (
                partition is not None
                and partition.is_partitioned_table
                and partition.partition_column is not None
                and len(partition.partition_column) > 0
            ):
                partition_str = partition.partition_column[0]
                partition_str_where = f"CAST({partition_str} AS STRING) LIKE '%'"
                qry = qry.where(text(partition_str_where))
        if limit:
            qry = qry.limit(limit)
        if latest_partition:
            partition_query = cls.where_latest_partition(
                database,
                table,
                qry,
                columns=cols,
            )
            if partition_query is not None:
                qry = partition_query
        sql = database.compile_sqla_query(qry, table.catalog, table.schema)
        if indent:
            sql = SQLScript(sql, engine=cls.engine).format()
        return sql
