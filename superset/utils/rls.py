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
    exclude_dataset_id: int | None = None,
) -> bool:
    """
    Modify statement inplace to ensure RLS rules are applied.

    :param exclude_dataset_id: When applying RLS to a virtual dataset's inner SQL,
        pass the virtual dataset's id here so its own RLS isn't injected again
        on top of the outer-WHERE application (avoids double-apply when the
        virtual dataset's table_name collides with a table in its own SQL — for
        example, after converting a physical dataset with RLS to virtual).
    :returns: True if any RLS predicates were actually applied, False otherwise.
    """
    # There are two ways to insert RLS: either replacing the table with a subquery
    # that has the RLS, or appending the RLS to the ``WHERE`` clause. The former is
    # safer, but not supported in all databases.
    method = database.db_engine_spec.get_rls_method()

    # collect all RLS predicates for all tables in the query
    predicates: dict[Table, list[Any]] = {}
    for table in parsed_statement.tables:
        table = table.qualify(catalog=catalog, schema=schema)
        predicates[table] = [
            parsed_statement.parse_predicate(predicate)
            for predicate in get_predicates_for_table(
                table,
                database,
                database.get_default_catalog(),
                exclude_dataset_id=exclude_dataset_id,
            )
            if predicate
        ]

    has_predicates = any(predicates.values())
    parsed_statement.apply_rls(catalog, schema, predicates, method)
    return has_predicates


def get_predicates_for_table(
    table: Table,
    database: Database,
    default_catalog: str | None,
    exclude_dataset_id: int | None = None,
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

    filters = [
        SqlaTable.database_id == database.id,
        catalog_predicate,
        SqlaTable.schema == table.schema,
        SqlaTable.table_name == table.table,
    ]
    # When applying RLS to a virtual dataset's inner SQL, skip a match against
    # the dataset itself — its RLS is already applied on the outer WHERE via
    # get_sqla_row_level_filters(). Without this, a virtual dataset whose
    # table_name happens to equal a table in its own SQL (e.g. after a
    # physical→virtual conversion) double-applies its own predicates.
    if exclude_dataset_id is not None:
        filters.append(SqlaTable.id != exclude_dataset_id)

    dataset = db.session.query(SqlaTable).filter(and_(*filters)).one_or_none()
    if not dataset:
        return []

    # Exclude global (unscoped) guest RLS to prevent double application in
    # virtual datasets. Global guest rules will be applied to the outer query
    # via get_sqla_row_level_filters() on the virtual dataset itself.
    # Dataset-scoped guest rules are still included here because they target
    # this specific physical dataset and won't match on the outer query.
    # Note: this path is also used by SQL Lab (sql_lab.py, executor.py) via
    # apply_rls(). Guest users with the default Public role cannot access SQL Lab
    # (PUBLIC_EXCLUDED_VIEW_MENUS in security/manager.py). If the guest role is
    # extended to include SQL Lab access, global guest RLS predicates for
    # underlying tables would be skipped here.
    return [
        str(
            predicate.compile(
                dialect=database.get_dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        for predicate in dataset.get_sqla_row_level_filters(
            include_global_guest_rls=False
        )
    ]


def collect_rls_predicates_for_sql(
    sql: str,
    database: Database,
    catalog: str | None,
    schema: str,
    exclude_dataset_id: int | None = None,
) -> list[str]:
    """
    Collect all RLS predicates that would be applied to tables in the given SQL.

    This is used for cache key generation for virtual datasets to ensure that
    different users with different RLS rules get different cache keys.

    :param sql: The SQL query to analyze
    :param database: The database the query runs against
    :param catalog: The default catalog for the query
    :param schema: The default schema for the query
    :param exclude_dataset_id: Mirror of the same parameter on apply_rls — pass
        the virtual dataset's id so its self-match is excluded from the cache key
        (kept consistent with what's actually applied at query time).
    :return: List of RLS predicate strings that would be applied
    """
    from superset.sql.parse import SQLScript

    try:
        parsed_script = SQLScript(sql, engine=database.db_engine_spec.engine)
        tables = {
            table.qualify(catalog=catalog, schema=schema)
            for statement in parsed_script.statements
            for table in statement.tables
        }
        default_catalog = database.get_default_catalog()
        return sorted(
            {
                predicate
                for table in tables
                for predicate in get_predicates_for_table(
                    table,
                    database,
                    default_catalog,
                    exclude_dataset_id=exclude_dataset_id,
                )
            }
        )
    except Exception:
        # If we can't parse the SQL, return empty list
        # This ensures RLS application failure doesn't break caching
        return []
