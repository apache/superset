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

from typing import TYPE_CHECKING

from sqlalchemy import and_

from superset import db

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.sql.parse import Table


def get_predicates_for_table(
    table: Table,
    database: Database,
    catalog: str | None,
    schema: str,
) -> list[str]:
    """
    Get the RLS predicates for a table.

    This is used to inject RLS rules into SQL statements run in SQL Lab.
    """
    from superset.connectors.sqla.models import SqlaTable

    dataset = (
        db.session.query(SqlaTable)
        .filter(
            and_(
                SqlaTable.database_id == database.id,
                SqlaTable.catalog == table.catalog or catalog,
                SqlaTable.schema == table.schema or schema,
                SqlaTable.table_name == table.table,
            )
        )
        .one_or_none()
    )
    if not dataset:
        return []

    return [
        str(
            and_(*filters).compile(
                dialect=database.get_dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        for filters in dataset.get_sqla_row_level_filters()
    ]
