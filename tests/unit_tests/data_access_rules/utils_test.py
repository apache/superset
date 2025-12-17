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
Unit tests for Data Access Rules utility functions.
"""

from unittest.mock import MagicMock, patch

from superset.data_access_rules.models import DataAccessRule
from superset.data_access_rules.utils import (
    _is_more_specific,
    _matches_rule_entry,
    AccessCheckResult,
    check_table_access,
    get_all_group_keys,
    get_cls_rules_for_table,
    get_rls_predicates_for_table,
)
from superset.sql.parse import CLSAction, Table


# Tests for _matches_rule_entry
def test_matches_rule_entry_database_only():
    """Test matching when rule specifies only database."""
    entry = {"database": "mydb"}
    assert _matches_rule_entry(entry, "mydb", None, None, None) is True
    assert _matches_rule_entry(entry, "mydb", "catalog1", "schema1", "table1") is True
    assert _matches_rule_entry(entry, "otherdb", None, None, None) is False


def test_matches_rule_entry_database_and_catalog():
    """Test matching when rule specifies database and catalog."""
    entry = {"database": "mydb", "catalog": "cat1"}
    assert _matches_rule_entry(entry, "mydb", "cat1", None, None) is True
    assert _matches_rule_entry(entry, "mydb", "cat1", "schema1", "table1") is True
    assert _matches_rule_entry(entry, "mydb", "cat2", None, None) is False
    assert _matches_rule_entry(entry, "otherdb", "cat1", None, None) is False


def test_matches_rule_entry_database_and_schema():
    """Test matching when rule specifies database and schema (no catalog)."""
    entry = {"database": "mydb", "schema": "public"}
    assert _matches_rule_entry(entry, "mydb", None, "public", None) is True
    assert _matches_rule_entry(entry, "mydb", None, "public", "table1") is True
    assert _matches_rule_entry(entry, "mydb", None, "other", None) is False


def test_matches_rule_entry_full_table():
    """Test matching when rule specifies full table path."""
    entry = {"database": "mydb", "schema": "public", "table": "users"}
    assert _matches_rule_entry(entry, "mydb", None, "public", "users") is True
    assert _matches_rule_entry(entry, "mydb", None, "public", "orders") is False
    assert _matches_rule_entry(entry, "mydb", None, "other", "users") is False


def test_matches_rule_entry_with_catalog():
    """Test matching with catalog in the path."""
    entry = {
        "database": "mydb",
        "catalog": "main",
        "schema": "public",
        "table": "users",
    }
    assert _matches_rule_entry(entry, "mydb", "main", "public", "users") is True
    assert _matches_rule_entry(entry, "mydb", "other", "public", "users") is False


# Tests for _is_more_specific
def test_is_more_specific():
    """Test specificity comparison between entries."""
    db_only = {"database": "mydb"}
    db_schema = {"database": "mydb", "schema": "public"}
    db_table = {"database": "mydb", "schema": "public", "table": "users"}
    db_catalog = {"database": "mydb", "catalog": "main"}
    db_catalog_schema = {"database": "mydb", "catalog": "main", "schema": "public"}

    # More specific should win
    assert _is_more_specific(db_schema, db_only) is True
    assert _is_more_specific(db_table, db_schema) is True
    assert _is_more_specific(db_table, db_only) is True

    # Less specific should lose
    assert _is_more_specific(db_only, db_schema) is False
    assert _is_more_specific(db_schema, db_table) is False

    # Same specificity
    assert _is_more_specific(db_schema, db_catalog) is False
    assert _is_more_specific(db_catalog, db_schema) is False


# Tests for check_table_access
def test_check_table_access_no_rules():
    """Test access check when no rules are provided."""
    table = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table, rules=[])
    assert result.access == AccessCheckResult.NO_RULE
    assert result.rls_predicates == []
    assert result.cls_rules == {}


def test_check_table_access_allowed():
    """Test access check when table is allowed."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [{"database": "mydb", "schema": "public"}],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table, rules=[rule])
    assert result.access == AccessCheckResult.ALLOWED
    assert result.rls_predicates == []
    assert result.cls_rules == {}


def test_check_table_access_denied():
    """Test access check when table is denied."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [],
        "denied": [{"database": "mydb", "schema": "public"}],
    }

    table = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table, rules=[rule])
    assert result.access == AccessCheckResult.DENIED


def test_check_table_access_denied_more_specific():
    """Test that more specific deny wins over less specific allow."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [{"database": "mydb"}],  # Less specific
        "denied": [{"database": "mydb", "schema": "secret"}],  # More specific
    }

    # Table in non-denied schema should be allowed
    table_public = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table_public, rules=[rule])
    assert result.access == AccessCheckResult.ALLOWED

    # Table in denied schema should be denied
    table_secret = Table(table="data", schema="secret", catalog=None)
    result = check_table_access("mydb", table_secret, rules=[rule])
    assert result.access == AccessCheckResult.DENIED


def test_check_table_access_allowed_more_specific():
    """Test that more specific allow wins over less specific deny."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [{"database": "mydb", "schema": "public", "table": "users"}],
        "denied": [{"database": "mydb", "schema": "public"}],
    }

    # The specific table is allowed despite schema being denied
    table_users = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table_users, rules=[rule])
    assert result.access == AccessCheckResult.ALLOWED

    # Other tables in the schema are still denied
    table_orders = Table(table="orders", schema="public", catalog=None)
    result = check_table_access("mydb", table_orders, rules=[rule])
    assert result.access == AccessCheckResult.DENIED


def test_check_table_access_same_specificity_deny_wins():
    """Test that deny wins when rules have same specificity."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [{"database": "mydb", "schema": "public"}],
        "denied": [{"database": "mydb", "schema": "public"}],
    }

    table = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table, rules=[rule])
    assert result.access == AccessCheckResult.DENIED


def test_check_table_access_with_rls():
    """Test access check collects RLS predicates."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "table": "users",
                "rls": {"predicate": "org_id = 123", "group_key": "org"},
            }
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table, rules=[rule])
    assert result.access == AccessCheckResult.ALLOWED
    assert len(result.rls_predicates) == 1
    assert result.rls_predicates[0].predicate == "org_id = 123"
    assert result.rls_predicates[0].group_key == "org"


def test_check_table_access_multiple_rls():
    """Test access check collects multiple RLS predicates from different rules."""
    rule1 = MagicMock(spec=DataAccessRule)
    rule1.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "rls": {"predicate": "org_id = 123", "group_key": "org"},
            }
        ],
        "denied": [],
    }

    rule2 = MagicMock(spec=DataAccessRule)
    rule2.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "rls": {"predicate": "region = 'US'"},
            }
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table, rules=[rule1, rule2])
    assert result.access == AccessCheckResult.ALLOWED
    assert len(result.rls_predicates) == 2

    predicates = [p.predicate for p in result.rls_predicates]
    assert "org_id = 123" in predicates
    assert "region = 'US'" in predicates


def test_check_table_access_with_cls():
    """Test access check collects CLS rules."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "table": "users",
                "cls": {"email": "mask", "ssn": "hide", "name": "hash"},
            }
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table, rules=[rule])
    assert result.access == AccessCheckResult.ALLOWED
    assert result.cls_rules == {
        "email": CLSAction.MASK,
        "ssn": CLSAction.HIDE,
        "name": CLSAction.HASH,
    }


def test_check_table_access_cls_strictest_wins():
    """Test that strictest CLS action wins when multiple rules apply."""
    rule1 = MagicMock(spec=DataAccessRule)
    rule1.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "cls": {"email": "mask"},  # Less strict
            }
        ],
        "denied": [],
    }

    rule2 = MagicMock(spec=DataAccessRule)
    rule2.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "cls": {"email": "hide"},  # More strict - should win
            }
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)
    result = check_table_access("mydb", table, rules=[rule1, rule2])
    assert result.access == AccessCheckResult.ALLOWED
    assert result.cls_rules["email"] == CLSAction.HIDE


# Tests for get_rls_predicates_for_table
def test_get_rls_predicates_for_table_no_predicates():
    """Test getting RLS predicates when there are none."""
    database = MagicMock()
    database.database_name = "mydb"
    table = Table(table="users", schema="public", catalog=None)

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [{"database": "mydb", "schema": "public"}],
        "denied": [],
    }

    predicates = get_rls_predicates_for_table(table, database, rules=[rule])
    assert predicates == []


def test_get_rls_predicates_for_table_with_predicates():
    """Test getting RLS predicates."""
    database = MagicMock()
    database.database_name = "mydb"
    table = Table(table="users", schema="public", catalog=None)

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "rls": {"predicate": "org_id = 123"},
            }
        ],
        "denied": [],
    }

    predicates = get_rls_predicates_for_table(table, database, rules=[rule])
    assert predicates == ["(org_id = 123)"]


def test_get_rls_predicates_for_table_with_group_key():
    """Test getting RLS predicates with group_key combines with OR."""
    database = MagicMock()
    database.database_name = "mydb"
    table = Table(table="users", schema="public", catalog=None)

    rule1 = MagicMock(spec=DataAccessRule)
    rule1.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "rls": {"predicate": "org_id = 1", "group_key": "org"},
            }
        ],
        "denied": [],
    }

    rule2 = MagicMock(spec=DataAccessRule)
    rule2.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "rls": {"predicate": "org_id = 2", "group_key": "org"},
            }
        ],
        "denied": [],
    }

    predicates = get_rls_predicates_for_table(table, database, rules=[rule1, rule2])
    # Same group_key predicates should be ORed
    assert len(predicates) == 1
    assert "(org_id = 1)" in predicates[0]
    assert "(org_id = 2)" in predicates[0]
    assert " OR " in predicates[0]


def test_get_rls_predicates_for_table_mixed_group_keys():
    """Test getting RLS predicates with mixed group_keys."""
    database = MagicMock()
    database.database_name = "mydb"
    table = Table(table="users", schema="public", catalog=None)

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "rls": {"predicate": "org_id = 1", "group_key": "org"},
            },
            {
                "database": "mydb",
                "schema": "public",
                "rls": {"predicate": "org_id = 2", "group_key": "org"},
            },
            {
                "database": "mydb",
                "schema": "public",
                "rls": {"predicate": "region = 'US'"},  # No group_key
            },
        ],
        "denied": [],
    }

    predicates = get_rls_predicates_for_table(table, database, rules=[rule])
    # Should have: ungrouped predicate + ORed group predicate = 2 items
    assert len(predicates) == 2

    has_region = any("region = 'US'" in p for p in predicates)
    has_org_group = any("org_id = 1" in p and "org_id = 2" in p for p in predicates)
    assert has_region
    assert has_org_group


# Tests for get_cls_rules_for_table
def test_get_cls_rules_for_table_no_rules():
    """Test getting CLS rules when there are none."""
    database = MagicMock()
    database.database_name = "mydb"
    table = Table(table="users", schema="public", catalog=None)

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [{"database": "mydb", "schema": "public"}],
        "denied": [],
    }

    cls_rules = get_cls_rules_for_table(table, database, rules=[rule])
    assert cls_rules == {}


def test_get_cls_rules_for_table_with_rules():
    """Test getting CLS rules."""
    database = MagicMock()
    database.database_name = "mydb"
    table = Table(table="users", schema="public", catalog=None)

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "table": "users",
                "cls": {"email": "mask", "ssn": "hide"},
            }
        ],
        "denied": [],
    }

    cls_rules = get_cls_rules_for_table(table, database, rules=[rule])
    assert cls_rules == {"email": CLSAction.MASK, "ssn": CLSAction.HIDE}


# Tests for get_all_group_keys
def test_get_all_group_keys_empty(app_context: None):
    """Test getting group keys when none exist."""
    with patch("superset.data_access_rules.utils.db") as mock_db:
        mock_db.session.query.return_value.all.return_value = []
        keys = get_all_group_keys()
        assert keys == set()


def test_get_all_group_keys_with_keys(app_context: None):
    """Test getting group keys from rules."""
    rule1 = MagicMock(spec=DataAccessRule)
    rule1.rule_dict = {
        "allowed": [
            {"database": "mydb", "rls": {"predicate": "x=1", "group_key": "key1"}},
            {"database": "mydb", "rls": {"predicate": "x=2", "group_key": "key2"}},
        ],
        "denied": [],
    }

    rule2 = MagicMock(spec=DataAccessRule)
    rule2.rule_dict = {
        "allowed": [
            {"database": "mydb", "rls": {"predicate": "x=3", "group_key": "key1"}},
            {"database": "mydb", "rls": {"predicate": "x=4"}},  # No group_key
        ],
        "denied": [],
    }

    with patch("superset.data_access_rules.utils.db") as mock_db:
        mock_db.session.query.return_value.all.return_value = [rule1, rule2]
        keys = get_all_group_keys()
        assert keys == {"key1", "key2"}


def test_get_all_group_keys_filtered_by_database(app_context: None):
    """Test getting group keys filtered by database."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {"database": "db1", "rls": {"predicate": "x=1", "group_key": "key1"}},
            {"database": "db2", "rls": {"predicate": "x=2", "group_key": "key2"}},
        ],
        "denied": [],
    }

    with patch("superset.data_access_rules.utils.db") as mock_db:
        mock_db.session.query.return_value.all.return_value = [rule]
        keys = get_all_group_keys(database_name="db1")
        assert keys == {"key1"}


def test_get_all_group_keys_filtered_by_table(app_context: None):
    """Test getting group keys filtered by table."""
    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "db1",
                "schema": "public",
                "table": "users",
                "rls": {"predicate": "x=1", "group_key": "key1"},
            },
            {
                "database": "db1",
                "schema": "public",
                "table": "orders",
                "rls": {"predicate": "x=2", "group_key": "key2"},
            },
        ],
        "denied": [],
    }

    with patch("superset.data_access_rules.utils.db") as mock_db:
        mock_db.session.query.return_value.all.return_value = [rule]
        table = Table(table="users", schema="public", catalog=None)
        keys = get_all_group_keys(database_name="db1", table=table)
        assert keys == {"key1"}


# Tests for get_hidden_columns_for_table
def test_get_hidden_columns_for_table_no_hidden(app_context: None):
    """Test getting hidden columns when no columns are hidden."""
    from superset.data_access_rules.utils import get_hidden_columns_for_table

    database = MagicMock()
    database.database_name = "mydb"

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "table": "users",
                "cls": {"email": "mask", "phone": "hash"},  # No "hide" actions
            }
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)
    hidden = get_hidden_columns_for_table(table, database, rules=[rule])
    assert hidden == set()


def test_get_hidden_columns_for_table_with_hidden(app_context: None):
    """Test getting hidden columns when some columns are hidden."""
    from superset.data_access_rules.utils import get_hidden_columns_for_table

    database = MagicMock()
    database.database_name = "mydb"

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "table": "users",
                "cls": {"email": "mask", "ssn": "hide", "password": "hide"},
            }
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)
    hidden = get_hidden_columns_for_table(table, database, rules=[rule])
    assert hidden == {"ssn", "password"}


def test_get_hidden_columns_for_table_denied_access(app_context: None):
    """Test that denied access returns no hidden columns."""
    from superset.data_access_rules.utils import get_hidden_columns_for_table

    database = MagicMock()
    database.database_name = "mydb"

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [],
        "denied": [
            {
                "database": "mydb",
                "schema": "public",
                "table": "users",
            }
        ],
    }

    table = Table(table="users", schema="public", catalog=None)
    hidden = get_hidden_columns_for_table(table, database, rules=[rule])
    # Denied access means no CLS rules are returned
    assert hidden == set()


# Tests for filter_columns_by_cls
def test_filter_columns_by_cls_no_hidden(app_context: None):
    """Test filtering columns when no columns are hidden."""
    from superset.data_access_rules.utils import filter_columns_by_cls

    database = MagicMock()
    database.database_name = "mydb"

    columns = [
        {"column_name": "id", "type": "INTEGER"},
        {"column_name": "name", "type": "VARCHAR"},
        {"column_name": "email", "type": "VARCHAR"},
    ]

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {"database": "mydb", "schema": "public", "table": "users"}
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)

    with patch(
        "superset.data_access_rules.utils.is_feature_enabled",
        return_value=True,
    ):
        with patch(
            "superset.data_access_rules.utils.get_user_rules",
            return_value=[rule],
        ):
            filtered = filter_columns_by_cls(columns, table, database)
            assert len(filtered) == 3
            assert filtered == columns


def test_filter_columns_by_cls_with_hidden(app_context: None):
    """Test filtering columns when some columns are hidden."""
    from superset.data_access_rules.utils import filter_columns_by_cls

    database = MagicMock()
    database.database_name = "mydb"

    columns = [
        {"column_name": "id", "type": "INTEGER"},
        {"column_name": "name", "type": "VARCHAR"},
        {"column_name": "email", "type": "VARCHAR"},
        {"column_name": "ssn", "type": "VARCHAR"},
    ]

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "table": "users",
                "cls": {"ssn": "hide"},
            }
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)

    with patch(
        "superset.data_access_rules.utils.is_feature_enabled",
        return_value=True,
    ):
        with patch(
            "superset.data_access_rules.utils.get_user_rules",
            return_value=[rule],
        ):
            filtered = filter_columns_by_cls(columns, table, database)
            assert len(filtered) == 3
            column_names = [c["column_name"] for c in filtered]
            assert "ssn" not in column_names
            assert "id" in column_names
            assert "name" in column_names
            assert "email" in column_names


def test_filter_columns_by_cls_feature_disabled(app_context: None):
    """Test that filtering is skipped when feature flag is disabled."""
    from superset.data_access_rules.utils import filter_columns_by_cls

    database = MagicMock()
    database.database_name = "mydb"

    columns = [
        {"column_name": "id", "type": "INTEGER"},
        {"column_name": "ssn", "type": "VARCHAR"},
    ]

    table = Table(table="users", schema="public", catalog=None)

    with patch(
        "superset.data_access_rules.utils.is_feature_enabled",
        return_value=False,
    ):
        # Even if there would be hidden columns, they are not filtered
        filtered = filter_columns_by_cls(columns, table, database)
        assert len(filtered) == 2
        assert filtered == columns


def test_filter_columns_by_cls_custom_key(app_context: None):
    """Test filtering columns with custom column name key."""
    from superset.data_access_rules.utils import filter_columns_by_cls

    database = MagicMock()
    database.database_name = "mydb"

    # Columns with different key structure (like from SQL Lab table metadata)
    columns = [
        {"name": "id", "type": "INTEGER"},
        {"name": "ssn", "type": "VARCHAR"},
    ]

    rule = MagicMock(spec=DataAccessRule)
    rule.rule_dict = {
        "allowed": [
            {
                "database": "mydb",
                "schema": "public",
                "table": "users",
                "cls": {"ssn": "hide"},
            }
        ],
        "denied": [],
    }

    table = Table(table="users", schema="public", catalog=None)

    with patch(
        "superset.data_access_rules.utils.is_feature_enabled",
        return_value=True,
    ):
        with patch(
            "superset.data_access_rules.utils.get_user_rules",
            return_value=[rule],
        ):
            filtered = filter_columns_by_cls(
                columns, table, database, column_name_key="name"
            )
            assert len(filtered) == 1
            assert filtered[0]["name"] == "id"
