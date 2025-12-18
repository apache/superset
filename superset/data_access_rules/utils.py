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
"""
Data Access Rules utility functions.

This module provides functions for:
- Checking if a user has access to a table
- Collecting RLS predicates for a table
- Collecting CLS rules for a table
- Applying RLS and CLS to SQL queries
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from typing import Any, TYPE_CHECKING

from flask import g

from superset import db, is_feature_enabled, security_manager
from superset.sql.parse import CLSAction, Table

if TYPE_CHECKING:
    from superset.data_access_rules.models import DataAccessRule
    from superset.models.core import Database
    from superset.sql.parse import BaseSQLStatement

logger = logging.getLogger(__name__)


class AccessCheckResult(Enum):
    """Result of an access check."""

    ALLOWED = "allowed"
    DENIED = "denied"
    NO_RULE = "no_rule"


@dataclass
class RLSPredicate:
    """An RLS predicate with optional group_key."""

    predicate: str
    group_key: str | None = None


@dataclass
class TableAccessInfo:
    """Information about access to a specific table."""

    access: AccessCheckResult
    rls_predicates: list[RLSPredicate]
    cls_rules: dict[str, CLSAction]


def get_user_rules() -> list[DataAccessRule]:
    """
    Get all data access rules for the current user's roles.

    Returns:
        List of DataAccessRule objects for the current user's roles.
    """
    from superset.data_access_rules.models import DataAccessRule

    if not hasattr(g, "user") or not g.user:
        return []

    user_roles = security_manager.get_user_roles()
    role_ids = [role.id for role in user_roles]

    if not role_ids:
        return []

    return (
        db.session.query(DataAccessRule)
        .filter(DataAccessRule.role_id.in_(role_ids))
        .all()
    )


def _matches_rule_entry(
    entry: dict[str, Any],
    database_name: str,
    catalog: str | None,
    schema: str | None,
    table_name: str | None,
) -> bool:
    """
    Check if a rule entry matches the given database/catalog/schema/table.

    The rule entry can specify any level of the hierarchy:
    - database only: matches all catalogs/schemas/tables in that database
    - database + catalog: matches all schemas/tables in that catalog
    - database + schema: matches all tables in that schema (for DBs without catalogs)
    - database + catalog + schema: matches all tables in that schema
    - database + schema + table: matches the specific table (for DBs without catalogs)
    - database + catalog + schema + table: matches the specific table

    Args:
        entry: The rule entry dict
        database_name: The database name to check
        catalog: The catalog to check (None if DB doesn't support catalogs)
        schema: The schema to check
        table_name: The table name to check

    Returns:
        True if the entry matches, False otherwise.
    """
    # Database must always match
    if entry.get("database") != database_name:
        return False

    entry_catalog = entry.get("catalog")
    entry_schema = entry.get("schema")
    entry_table = entry.get("table")

    # If the entry specifies a catalog, it must match (or catalog must be None/default)
    if entry_catalog is not None:
        if catalog is not None and entry_catalog != catalog:
            return False

    # If the entry specifies a schema, it must match
    if entry_schema is not None:
        if schema is not None and entry_schema != schema:
            return False

    # If the entry specifies a table, it must match
    if entry_table is not None:
        if table_name is not None and entry_table != table_name:
            return False

    # Check specificity: entry must be at least as specific as the query
    # If querying a specific table, entry must specify that table or be broader
    if table_name is not None and entry_table is not None and entry_table != table_name:
        return False

    return True


def _is_more_specific(entry: dict[str, Any], other: dict[str, Any]) -> bool:
    """
    Check if 'entry' is more specific than 'other'.

    More specific means it specifies more levels of the hierarchy.
    """
    entry_specificity = sum(
        [
            entry.get("catalog") is not None,
            entry.get("schema") is not None,
            entry.get("table") is not None,
        ]
    )
    other_specificity = sum(
        [
            other.get("catalog") is not None,
            other.get("schema") is not None,
            other.get("table") is not None,
        ]
    )
    return entry_specificity > other_specificity


def check_table_access(
    database_name: str,
    table: Table,
    rules: list[DataAccessRule] | None = None,
) -> TableAccessInfo:
    """
    Check if the current user has access to a specific table.

    The function evaluates all rules for the user's roles and determines:
    1. Whether access is allowed, denied, or no rule applies
    2. Any RLS predicates that should be applied
    3. Any CLS rules for column masking/hiding

    Denied rules take precedence over allowed rules when at the same specificity level.
    More specific rules take precedence over less specific rules.

    Args:
        database_name: The database name
        table: The Table object with catalog, schema, and table name
        rules: Optional list of rules to check (defaults to current user's rules)

    Returns:
        TableAccessInfo with access result, RLS predicates, and CLS rules.
    """
    if rules is None:
        rules = get_user_rules()

    if not rules:
        return TableAccessInfo(
            access=AccessCheckResult.NO_RULE,
            rls_predicates=[],
            cls_rules={},
        )

    # Collect all matching rules
    allowed_entries: list[dict[str, Any]] = []
    denied_entries: list[dict[str, Any]] = []

    for rule in rules:
        rule_dict = rule.rule_dict

        # Check allowed entries
        for entry in rule_dict.get("allowed", []):
            if _matches_rule_entry(
                entry, database_name, table.catalog, table.schema, table.table
            ):
                allowed_entries.append(entry)

        # Check denied entries
        for entry in rule_dict.get("denied", []):
            if _matches_rule_entry(
                entry, database_name, table.catalog, table.schema, table.table
            ):
                denied_entries.append(entry)

    # If no rules match, return NO_RULE
    if not allowed_entries and not denied_entries:
        return TableAccessInfo(
            access=AccessCheckResult.NO_RULE,
            rls_predicates=[],
            cls_rules={},
        )

    # Find the most specific denied entry
    most_specific_denied = None
    for entry in denied_entries:
        if most_specific_denied is None or _is_more_specific(
            entry, most_specific_denied
        ):
            most_specific_denied = entry

    # Find the most specific allowed entry
    most_specific_allowed = None
    for entry in allowed_entries:
        if most_specific_allowed is None or _is_more_specific(
            entry, most_specific_allowed
        ):
            most_specific_allowed = entry

    # Determine access: deny wins at same specificity, more specific wins otherwise
    if most_specific_denied is not None and most_specific_allowed is not None:
        if _is_more_specific(most_specific_denied, most_specific_allowed):
            return TableAccessInfo(
                access=AccessCheckResult.DENIED,
                rls_predicates=[],
                cls_rules={},
            )
        elif _is_more_specific(most_specific_allowed, most_specific_denied):
            # Access allowed, collect RLS and CLS from matching entries
            pass
        else:
            # Same specificity: denied wins
            return TableAccessInfo(
                access=AccessCheckResult.DENIED,
                rls_predicates=[],
                cls_rules={},
            )
    elif most_specific_denied is not None:
        return TableAccessInfo(
            access=AccessCheckResult.DENIED,
            rls_predicates=[],
            cls_rules={},
        )
    elif most_specific_allowed is None:
        return TableAccessInfo(
            access=AccessCheckResult.NO_RULE,
            rls_predicates=[],
            cls_rules={},
        )

    # Collect RLS predicates from all matching allowed entries
    # (RLS is cumulative - all predicates are applied)
    rls_predicates: list[RLSPredicate] = []
    for entry in allowed_entries:
        rls_config = entry.get("rls")
        if rls_config and "predicate" in rls_config:
            rls_predicates.append(
                RLSPredicate(
                    predicate=rls_config["predicate"],
                    group_key=rls_config.get("group_key"),
                )
            )

    # Collect CLS rules from all matching allowed entries
    # (CLS is cumulative - strictest action wins per column)
    cls_rules: dict[str, CLSAction] = {}
    cls_precedence = {
        CLSAction.HIDE: 4,
        CLSAction.NULLIFY: 3,
        CLSAction.MASK: 2,
        CLSAction.HASH: 1,
    }
    action_map = {
        "hide": CLSAction.HIDE,
        "nullify": CLSAction.NULLIFY,
        "mask": CLSAction.MASK,
        "hash": CLSAction.HASH,
    }

    for entry in allowed_entries:
        cls_config = entry.get("cls", {})
        for column, action_str in cls_config.items():
            action = action_map.get(action_str.lower())
            if action is None:
                logger.warning("Unknown CLS action: %s", action_str)
                continue

            existing = cls_rules.get(column)
            if existing is None or cls_precedence[action] > cls_precedence[existing]:
                cls_rules[column] = action

    return TableAccessInfo(
        access=AccessCheckResult.ALLOWED,
        rls_predicates=rls_predicates,
        cls_rules=cls_rules,
    )


def get_rls_predicates_for_table(
    table: Table,
    database: Database,
    rules: list[DataAccessRule] | None = None,
) -> list[str]:
    """
    Get the RLS predicates for a table using the new Data Access Rules system.

    This function collects all RLS predicates from matching rules and combines them
    using the group_key logic:
    - Predicates without group_key are ANDed together
    - Predicates with the same group_key are ORed together
    - Groups are ANDed together

    Args:
        table: The fully qualified Table object
        database: The Database object
        rules: Optional list of rules to check (defaults to current user's rules)

    Returns:
        List of SQL predicate strings to be ANDed together.
    """
    access_info = check_table_access(
        database_name=database.database_name,
        table=table,
        rules=rules,
    )

    if access_info.access != AccessCheckResult.ALLOWED:
        return []

    if not access_info.rls_predicates:
        return []

    # Group predicates by group_key
    ungrouped: list[str] = []
    groups: dict[str, list[str]] = defaultdict(list)

    for pred in access_info.rls_predicates:
        if pred.group_key:
            groups[pred.group_key].append(f"({pred.predicate})")
        else:
            ungrouped.append(f"({pred.predicate})")

    # Build result: ungrouped predicates + OR'd groups
    result = ungrouped.copy()
    for group_predicates in groups.values():
        if len(group_predicates) == 1:
            result.append(group_predicates[0])
        else:
            result.append(f"({' OR '.join(group_predicates)})")

    return result


def get_cls_rules_for_table(
    table: Table,
    database: Database,
    rules: list[DataAccessRule] | None = None,
) -> dict[str, CLSAction]:
    """
    Get the CLS rules for a table using the new Data Access Rules system.

    Args:
        table: The fully qualified Table object
        database: The Database object
        rules: Optional list of rules to check (defaults to current user's rules)

    Returns:
        Dict mapping column names to CLSAction values.
    """
    access_info = check_table_access(
        database_name=database.database_name,
        table=table,
        rules=rules,
    )

    if access_info.access != AccessCheckResult.ALLOWED:
        return {}

    return access_info.cls_rules


def get_hidden_columns_for_table(
    table: Table,
    database: Database,
    rules: list[DataAccessRule] | None = None,
) -> set[str]:
    """
    Get the set of column names that should be hidden for a table.

    This function checks the CLS rules for the current user and returns
    the names of columns that have the "hide" action applied.

    Args:
        table: The fully qualified Table object
        database: The Database object
        rules: Optional list of rules to check (defaults to current user's rules)

    Returns:
        Set of column names that should be hidden.
    """
    cls_rules = get_cls_rules_for_table(table, database, rules)

    hidden_columns: set[str] = set()
    for column_name, action in cls_rules.items():
        if action == CLSAction.HIDE:
            hidden_columns.add(column_name)

    return hidden_columns


def filter_columns_by_cls(
    columns: list[dict[str, Any]],
    table: Table,
    database: Database,
    column_name_key: str = "column_name",
) -> list[dict[str, Any]]:
    """
    Filter a list of column dictionaries to exclude hidden columns.

    This function is useful for filtering column metadata returned by
    database reflection or dataset APIs.

    Args:
        columns: List of column dictionaries
        table: The fully qualified Table object
        database: The Database object
        column_name_key: The key in the column dict that contains the column name

    Returns:
        Filtered list of columns with hidden columns removed.
    """
    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return columns

    hidden_columns = get_hidden_columns_for_table(table, database)

    if not hidden_columns:
        return columns

    return [
        col for col in columns
        if col.get(column_name_key) not in hidden_columns
    ]


def apply_data_access_rules(
    database: Database,
    catalog: str | None,
    schema: str,
    parsed_statement: BaseSQLStatement[Any],
) -> None:
    """
    Apply Data Access Rules (RLS and CLS) to a parsed SQL statement.

    This function:
    1. Checks if the DATA_ACCESS_RULES feature is enabled
    2. For each table in the query, checks access and collects RLS/CLS rules
    3. Applies RLS predicates using the existing infrastructure
    4. Applies CLS rules using the existing infrastructure

    Args:
        database: The Database object
        catalog: The default catalog for the query
        schema: The default schema for the query
        parsed_statement: The parsed SQL statement to modify in place
    """
    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return

    from superset.sql.parse import CLSRules

    rules = get_user_rules()
    if not rules:
        return

    # Get the RLS method for this database
    method = database.db_engine_spec.get_rls_method()

    # Collect RLS predicates and CLS rules for all tables
    rls_predicates: dict[Table, list[Any]] = {}
    cls_rules: CLSRules = {}

    for table in parsed_statement.tables:
        qualified_table = table.qualify(catalog=catalog, schema=schema)

        # Check access first
        access_info = check_table_access(
            database_name=database.database_name,
            table=qualified_table,
            rules=rules,
        )

        if access_info.access == AccessCheckResult.DENIED:
            # TODO: How should we handle denied access mid-query?
            # For now, log a warning. In the future, we might raise an exception.
            logger.warning(
                "Access denied to table %s for user %s",
                qualified_table,
                getattr(g, "user", "unknown"),
            )
            continue

        # Collect RLS predicates
        predicates = get_rls_predicates_for_table(qualified_table, database, rules)
        if predicates:
            rls_predicates[qualified_table] = [
                parsed_statement.parse_predicate(pred) for pred in predicates if pred
            ]

        # Collect CLS rules
        table_cls = get_cls_rules_for_table(qualified_table, database, rules)
        if table_cls:
            cls_rules[qualified_table] = table_cls

    # Apply CLS first (before RLS) so that hidden columns are removed
    # before RLS wraps the query in a subquery
    if cls_rules:
        # Build schema dict for sqlglot's qualify() to expand SELECT *
        # sqlglot expects nested format: {catalog: {schema: {table: {col: type}}}}
        # or {schema: {table: {col: type}}} without catalog
        table_schemas: dict[str, Any] = {}
        for table in cls_rules.keys():
            try:
                columns = database.get_columns(table)
                col_types = {
                    col["column_name"]: str(col.get("type", "VARCHAR"))
                    for col in columns
                }

                # Build nested structure for sqlglot
                if table.catalog:
                    if table.catalog not in table_schemas:
                        table_schemas[table.catalog] = {}
                    if table.schema:
                        if table.schema not in table_schemas[table.catalog]:
                            table_schemas[table.catalog][table.schema] = {}
                        table_schemas[table.catalog][table.schema][table.table] = col_types
                    else:
                        table_schemas[table.catalog][table.table] = col_types
                elif table.schema:
                    if table.schema not in table_schemas:
                        table_schemas[table.schema] = {}
                    table_schemas[table.schema][table.table] = col_types
                else:
                    table_schemas[table.table] = col_types
            except Exception as ex:
                logger.warning(
                    "Could not fetch schema for table %s: %s",
                    table,
                    ex,
                )

        parsed_statement.apply_cls(cls_rules, schema=table_schemas if table_schemas else None)

    # Apply RLS after CLS - RLS wraps the query in a subquery with SELECT *
    # which will pick up the already-transformed columns from CLS
    if rls_predicates:
        parsed_statement.apply_rls(catalog, schema, rls_predicates, method)


def get_allowed_tables(
    database_name: str,
    schema: str | None = None,
    catalog: str | None = None,
) -> tuple[set[str], bool]:
    """
    Get all table names that the current user has access to via Data Access Rules
    for a specific database and schema.

    Args:
        database_name: The database name to check
        schema: Optional schema name to filter by
        catalog: Optional catalog name to filter by

    Returns:
        Tuple of (set of table names, bool indicating if schema-level access is granted).
        If schema-level access is granted, the set may be empty but all tables are allowed.
    """
    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return set(), False

    rules = get_user_rules()
    if not rules:
        return set(), False

    table_names: set[str] = set()
    schema_level_access = False

    for rule in rules:
        rule_dict = rule.rule_dict

        # Collect tables from allowed entries
        for entry in rule_dict.get("allowed", []):
            if entry.get("database") != database_name:
                continue

            # If catalog is specified in the entry, it must match
            entry_catalog = entry.get("catalog")
            if catalog is not None and entry_catalog is not None:
                if entry_catalog != catalog:
                    continue

            # If schema is specified, check if it matches
            entry_schema = entry.get("schema")
            if schema is not None and entry_schema is not None:
                if entry_schema != schema:
                    continue

            # If entry has a table, add it to the set
            if table := entry.get("table"):
                table_names.add(table)
            elif entry_schema == schema or (entry_schema is None and schema is None):
                # Schema-level or database-level access without table means all tables
                schema_level_access = True

    return table_names, schema_level_access


def get_allowed_schemas(database_name: str, catalog: str | None = None) -> set[str]:
    """
    Get all schema names that the current user has access to via Data Access Rules
    for a specific database.

    Args:
        database_name: The database name to check
        catalog: Optional catalog name to filter by

    Returns:
        Set of schema names the user has access to.
    """
    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return set()

    rules = get_user_rules()
    if not rules:
        return set()

    schema_names: set[str] = set()

    for rule in rules:
        rule_dict = rule.rule_dict

        # Collect schemas from allowed entries
        for entry in rule_dict.get("allowed", []):
            if entry.get("database") != database_name:
                continue

            # If catalog is specified in the entry, it must match
            entry_catalog = entry.get("catalog")
            if catalog is not None and entry_catalog is not None:
                if entry_catalog != catalog:
                    continue

            # If the entry grants database-level access (no schema specified),
            # we return an empty set to indicate "all schemas" should be allowed
            # This will be handled by the caller
            if schema := entry.get("schema"):
                schema_names.add(schema)
            elif entry.get("database") == database_name:
                # Database-level access without schema means all schemas
                # Return a special marker that caller can check
                schema_names.add("*")

    return schema_names


def get_allowed_databases() -> set[str]:
    """
    Get all database names that the current user has access to via Data Access Rules.

    This function is used to populate database selectors in SQL Lab and elsewhere.

    Returns:
        Set of database names the user has access to.
    """
    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return set()

    rules = get_user_rules()
    if not rules:
        return set()

    database_names: set[str] = set()

    for rule in rules:
        rule_dict = rule.rule_dict

        # Collect databases from allowed entries
        for entry in rule_dict.get("allowed", []):
            if database := entry.get("database"):
                database_names.add(database)

    return database_names


@dataclass
class AllowedTable:
    """A table allowed by DAR with database context."""

    database: str
    table: str
    schema: str | None = None
    catalog: str | None = None


@dataclass
class AllowedEntry:
    """
    An allowed entry from DAR at any level of the hierarchy.

    Fields may be None to indicate "all" at that level:
    - database only: all catalogs/schemas/tables in that database
    - database + catalog: all schemas/tables in that catalog
    - database + schema: all tables in that schema (for DBs without catalogs)
    - database + catalog + schema: all tables in that schema
    - database + schema + table: specific table (for DBs without catalogs)
    - database + catalog + schema + table: specific table
    """

    database: str
    catalog: str | None = None
    schema: str | None = None
    table: str | None = None


def get_all_allowed_entries() -> list[AllowedEntry]:
    """
    Get all access entries that the current user has via Data Access Rules
    across all databases.

    This function returns entries at all hierarchy levels (database, schema, table),
    allowing callers to build appropriate filters for their use case.

    Returns:
        List of AllowedEntry objects representing allowed access.
    """
    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return []

    rules = get_user_rules()
    if not rules:
        return []

    allowed_entries: list[AllowedEntry] = []

    for rule in rules:
        rule_dict = rule.rule_dict

        # Collect all allowed entries
        for entry in rule_dict.get("allowed", []):
            database = entry.get("database")
            if not database:
                continue

            allowed_entries.append(
                AllowedEntry(
                    database=database,
                    catalog=entry.get("catalog"),
                    schema=entry.get("schema"),
                    table=entry.get("table"),
                )
            )

    return allowed_entries


def get_all_allowed_tables() -> list[AllowedTable]:
    """
    Get all tables that the current user has access to via Data Access Rules
    across all databases.

    This function is used for dataset filtering where we need to know all
    specific tables the user can access.

    Returns:
        List of AllowedTable objects representing allowed tables.
    """
    if not is_feature_enabled("DATA_ACCESS_RULES"):
        return []

    rules = get_user_rules()
    if not rules:
        return []

    allowed_tables: list[AllowedTable] = []

    for rule in rules:
        rule_dict = rule.rule_dict

        # Collect tables from allowed entries
        for entry in rule_dict.get("allowed", []):
            database = entry.get("database")
            if not database:
                continue

            table_name = entry.get("table")
            if not table_name:
                # Skip database-level or schema-level access for now
                # as we can't enumerate all tables without querying the DB
                continue

            allowed_tables.append(
                AllowedTable(
                    database=database,
                    table=table_name,
                    schema=entry.get("schema"),
                    catalog=entry.get("catalog"),
                )
            )

    return allowed_tables


def get_all_group_keys(
    database_name: str | None = None,
    table: Table | None = None,
) -> set[str]:
    """
    Get all distinct group_keys used in RLS rules.

    This is useful for UI discoverability - showing users what group_keys
    already exist so they can reuse them for consistent rule grouping.

    Args:
        database_name: Optional filter by database
        table: Optional Table object to filter by catalog/schema/table

    Returns:
        Set of unique group_key values.
    """
    from superset.data_access_rules.models import DataAccessRule

    query = db.session.query(DataAccessRule)
    rules = query.all()

    group_keys: set[str] = set()

    for rule in rules:
        rule_dict = rule.rule_dict

        for entry in rule_dict.get("allowed", []):
            # Apply filters if specified
            if database_name and entry.get("database") != database_name:
                continue
            if table is not None:
                if table.catalog and entry.get("catalog") != table.catalog:
                    continue
                if table.schema and entry.get("schema") != table.schema:
                    continue
                if table.table and entry.get("table") != table.table:
                    continue

            rls_config = entry.get("rls", {})
            if group_key := rls_config.get("group_key"):
                group_keys.add(group_key)

    return group_keys
