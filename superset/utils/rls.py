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

from typing import Any, Optional, TYPE_CHECKING

from flask import g, has_app_context
from sqlalchemy import and_, or_

from superset import db
from superset.sql.parse import SQLStatement, Table

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.security.guest_token import GuestUser
    from superset.sql.parse import BaseSQLStatement

# Attribute on ``flask.g`` holding the per-request RLS predicate-resolution
# cache. A dashboard rendering many tiles over the same governed table resolves
# predicates once per identity instead of once per tile (NFR-5).
_RLS_REQUEST_CACHE_ATTR = "_rls_query_predicate_cache"


class RLSUnresolvableError(Exception):
    """Predicate injection cannot be done safely and deterministically.

    Raised by the rewrite path when a governed query's RLS predicates cannot be
    resolved to an unambiguous injection target. Carries the fail-closed
    ``denial_class`` so the enforcement gate can convert it into an explicit
    DENIED decision rather than letting a raw exception bubble out or, worse,
    emitting an unfiltered render (FR-3).
    """

    def __init__(self, denial_class: str, message: str | None = None):
        self.denial_class = denial_class
        super().__init__(message or denial_class)


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


def get_global_guest_rls_predicates(identity: Optional[GuestUser]) -> list[str]:
    """Global (unscoped) guest RLS clauses that apply to every referenced table.

    ``get_predicates_for_table`` deliberately excludes global guest RLS (via
    ``get_sqla_row_level_filters(include_global_guest_rls=False)``) so a virtual
    dataset does not double-apply it: the virtual dataset re-applies it on its
    outer WHERE. The ad-hoc chart path has no such outer WHERE, so the global
    rule would be dropped entirely and the guest render would leak. This returns
    those clauses so the rewriter can inject them exactly once.

    Only rules carrying no ``dataset`` are global; dataset-scoped rules stay with
    the per-table resolver. Returns ``[]`` for a non-guest identity.
    """
    if identity is None:
        return []
    from superset import security_manager

    return security_manager.get_global_guest_rls_filters_str(identity)


def _identity_handle(identity: Optional[GuestUser]) -> Any:
    """Opaque, hashable handle that partitions the request cache per identity.

    Predicate resolution depends on the acting identity (a guest's own RLS
    rules, or a regular user's roles). The handle folds in whatever drives that
    resolution so cached predicates are never shared across identities (NFR-4).
    """
    if identity is not None:
        # A guest carries its RLS rules on the token; different rule sets must
        # key differently even for the same username.
        return ("guest", getattr(identity, "username", None), repr(identity.rls))

    # Regular/anonymous users: resolution follows the current user's roles, so
    # key on the current user id (None for anonymous).
    from superset.utils.core import get_user_id

    user_id = get_user_id() if has_app_context() else None
    return ("user", user_id)


def _request_cache() -> Optional[dict[Any, list[str]]]:
    """Return the request-scoped predicate cache, or ``None`` outside a request."""
    if not has_app_context():
        return None
    cache = getattr(g, _RLS_REQUEST_CACHE_ATTR, None)
    if cache is None:
        cache = {}
        setattr(g, _RLS_REQUEST_CACHE_ATTR, cache)
    return cache


def clear_rls_request_cache() -> None:
    """Drop the request-scoped predicate cache (used by tests and teardown)."""
    if has_app_context() and hasattr(g, _RLS_REQUEST_CACHE_ATTR):
        delattr(g, _RLS_REQUEST_CACHE_ATTR)


def rewrite_sql_for_query(
    database: Database,
    catalog: str | None,
    schema: str,
    sql: str,
    identity: Optional[GuestUser],
) -> tuple[str, int]:
    """Inject RLS predicates into an ad-hoc ``Query`` SQL string.

    Mirrors the SQL-Lab mechanism exactly: parse once, resolve predicates per
    referenced table via :func:`get_predicates_for_table`, and rewrite in place
    with :meth:`BaseSQLStatement.apply_rls`. The statement is only re-emitted
    when a predicate was actually applied, so a query with no applicable rule is
    returned byte-identical (FR-4) and never round-tripped through the parser.

    Predicate resolution is memoized per request keyed on
    ``(identity_handle, database_id, catalog, schema, frozenset(tables))`` so a
    dashboard's repeated renders over the same governed table resolve once. The
    cache is identity-partitioned and never bleeds predicates across identities.

    :returns: ``(sql, applied_filter_count)`` — the (possibly rewritten) SQL and
        the number of predicate strings injected.
    """
    # Single parser pass: the statement is constructed exactly once and reused
    # for both table enumeration (cache key) and the in-place rewrite.
    statement = SQLStatement(sql, engine=database.db_engine_spec.engine)
    tables = {
        table.qualify(catalog=catalog, schema=schema)
        for table in statement.tables
    }

    cache_key = (
        _identity_handle(identity),
        database.id,
        catalog,
        schema,
        frozenset(tables),
    )
    cache = _request_cache()
    predicates_by_table: Optional[dict[Table, list[str]]] = None
    if cache is not None and cache_key in cache:
        predicates_by_table = cache[cache_key]

    if predicates_by_table is None:
        default_catalog = database.get_default_catalog()
        # Per-table resolution, preserving the table→predicate association so a
        # multi-table query applies each table's own rules (no cross-apply).
        predicates_by_table = {
            table: get_predicates_for_table(table, database, default_catalog)
            for table in tables
        }
        # Global (unscoped) guest RLS is excluded by get_predicates_for_table
        # (it is re-applied on a virtual dataset's outer WHERE). This path has no
        # such outer WHERE, so inject the guest's global rules here — on every
        # referenced table, exactly once. Skip any clause a table already
        # resolved to avoid double-application.
        global_guest_predicates = get_global_guest_rls_predicates(identity)
        if global_guest_predicates:
            for preds in predicates_by_table.values():
                preds.extend(p for p in global_guest_predicates if p not in preds)
        if cache is not None:
            cache[cache_key] = predicates_by_table

    applied_count = sum(len(preds) for preds in predicates_by_table.values())
    if not applied_count:
        # No applicable rule: SQL returned byte-identical, no re-parse round-trip.
        return sql, 0

    parsed_predicates = {
        table: [statement.parse_predicate(p) for p in preds if p]
        for table, preds in predicates_by_table.items()
    }
    method = database.db_engine_spec.get_rls_method()
    statement.apply_rls(catalog, schema, parsed_predicates, method)
    return statement.format(), applied_count
