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

from sqlalchemy import and_, or_

from superset import db
from superset.sql.parse import Table

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.sql.parse import BaseSQLStatement


def apply_rls(
    database: Database,
    catalog: str | None,
    schema: str,
    parsed_statement: BaseSQLStatement[Any],
) -> None:
    """
    Modify statement inplace to ensure RLS rules are applied.
    """
    # There are two ways to insert RLS: either replacing the table with a subquery
    # that has the RLS, or appending the RLS to the ``WHERE`` clause. The former is
    # safer, but not supported in all databases.
    method = database.db_engine_spec.get_rls_method()

    # collect all RLS predicates for all tables in the query
    predicates: dict[Table, list[Any]] = {}
    for table in parsed_statement.tables:
        # fully qualify table
        table = Table(
            table.table,
            table.schema or schema,
            table.catalog or catalog,
        )

        predicates[table] = [
            parsed_statement.parse_predicate(predicate)
            for predicate in get_predicates_for_table(
                table,
                database,
                database.get_default_catalog(),
            )
            if predicate
        ]

    parsed_statement.apply_rls(catalog, schema, predicates, method)


def get_predicates_for_table(
    table: Table,
    database: Database,
    default_catalog: str | None,
) -> list[str]:
    """
    Get the RLS predicates for a table.

    This is used to inject RLS rules into SQL statements run in SQL Lab. Note that the
    table must be fully qualified, with catalog (null if the DB doesn't support) and
    schema.
    """
    from superset.connectors.sqla.models import SqlaTable

    # if the dataset in the RLS has null catalog, match it when using the default
    # catalog
    catalog_predicate = SqlaTable.catalog == table.catalog
    if table.catalog and table.catalog == default_catalog:
        catalog_predicate = or_(
            catalog_predicate,
            SqlaTable.catalog.is_(None),
        )

    dataset = (
        db.session.query(SqlaTable)
        .filter(
            and_(
                SqlaTable.database_id == database.id,
                catalog_predicate,
                SqlaTable.schema == table.schema,
                SqlaTable.table_name == table.table,
            )
        )
        .one_or_none()
    )
    if not dataset:
        return []

    return [
        str(
            predicate.compile(
                dialect=database.get_dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        for predicate in dataset.get_sqla_row_level_filters()
    ]
