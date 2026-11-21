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
from collections.abc import Callable, Iterable, Mapping
from functools import partial
from typing import Any, TYPE_CHECKING

from flask import current_app
from sqlalchemy import and_, func, or_, true

from superset import db, security_manager
from superset.exceptions import OAuth2Error, OAuth2RedirectError
from superset.sql.parse import folds_unquoted_object_names, Table
from superset.utils import json
from superset.utils.core import get_user_id, remove_duplicates
from superset.utils.hashing import hash_from_str

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.sql.parse import BaseSQLStatement, SQLScript

logger = logging.getLogger(__name__)


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
        digest = hash_from_str(
            json.dumps(rls_rules, sort_keys=True), algorithm="sha256"
        )
        return f"guest-{digest}"
    return str(get_user_id())


class SearchPath:
    """
    The search path a connection reads a table referenced without a schema through
    (the Postgres ``search_path``, for instance), resolving each such table to the
    schema it's read from.

    A connection searching several schemas reads the first table of the name it
    finds, so which schema that is isn't known without asking it (see
    ``Database.get_search_path``). Tables are looked up as they're needed, each at
    most once, and a batch passed to ``resolve`` in one round trip. Asking
    connects to the database, so a table no control could match in any schema
    (see ``is_table_controlled``) isn't looked up at all.

    A table is identified by its name and the catalog it names, if any. One naming
    a catalog (but no schema) isn't read through the search path, which is that of
    the catalog the query runs in: it's read from the schema its catalog gives it
    (see ``get_catalog_reference_schema``), which needs no lookup.
    """

    def __init__(
        self,
        database: Database,
        catalog: str | None,
        schemas: Iterable[str] | None,
    ) -> None:
        """
        :param schemas: The schemas on the path, in order, or ``None`` when the
            connection couldn't be asked for them
        """
        self.database = database
        self.catalog = catalog
        self.schemas = None if schemas is None else tuple(schemas)
        self._tables: dict[Table, tuple[str, ...] | None] = {}
        self._discovered = True

    @classmethod
    def deferred(cls, database: Database, catalog: str | None) -> SearchPath:
        """
        A search path that's read from the connection when a table first needs it,
        for a caller that doesn't know the tables it will be asked about.
        """
        search_path = cls(database, catalog, None)
        search_path._discovered = False
        return search_path

    def resolve(self, tables: Iterable[Table]) -> None:
        """
        Look up the tables not looked up yet.

        A failed lookup leaves which schema they're read from unknown, rather than
        guessing one (see ``schemas_for``). A failure to authenticate isn't one: the
        user has to sign in, so it's raised.
        """
        missing = sorted(set(tables) - self._tables.keys(), key=str)
        for table in missing:
            if table.catalog:
                schema = get_catalog_reference_schema(self.database, table.catalog)
                self._tables[table] = (schema,) if schema else None
        missing = [table for table in missing if not table.catalog]
        controlled = [
            table
            for table in missing
            if is_table_controlled(self.database, self.catalog, table)
        ]
        for table in set(missing) - set(controlled):
            # no control matches a table of this name, whichever schema holds it
            self._tables[table] = None
        if not controlled:
            return
        found: dict[str, list[str]] = {}
        if not self._discovered or self.schemas is not None:
            try:
                schemas, found = self.database.get_search_path(
                    self.catalog, sorted({table.table for table in controlled})
                )
                self.schemas = tuple(schemas)
            except (OAuth2RedirectError, OAuth2Error):
                raise
            except Exception:  # pylint: disable=broad-except
                logger.warning(
                    "Unable to look up tables on the search path", exc_info=True
                )
                self.schemas = None
            self._discovered = True
        self.record(controlled, found)

    def record(self, tables: Iterable[Table], found: dict[str, list[str]]) -> None:
        """
        Record the schemas holding the tables, as ``get_search_path`` found them
        (by table name).
        """
        for table in tables:
            self._tables[table] = (
                None
                if self.schemas is None
                else tuple(found.get(table.table) or self.schemas) or None
            )

    def schemas_for(self, table: Table) -> tuple[str, ...] | None:
        """
        The schemas a table referenced without a schema may be read from.

        :returns: The schema holding it, or the schemas when its name is ambiguous
            (see ``get_search_path``); every schema on the path when none holds it
            (a script can create it before reading it); the schema its catalog gives
            it when it names one; or ``None`` when that's unknown, so a control has
            to match the table in any schema
        """
        self.resolve([table])
        return self._tables[table]


def get_catalog_reference_schema(database: Database, catalog: str) -> str | None:
    """
    The schema a table naming ``catalog`` but no schema (``catalog..table``) is read
    from, or ``None`` when that's unknown (see
    ``BaseEngineSpec.get_catalog_reference_schema``).
    """
    return database.db_engine_spec.get_catalog_reference_schema(catalog)


def is_table_controlled(database: Database, catalog: str | None, table: Table) -> bool:
    """
    Whether an RLS rule or a schema-qualified ``DISALLOWED_SQL_TABLES`` entry may
    match a table of this name, in some schema.

    Only then does the schema an unqualified table is read from matter, and finding
    it out connects to the database. A bare denylist entry matches whatever the
    schema, so it never needs the lookup. When this can't be told, a control is
    assumed to match.

    :param catalog: The catalog the query runs in, for a table naming none. A table
        naming a catalog is looked up in that one, as ``Table.qualify`` keeps it.
    """
    name = table.table.lower()
    catalog = table.catalog or catalog
    denylist = current_app.config.get("DISALLOWED_SQL_TABLES", {}).get(
        database.db_engine_spec.engine, set()
    )
    if any(
        "." in entry and entry.lower().rpartition(".")[2] == name for entry in denylist
    ):
        return True
    try:
        return bool(
            get_predicates_for_table(
                Table(table.table, catalog=catalog),
                database,
                database.get_default_catalog() if catalog else None,
                any_schema=True,
            )
        )
    except Exception:  # pylint: disable=broad-except
        # a caught DB error can leave db.session in "pending rollback" state
        db.session.rollback()  # pylint: disable=consider-using-transaction
        logger.warning("Unable to look up the rules of a table", exc_info=True)
        return True


# The schema unqualified tables resolve to, or the search path they're read through.
RLSSchema = str | SearchPath


def get_rls_schema(
    database: Database,
    catalog: str | None,
    schema: str | None,
    sql: str,
    template_params: dict[str, Any] | None = None,
) -> RLSSchema:
    """Qualify RLS tables with the execution schema, retaining unknown defaults.

    Only dynamic-schema engines apply a query's schema to the connection. Other
    engines discover it from connection parameters or the inspector. When discovery
    returns no schema, keep the configured schema rather than losing its RLS rules.
    """
    if database.db_engine_spec.supports_dynamic_schema:
        return get_unqualified_table_schemas(database, catalog, schema)
    return (
        database.resolve_query_default_schema(sql, schema, catalog, template_params)
        or schema
        or ""
    )


def get_unqualified_table_schemas(
    database: Database,
    catalog: str | None,
    schema: str | None,
    statements: Iterable[BaseSQLStatement[Any]] | None = None,
) -> RLSSchema:
    """
    The schema an unqualified table resolves to, given the per-query schema, or
    the search path it's read through.

    An engine with dynamic-schema support takes the per-query schema from the
    request, so a request without one has no per-query schema. The connection still
    resolves an unqualified table, through its search path (the Postgres
    ``search_path``, for instance), so the controls that match tables by schema --
    RLS and schema-qualified ``DISALLOWED_SQL_TABLES`` entries -- must match it in
    the schema the connection reads it from, or a table on the path escapes them.

    :param schema: The per-query schema already resolved for execution, if any
    :param statements: The statements being checked. When given, the search path
        is only read if one of them reads an unqualified table that a control may
        match (see ``is_table_controlled``), and those tables are looked up on it at
        the same time, since that connects to the database. Without them, the
        search path is read when a table first needs it (see ``SearchPath``). When
        one of them changes the database (``DROP``, ``CREATE``, ``ALTER``...), a
        table may not be read from the schema holding it before the script runs,
        so it's taken to be in any schema on the path.
    :returns: The schema, the search path when it has several, or an empty string
        when there's no unqualified table to resolve
    """
    if schema:
        return schema
    if not database.db_engine_spec.supports_dynamic_schema:
        return ""
    if statements is None:
        # the tables aren't known, so the search path is read when one needs it
        return SearchPath.deferred(database, catalog)
    statements = list(statements)
    tables = [
        table
        for table in sorted(unqualified_tables(statements), key=str)
        # one naming a catalog isn't read through the search path (see ``SearchPath``)
        if not table.catalog and is_table_controlled(database, catalog, table)
    ]
    if not tables:
        return ""
    try:
        schemas, found = database.get_search_path(
            catalog, sorted({table.table for table in tables})
        )
    except (OAuth2RedirectError, OAuth2Error):
        raise
    except Exception:  # pylint: disable=broad-except
        logger.warning("Unable to read the search path", exc_info=True)
        return SearchPath(database, catalog, None)
    if len(schemas) < 2:
        # a single schema is where every unqualified table is read from
        return schemas[0] if schemas else ""
    if any(statement.is_mutating() for statement in statements):
        # a statement can drop, create or move a table before another reads one of
        # its name, so the schema holding it now needn't be the one read
        found = {}
    search_path = SearchPath(database, catalog, schemas)
    search_path.record(tables, found)
    return search_path


def _rls_key_schema(schema: RLSSchema) -> str | None:
    """
    The schema ``apply_rls`` keys an unqualified table's rules under.

    A table read through a search path with several schemas is keyed without a
    schema, so it can't share a key, and the rules, with a table the query
    qualifies with one. With a single schema every unqualified table is read from
    it, which is the key a known schema gives. The schemas are known once a table
    on the path has been resolved.
    """
    if isinstance(schema, str):
        return schema
    return schema.schemas[0] if schema.schemas and len(schema.schemas) == 1 else None


def rls_key(
    table: Table,
    catalog: str | None,
    schema: RLSSchema,
    catalog_schemas: Mapping[str, str | None],
) -> Table:
    """
    The key ``apply_rls`` files a table's rules under, which is the table
    ``RLSTransformer.get_predicate`` looks up for the same reference.

    A table naming a catalog but no schema is keyed under the schema its catalog
    gives it, or none when that's unknown, and not under the query's schema: it's
    another table than a ``table`` or ``catalog.schema.table`` the query's schema
    would put under the same key.
    """
    if table.catalog and not table.schema:
        return table.qualify(
            catalog=catalog, schema=catalog_schemas.get(table.catalog.lower())
        )
    return table.qualify(catalog=catalog, schema=_rls_key_schema(schema))


def qualify_table(
    database: Database,
    table: Table,
    catalog: str | None,
    schema: RLSSchema,
) -> list[tuple[Table, bool]]:
    """
    The tables a reference may name, each qualified with a schema it may be read
    from.

    A reference naming its schema, or an unqualified one read from a known schema,
    names the table there. One read through a search path names the table in the
    schema it's read from (see ``SearchPath.schemas_for``), and when that's
    unknown, a table of its name in any schema, so a control errs toward an extra
    rule rather than a missing one. One naming a catalog but no schema is read from
    the schema its catalog gives it, and not from the schema or search path of the
    catalog the query runs in (see ``get_catalog_reference_schema``).

    :param schema: The schema, or search path, unqualified tables resolve to (see
        ``get_unqualified_table_schemas``)
    :returns: Each table, and whether it stands for a table of its name in any
        schema (see ``get_predicates_for_table``)
    """
    if table.schema:
        return [(table.qualify(catalog=catalog), False)]
    if table.catalog and isinstance(schema, str):
        named_schema = get_catalog_reference_schema(database, table.catalog)
        return [
            (table.qualify(catalog=catalog, schema=named_schema), named_schema is None)
        ]
    if isinstance(schema, str):
        return [(table.qualify(catalog=catalog, schema=schema), False)]
    candidates = schema.schemas_for(Table(table.table, catalog=table.catalog))
    if candidates is None:
        return [(table.qualify(catalog=catalog), True)]
    return [
        (table.qualify(catalog=catalog, schema=candidate), False)
        for candidate in candidates
    ]


def get_disallowed_tables(
    database: Database,
    script: SQLScript,
    tables: set[str],
    schema: RLSSchema | None,
) -> set[str]:
    """
    The ``DISALLOWED_SQL_TABLES`` entries a script reads.

    :param schema: The schema unqualified tables resolve to, or the search path
        they're read through (see ``get_unqualified_table_schemas``). A
        schema-qualified entry matches an unqualified table read from its schema,
        and when that's unknown, one of its name whatever the schema. One naming a
        catalog but no schema is read from the schema its catalog gives it (see
        ``get_catalog_reference_schema``), whatever this is.
    """
    catalog_schemas = get_catalog_schemas(database, script.statements)
    if not isinstance(schema, SearchPath):
        return script.get_disallowed_tables(tables, schema, catalog_schemas)

    found = script.get_disallowed_tables(tables, None, catalog_schemas)
    qualified = {
        entry: entry.lower().rpartition(".")[::2] for entry in tables if "." in entry
    }
    names = unqualified_tables(script.statements) if qualified else set()
    schema.resolve(names)
    for reference in names:
        candidates = schema.schemas_for(reference)
        searched = None if candidates is None else {c.lower() for c in candidates}
        found.update(
            entry
            for entry, (entry_schema, entry_table) in qualified.items()
            if entry_table == reference.table.lower()
            and (searched is None or entry_schema in searched)
        )
    return found


def unqualified_tables(statements: Iterable[BaseSQLStatement[Any]]) -> set[Table]:
    """
    The tables the statements read without naming their schema, each with the
    catalog it names, if any.
    """
    return {
        Table(table.table, catalog=table.catalog)
        for statement in statements
        for table in statement.tables
        if not table.schema
    }


def get_catalog_schemas(
    database: Database, statements: Iterable[BaseSQLStatement[Any]]
) -> dict[str, str | None]:
    """
    The schema each catalog the statements name gives a table that names it but no
    schema (``catalog..table``), by lower-cased catalog, or ``None`` when the engine
    doesn't say (see ``get_catalog_reference_schema``).
    """
    return {
        table.catalog.lower(): get_catalog_reference_schema(database, table.catalog)
        for table in unqualified_tables(statements)
        if table.catalog
    }


def reads_unqualified_table(statements: Iterable[BaseSQLStatement[Any]]) -> bool:
    """
    Whether any of the statements reads a table without naming its schema.
    """
    return bool(unqualified_tables(statements))


def has_qualified_table_entry(tables: Iterable[str]) -> bool:
    """
    Whether a table denylist has a schema-qualified entry (e.g. ``public.secrets``).

    Bare entries match a table whatever its schema, so only a qualified entry needs
    the schema an unqualified table resolves to.
    """
    return any("." in table for table in tables)


def apply_rls(
    database: Database,
    catalog: str | None,
    schema: RLSSchema,
    parsed_statement: BaseSQLStatement[Any],
    exclude_dataset_id: int | None = None,
    include_global_guest_rls: bool = True,
) -> bool:
    """
    Modify statement inplace to ensure RLS rules are applied.

    :param exclude_dataset_id: When applying RLS to a virtual dataset's inner SQL,
        pass the virtual dataset's id here so its own RLS isn't injected again
        on top of the outer-WHERE application (avoids double-apply when the
        virtual dataset's table_name collides with a table in its own SQL — for
        example, after converting a physical dataset with RLS to virtual). Like
        global guest rules, its RLS is still injected into tables read inside an
        uncorrelated sub-query, which the outer query does not constrain.
    :param include_global_guest_rls: Also inject global (unscoped) guest RLS
        rules. Pass False only for a virtual dataset's inner SQL, whose outer
        query already applies them to the rows the inner SQL returns. They are
        still injected into tables read inside an uncorrelated sub-query there,
        since the outer query does not constrain those. Any other statement, such
        as a SQL Lab query or an adhoc sub-query, is not constrained by such an
        outer query.
    :returns: True if any RLS predicates were actually applied, False otherwise.
    """
    # There are two ways to insert RLS: either replacing the table with a subquery
    # that has the RLS, or appending the RLS to the ``WHERE`` clause. The former is
    # safer, but not supported in all databases.
    method = database.db_engine_spec.get_rls_method()

    predicates, subquery_predicates = get_rls_predicates(
        database,
        catalog,
        schema,
        parsed_statement,
        database.get_default_catalog(),
        exclude_dataset_id=exclude_dataset_id,
        include_global_guest_rls=include_global_guest_rls,
    )

    def parse(rules: dict[Table, list[str]]) -> dict[Table, list[Any]]:
        return {
            table: [
                parsed_statement.parse_predicate(predicate)
                for predicate in table_predicates
                if predicate
            ]
            for table, table_predicates in rules.items()
        }

    return parsed_statement.apply_rls(
        catalog,
        _rls_key_schema(schema),
        parse(predicates),
        method,
        None if subquery_predicates is None else parse(subquery_predicates),
        get_catalog_schemas(database, [parsed_statement]),
    )


def get_rls_predicates(
    database: Database,
    catalog: str | None,
    schema: RLSSchema,
    parsed_statement: BaseSQLStatement[Any],
    default_catalog: str | None,
    exclude_dataset_id: int | None = None,
    include_global_guest_rls: bool = True,
) -> tuple[dict[Table, list[str]], dict[Table, list[str]] | None]:
    """
    The RLS predicates ``apply_rls`` injects into a statement, per qualified table.

    Shared by ``apply_rls`` and the cache-key collector so a cached result is keyed
    on exactly the rules its execution applied.

    :returns: The rules for the statement's table reads, and the rules for reads
        inside an uncorrelated sub-query when those differ (``None`` otherwise,
        meaning sub-query reads get the first set). See ``apply_rls`` for the
        parameters.
    """

    catalog_schemas = get_catalog_schemas(database, [parsed_statement])

    def collect_predicates(
        include_global: bool, exclude_id: int | None
    ) -> dict[Table, list[str]]:
        predicates: dict[Table, list[str]] = {}
        # In a fixed order, as ``tables`` is a set whose order varies with the
        # process, so what a key ends up with doesn't.
        for table in sorted(parsed_statement.tables, key=str):
            key = rls_key(table, catalog, schema, catalog_schemas)
            # Tables sharing a key (a search path of several schemas keys its
            # tables without one, as does an unknown schema of a catalog) share
            # the rules of each: an extra rule rather than a missing one.
            predicates[key] = remove_duplicates(
                [
                    *predicates.get(key, []),
                    *(
                        predicate
                        for candidate, any_schema in qualify_table(
                            database, table, catalog, schema
                        )
                        for predicate in get_predicates_for_table(
                            candidate,
                            database,
                            default_catalog,
                            exclude_dataset_id=exclude_id,
                            include_global_guest_rls=include_global,
                            any_schema=any_schema,
                        )
                    ),
                ]
            )
        return predicates

    if isinstance(schema, SearchPath):
        # one round trip for the statement's tables, rather than one per table
        schema.resolve(unqualified_tables([parsed_statement]))

    predicates = collect_predicates(include_global_guest_rls, exclude_dataset_id)
    # The outer query only constrains the rows that reach it, so a table read
    # inside an uncorrelated sub-query still gets the rules left to the outer
    # query: the global guest rules and the excluded dataset's own RLS. The
    # second lookup is skipped when neither applies: only a guest token carries
    # global guest rules, and most virtual datasets have no RLS of their own.
    needs_subquery_predicates = parsed_statement.has_subquery() and (
        (
            not include_global_guest_rls
            and security_manager.get_current_guest_user_if_guest() is not None
        )
        or (exclude_dataset_id is not None and _dataset_has_rls(exclude_dataset_id))
    )
    subquery_predicates = (
        collect_predicates(True, None) if needs_subquery_predicates else None
    )
    return predicates, subquery_predicates


def _dataset_has_rls(dataset_id: int) -> bool:
    """
    Does the dataset have RLS predicates for the current user?

    :param dataset_id: The dataset's id
    """
    from superset.connectors.sqla.models import SqlaTable

    dataset = db.session.get(SqlaTable, dataset_id)
    return dataset is not None and bool(dataset.get_sqla_row_level_filters())


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


def find_datasets(
    table: Table,
    database: Database,
    default_catalog: str | None,
    exclude_dataset_id: int | None,
    fold: bool,
    any_schema: bool = False,
) -> list[SqlaTable]:
    """
    Find the datasets a table reference resolves to.

    Matches the reference's schema first, then a dataset stored without a schema,
    which is scoped to the database's default schema. These are separate queries
    rather than one ``OR`` so that a schema match wins; resolving the default
    schema probes the analytic database, so it is deferred until a null-schema
    dataset is known to exist. A dataset stored with a null catalog is likewise
    scoped to the default catalog.

    :param fold: Compare identifiers case-insensitively, for an engine that
        doesn't treat unquoted identifiers as case-sensitive. Datasets are unique
        per exact ``(database, catalog, schema, table name)``, so folding can
        match several that differ only in case. They all name the same physical
        table, so all of them are returned and the caller applies every one's
        predicates, rather than picking one and dropping the rest.
    :param any_schema: Match a dataset of the table's name in any schema, for a
        reference whose schema can't be determined
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

    def match(schema_predicate: Any) -> list[SqlaTable]:
        query = db.session.query(SqlaTable).filter(and_(*filters, schema_predicate))
        if fold or any_schema:
            return query.all()
        dataset = query.one_or_none()
        return [dataset] if dataset else []

    if any_schema:
        return match(true())

    if datasets := match(eq(SqlaTable.schema, table.schema)):
        return datasets

    if (
        table.schema
        and (null_schema_datasets := match(SqlaTable.schema.is_(None)))
        and same(table.schema, database.get_default_schema(table.catalog))
    ):
        return null_schema_datasets

    return []


def get_predicates_for_table(
    table: Table,
    database: Database,
    default_catalog: str | None,
    exclude_dataset_id: int | None = None,
    include_global_guest_rls: bool = True,
    any_schema: bool = False,
) -> list[str]:
    """
    Get the RLS predicates for a table.

    This is used to inject RLS rules into SQL statements run in SQL Lab. Note that the
    table must be fully qualified, with catalog (null if the DB doesn't support) and
    schema.

    :param include_global_guest_rls: Also return global (unscoped) guest RLS rules.
        See ``apply_rls``.
    :param any_schema: Get the predicates of the table in any schema (see
        ``find_datasets``)
    """
    datasets = find_datasets(
        table,
        database,
        default_catalog,
        exclude_dataset_id,
        # An engine that doesn't treat unquoted identifiers as case-sensitive
        # resolves a case-mismatched reference (e.g. ``BIRTH_NAMES``) to the same
        # physical table as the registered dataset (``birth_names``), so every
        # dataset whose name differs only in case describes that one table and
        # all of their predicates apply. Matching the exact casing first instead
        # would let a dataset registered as ``Birth_Names`` shadow the protected
        # one and drop its predicates. A parsed reference carries no quoting
        # information, so this also matches a quoted reference, which is a
        # distinct table on those engines: that direction applies extra
        # predicates rather than dropping one that should have applied.
        fold=folds_unquoted_object_names(database.db_engine_spec.engine),
        any_schema=any_schema,
    )

    if not datasets:
        return []

    # For a virtual dataset's inner SQL, callers exclude global (unscoped) guest
    # RLS to prevent double application. Global guest rules will be applied to
    # the outer query via get_sqla_row_level_filters() on the virtual dataset
    # itself; apply_rls() still includes them for tables read in sub-queries.
    # Dataset-scoped guest rules are still included here because they target
    # this specific physical dataset and won't match on the outer query.
    # A folded match can resolve to several datasets naming the same physical
    # table, in which case every one's predicates apply; deduplicated because a
    # single RLS rule can be attached to more than one of them.
    dialect = database.get_dialect()
    return remove_duplicates(
        str(predicate.compile(dialect=dialect, compile_kwargs={"literal_binds": True}))
        for dataset in datasets
        for predicate in dataset.get_sqla_row_level_filters(
            include_global_guest_rls=include_global_guest_rls
        )
    )


def collect_rls_predicates_for_sql(
    sql: str,
    database: Database,
    catalog: str | None,
    schema: str | None,
    exclude_dataset_id: int | None = None,
    *,
    include_global_guest_rls: bool = True,
    resolve_catalog: Callable[[], str | None] | None = None,
    resolve_schema: Callable[[], RLSSchema] | None = None,
) -> list[str]:
    """
    Collect all RLS predicates that would be applied to tables in the given SQL.

    This is used for cache key generation for virtual datasets to ensure that
    different users with different RLS rules get different cache keys. Each
    predicate is tagged with its qualified table so exchanging rules between
    tables cannot collapse distinct scopes into the same unordered key set.

    :param sql: The SQL query to analyze
    :param database: The database the query runs against
    :param catalog: The default catalog for the query
    :param schema: The default schema for the query
    :param exclude_dataset_id: Mirror of the same parameter on apply_rls — pass
        the virtual dataset's id so its self-match is excluded from the cache key
        (kept consistent with what's actually applied at query time).
    :param include_global_guest_rls: Mirror of the same parameter on apply_rls,
        so the key carries the global guest rules wherever execution injects
        them. Rules injected only into tables read inside a sub-query are tagged
        separately, since execution leaves the same table's other reads unfiltered.
    :param resolve_catalog: Optional memoized resolver shared by cache-key collectors,
        including engines that require a connection to discover the default catalog.
    :param resolve_schema: Resolve the execution schema inside the failure guard.
    :return: Table-tagged RLS predicate strings that would be applied
    """
    from superset.sql.parse import SQLScript

    try:
        # Schema discovery can connect to the database, so failures must use
        # the same viewer-scoped fallback as predicate collection failures.
        rls_schema: RLSSchema = (
            resolve_schema()
            if resolve_schema is not None
            else (
                schema
                if schema is not None
                else database.get_default_schema(catalog) or ""
            )
        )
        parsed_script = SQLScript(sql, engine=database.db_engine_spec.engine)
        default_catalog = (resolve_catalog or database.get_default_catalog)()
        keys: set[str] = set()
        for statement in parsed_script.statements:
            predicates, subquery_predicates = get_rls_predicates(
                database,
                catalog,
                rls_schema,
                statement,
                default_catalog,
                exclude_dataset_id=exclude_dataset_id,
                include_global_guest_rls=include_global_guest_rls,
            )
            for tag, rules in (
                ("rls", predicates),
                ("rls-subquery", subquery_predicates or {}),
            ):
                keys.update(
                    json.dumps([tag, table.catalog, table.schema, table.table, rule])
                    for table, table_rules in rules.items()
                    for rule in table_rules
                )
        return sorted(keys)
    except (OAuth2RedirectError, OAuth2Error):
        # the user has to sign in to the database to look up the tables
        raise
    except Exception:
        # The block above is not only SQL parsing: `get_predicates_for_table`
        # queries `db.session` and `get_default_catalog()` builds an engine, so
        # a caught DB error can leave db.session in "pending rollback" state,
        # which would poison unrelated queries later in this request.
        #
        # Unconditional, like the RLS handler in `models/helpers.py`: the DB
        # work above can poison the session and then a different, non-DB error
        # can surface -- building the engine raises `SupersetErrorException`
        # when the impersonated user cannot be resolved, for instance -- so
        # keying the rollback on the exception type would miss exactly the
        # cases that need it.
        db.session.rollback()  # pylint: disable=consider-using-transaction

        # If we can't parse the SQL, we can't tell which (if any) RLS
        # predicates would apply, so we can't contribute a meaningful cache
        # key component. Returning an empty list here would make every
        # user's failure collapse onto the same (missing) contribution,
        # which is unsafe when different users have different RLS scopes on
        # the underlying tables. Fall back to a per-user marker instead, so
        # the cache key still varies by user even though we don't know the
        # actual predicates.
        return [f"rls-predicate-parse-failed-for-user-{_get_cache_identity()}"]
