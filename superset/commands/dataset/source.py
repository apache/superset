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
"""Shared handling of the source a dataset reads from."""

from __future__ import annotations

from typing import NamedTuple

from superset import security_manager
from superset.models.core import Database
from superset.sql.parse import Table


class DatasetSource(NamedTuple):
    """
    Where a dataset reads its rows from.

    A dataset is either virtual, reading through ``sql``, or physical, reading
    through ``table_name``. Either way the read is qualified by a connection,
    a catalog and a schema.
    """

    database_id: int | None
    catalog: str | None
    schema: str | None
    table_name: str
    sql: str | None

    @classmethod
    def build(
        cls,
        database_id: int | None,
        catalog: str | None,
        schema: str | None,
        table_name: str,
        sql: str | None,
    ) -> DatasetSource:
        """Build a source, treating blank catalog, schema and SQL as null."""
        return cls(
            database_id,
            catalog or None,
            schema or None,
            table_name,
            sql or None,
        )

    @property
    def table(self) -> Table:
        return Table(self.table_name, self.schema, self.catalog)

    def resolve_catalog(self, default_catalog: str | None) -> DatasetSource:
        """Return this source with a null catalog resolved to ``default_catalog``."""
        return self._replace(catalog=self.catalog or default_catalog)

    def moved_from(self, other: DatasetSource) -> bool:
        """
        Whether this source reads from somewhere other than ``other``.

        The name only counts for physical datasets: renaming a virtual dataset
        relabels it without changing what it reads. Turning a virtual dataset
        physical, or the reverse, always counts as a move.
        """
        if (self.database_id, self.catalog, self.schema) != (
            other.database_id,
            other.catalog,
            other.schema,
        ) or bool(self.sql) != bool(other.sql):
            return True
        if self.sql:
            return self.sql != other.sql
        return self.table_name != other.table_name


def raise_for_source_access(database: Database, source: DatasetSource) -> None:
    """
    Authorise the source a dataset reads from.

    The two branches mirror ``CreateDatasetCommand``: SQL for virtual datasets,
    ``database`` plus ``table`` for physical ones. Every path that points a
    dataset at a source runs this, so that a dataset cannot be used to reach a
    connection, table or query the caller lacks access to.

    :param database: the connection the dataset will read through
    :param source: the source the dataset will read from
    :raises SupersetSecurityException: if the user cannot access the source
    :raises SupersetParseError: if the SQL cannot be parsed
    """
    if source.sql:
        security_manager.raise_for_access(
            database=database,
            sql=source.sql,
            catalog=source.catalog,
            schema=source.schema,
        )
    else:
        security_manager.raise_for_access(database=database, table=source.table)
