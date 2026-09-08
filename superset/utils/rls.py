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

import hashlib
from functools import partial
from typing import Any, TYPE_CHECKING

from sqlalchemy import and_, func, or_

from superset import db, security_manager
from superset.sql.parse import folds_unquoted_object_names, Table
from superset.utils import json
from superset.utils.core import get_user_id

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.sql.parse import BaseSQLStatement


def _get_cache_identity() -> str:
    """
    Build a stable per-session identity to key the parse-failure sentinel on.

    Logged-in users have a stable numeric id from ``get_user_id()``. Guest
    users (embedded) don't -- ``get_user_id()`` always returns ``None`` for
    them -- so different guest tokens with different RLS scopes would
    otherwise all collapse onto the same "user-None" sentinel and share cache
    entries. Key those on a hash of the guest token's own RLS rules instead,
    so distinct guest scopes stay isolated from one another.
    """
    if guest_user := security_manager.get_current_guest_user_if_guest():
        rls_rules = guest_user.guest_token.get("rls_rules", [])
        digest = hashlib.sha256(
            json.dumps(rls_rules, sort_keys=True).encode("utf-8")
        ).hexdigest()
        return f"guest-{digest}"
    return str(get_user_id())


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
    default_catalog = database.get_default_catalog()
    predicates: dict[Table, list[Any]] = {}
    for table in parsed_statement.tables:
        table = table.qualify(catalog=catalog, schema=schema)
        predicates[table] = [
            parsed_statement.parse_predicate(predicate)
            for predicate in get_predicates_for_table(
                table,
                database,
                default_catalog,
                exclude_dataset_id=exclude_dataset_id,
            )
            if predicate
        ]

    has_predicates = any(predicates.values())
    parsed_statement.apply_rls(catalog, schema, predicates, method)
    return has_predicates


def _identifier_predicate(column: Any, value: str | None, fold: bool) -> Any:
    """
    Build the SQL comparison matching a stored identifier against a referenced one.
    """
    if value is None:
        return column.is_(None)
    return func.lower(column) == value.lower() if fold else column == value


def _identifiers_match(left: str | None, right: str | None, fold: bool) -> bool:
    """
    Compare two identifiers in Python, the counterpart to _identifier_predicate.
    """
    if fold:
        return bool(left and right and left.lower() == right.lower())
    return left == right


def _find_dataset(
    table: Table,
    database: Database,
    default_catalog: str | None,
    exclude_dataset_id: int | None,
    fold: bool,
) -> SqlaTable | None:
    """
    Find the dataset a table reference resolves to.

    Matches an exact schema first, then a dataset stored without a schema, which
    is scoped to the database's default schema. These are separate queries rather
    than one ``OR`` so that a schema match always wins; resolving the default
    schema probes the analytic database, so it is deferred until a null-schema
    dataset is known to exist. A dataset stored with a null catalog is likewise
    scoped to the default catalog.

    :param fold: Compare identifiers case-insensitively, for an engine that
        doesn't treat unquoted identifiers as case-sensitive. An ambiguous folded
        match is ignored rather than guessed at, whereas an ambiguous exact match
        raises, as it always has.
    """
    from superset.connectors.sqla.models import SqlaTable

    eq = partial(_identifier_predicate, fold=fold)
    same = partial(_identifiers_match, fold=fold)

    catalog_predicate = eq(SqlaTable.catalog, table.catalog)
    if table.catalog and same(table.catalog, default_catalog):
        catalog_predicate = or_(catalog_predicate, SqlaTable.catalog.is_(None))

    filters = [
        SqlaTable.database_id == database.id,
        catalog_predicate,
        eq(SqlaTable.table_name, table.table),
    ]
    # When applying RLS to a virtual dataset's inner SQL, skip a match against
    # the dataset itself — its RLS is already applied on the outer WHERE via
    # get_sqla_row_level_filters(). Without this, a virtual dataset whose
    # table_name happens to equal a table in its own SQL (e.g. after a
    # physical→virtual conversion) double-applies its own predicates.
    if exclude_dataset_id is not None:
        filters.append(SqlaTable.id != exclude_dataset_id)

    def match(schema_predicate: Any) -> SqlaTable | None:
        query = db.session.query(SqlaTable).filter(and_(*filters, schema_predicate))
        if not fold:
            return query.one_or_none()
        # 0, 1 or "ambiguous" is all the folded lookup needs to tell apart
        matches = query.limit(2).all()
        return matches[0] if len(matches) == 1 else None

    if dataset := match(eq(SqlaTable.schema, table.schema)):
        return dataset

    if (
        table.schema
        and (null_schema_dataset := match(SqlaTable.schema.is_(None)))
        and same(table.schema, database.get_default_schema(table.catalog))
    ):
        return null_schema_dataset

    return None


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
    dataset = _find_dataset(
        table,
        database,
        default_catalog,
        exclude_dataset_id,
        fold=False,
    )

    if not dataset and folds_unquoted_object_names(database.db_engine_spec.engine):
        # The match above is case-sensitive, but an engine that doesn't treat
        # unquoted identifiers as case-sensitive resolves a case-mismatched
        # reference (e.g. ``BIRTH_NAMES``) to the same physical table as the
        # registered dataset (``birth_names``), so retry it folding every
        # identifier. A parsed reference carries no quoting information, so this
        # also matches a quoted reference, which is a distinct table on those
        # engines: that direction applies extra predicates rather than dropping
        # one that should have applied.
        dataset = _find_dataset(
            table,
            database,
            default_catalog,
            exclude_dataset_id,
            fold=True,
        )

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
        # If we can't parse the SQL, we can't tell which (if any) RLS
        # predicates would apply, so we can't contribute a meaningful cache
        # key component. Returning an empty list here would make every
        # user's failure collapse onto the same (missing) contribution,
        # which is unsafe when different users have different RLS scopes on
        # the underlying tables. Fall back to a per-user marker instead, so
        # the cache key still varies by user even though we don't know the
        # actual predicates.
        return [f"rls-predicate-parse-failed-for-user-{_get_cache_identity()}"]
