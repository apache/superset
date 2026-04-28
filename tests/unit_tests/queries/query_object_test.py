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
import copy
from unittest.mock import call, patch

from flask_appbuilder.security.sqla.models import User

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.utils.core import override_user


def cache_impersonation_flag_side_effect(feature=None):
    return feature == "CACHE_IMPERSONATION"


def cache_query_by_user_flag_side_effect(feature=None):
    return feature == "CACHE_QUERY_BY_USER"


def test_default_query_object_to_dict():
    """
    Simple test to check default QueryObject values
    """
    query_object = QueryObject(row_limit=1)
    assert query_object.to_dict() == {
        "apply_fetch_values_predicate": False,
        "columns": [],
        "extras": {},
        "filter": [],
        "from_dttm": None,
        "granularity": None,
        "group_others_when_limit_reached": False,
        "inner_from_dttm": None,
        "inner_to_dttm": None,
        "is_rowcount": False,
        "is_timeseries": False,
        "metrics": None,
        "order_desc": True,
        "orderby": [],
        "post_processing": [],
        "row_limit": 1,
        "row_offset": 0,
        "series_columns": [],
        "series_limit": 0,
        "series_limit_metric": None,
        "time_shift": None,
        "to_dttm": None,
    }


def test_cache_key_consistent_for_query_object():
    """
    When the same query is object is used, the
    cache key will be the same
    """
    query_object = QueryObject(row_limit=1)
    cache_key = query_object.cache_key()
    assert query_object.cache_key() == cache_key


def test_cache_key_changes_for_new_query_object_different_params():
    """
    When a new query object is created with different params,
    the cache key will be different
    """
    query_object1 = QueryObject(row_limit=1)
    cache_key1 = query_object1.cache_key()
    query_object2 = QueryObject(row_limit=2)
    assert query_object2.cache_key() != cache_key1


def test_cache_key_changes_for_new_query_object_same_params():
    """
    When a new query object is created with the same params,
    the cache key will be the same
    """
    query_object1 = QueryObject(row_limit=1)
    cache_key1 = query_object1.cache_key()
    query_object2 = QueryObject(row_limit=1)
    assert query_object2.cache_key() == cache_key1


@patch("superset.common.query_object.feature_flag_manager")
def test_cache_key_cache_query_by_user_on_no_datasource(feature_flag_mock):
    """
    When CACHE_QUERY_BY_USER flag is on and there is no datasource,
    cache key will be the same
    """

    def feature_flag_side_effect(feature=None):
        if feature == "CACHE_QUERY_BY_USER":
            return True

    feature_flag_mock.is_feature_enabled.side_effect = feature_flag_side_effect
    query_object = QueryObject(row_limit=1)
    cache_key = query_object.cache_key()
    assert query_object.cache_key() == cache_key


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_query_by_user_on_no_user(logger_mock, feature_flag_mock):
    """
    When CACHE_QUERY_BY_USER flag is on and there is no user,
    cache key will be the same
    """
    # Configure logger to enable DEBUG level for isEnabledFor check
    logger_mock.isEnabledFor.return_value = True

    datasource = SqlaTable(
        table_name="test_table",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )

    feature_flag_mock.is_feature_enabled.side_effect = (
        cache_query_by_user_flag_side_effect
    )
    query_object = QueryObject(row_limit=1, datasource=datasource)
    cache_key = query_object.cache_key()
    assert query_object.cache_key() == cache_key
    # Should have cache key generation log
    logger_mock.debug.assert_called()


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_query_by_user_on_with_user(logger_mock, feature_flag_mock):
    """
    When the same user is requesting a cache key with CACHE_QUERY_BY_USER
    flag on, the key will be the same
    """
    # Configure logger to enable DEBUG level for isEnabledFor check
    logger_mock.isEnabledFor.return_value = True

    datasource = SqlaTable(
        table_name="test_table",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )

    feature_flag_mock.is_feature_enabled.side_effect = (
        cache_query_by_user_flag_side_effect
    )
    query_object = QueryObject(row_limit=1, datasource=datasource)

    with override_user(User(username="test_user")):
        cache_key1 = query_object.cache_key()
        assert query_object.cache_key() == cache_key1

    # Should have both impersonation and cache key generation logs
    logger_mock.debug.assert_has_calls(
        [
            call("Adding impersonation key to QueryObject cache dict: %s", "test_user"),
        ],
        any_order=True,
    )


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_query_by_user_on_with_different_user(
    logger_mock, feature_flag_mock
):
    """
    When two different users are requesting a cache key with CACHE_QUERY_BY_USER
    flag on, the key will be different
    """
    # Configure logger to enable DEBUG level for isEnabledFor check
    logger_mock.isEnabledFor.return_value = True

    datasource = SqlaTable(
        table_name="test_table",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )

    feature_flag_mock.is_feature_enabled.side_effect = (
        cache_query_by_user_flag_side_effect
    )
    query_object = QueryObject(row_limit=1, datasource=datasource)

    with override_user(User(username="test_user1")):
        cache_key1 = query_object.cache_key()

    with override_user(User(username="test_user2")):
        cache_key2 = query_object.cache_key()

    assert cache_key1 != cache_key2

    # Should have both impersonation and cache key generation logs (any order)
    logger_mock.debug.assert_has_calls(
        [
            call(
                "Adding impersonation key to QueryObject cache dict: %s", "test_user1"
            ),
            call(
                "Adding impersonation key to QueryObject cache dict: %s", "test_user2"
            ),
        ],
        any_order=True,
    )


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_impersonation_on_no_user(logger_mock, feature_flag_mock):
    """
    When CACHE_IMPERSONATION flag is on and there is no user,
    cache key will be the same
    """
    # Configure logger to enable DEBUG level for isEnabledFor check
    logger_mock.isEnabledFor.return_value = True

    datasource = SqlaTable(
        table_name="test_table",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )

    feature_flag_mock.is_feature_enabled.side_effect = (
        cache_impersonation_flag_side_effect
    )
    query_object = QueryObject(row_limit=1, datasource=datasource)
    cache_key = query_object.cache_key()
    assert query_object.cache_key() == cache_key
    # Should have cache key generation log
    logger_mock.debug.assert_called()


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_impersonation_on_with_user(logger_mock, feature_flag_mock):
    """
    When the same user is requesting a cache key with CACHE_IMPERSONATION
    flag on, but the cache_impersonation is not enabled on the database,
    the key will be the same and no impersonation logging should occur
    """
    # Configure logger to enable DEBUG level for isEnabledFor check
    logger_mock.isEnabledFor.return_value = True

    datasource = SqlaTable(
        table_name="test_table",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )

    feature_flag_mock.is_feature_enabled.side_effect = (
        cache_impersonation_flag_side_effect
    )
    query_object = QueryObject(row_limit=1, datasource=datasource)

    with override_user(User(username="test_user")):
        cache_key1 = query_object.cache_key()
        assert query_object.cache_key() == cache_key1

    # Should have cache key generation log
    logger_mock.debug.assert_called()
    # But no impersonation key should be added without database impersonation enabled
    impersonation_calls = [
        call
        for call in logger_mock.debug.call_args_list
        if "Adding impersonation key" in str(call)
    ]
    assert len(impersonation_calls) == 0


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_impersonation_on_with_different_user(
    logger_mock, feature_flag_mock
):
    """
    When two different users are requesting a cache key with CACHE_IMPERSONATION
    flag on, but the cache_impersonation is not enabled on the database,
    the keys will be the same
    """
    # Configure logger to enable DEBUG level for isEnabledFor check
    logger_mock.isEnabledFor.return_value = True

    datasource = SqlaTable(
        table_name="test_table",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )

    feature_flag_mock.is_feature_enabled.side_effect = (
        cache_impersonation_flag_side_effect
    )
    query_object = QueryObject(row_limit=1, datasource=datasource)

    with override_user(User(username="test_user1")):
        cache_key1 = query_object.cache_key()

    with override_user(User(username="test_user2")):
        cache_key2 = query_object.cache_key()

    assert cache_key1 == cache_key2

    # Should have cache key generation log
    logger_mock.debug.assert_called()
    # But no impersonation key should be added without database impersonation enabled
    impersonation_calls = [
        call
        for call in logger_mock.debug.call_args_list
        if "Adding impersonation key" in str(call)
    ]
    assert len(impersonation_calls) == 0


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_impersonation_on_with_different_user_and_db_impersonation(
    logger_mock,
    feature_flag_mock,
):
    """
    When two different users are requesting a cache key with CACHE_IMPERSONATION
    flag on, and cache_impersonation is enabled on the database,
    the keys will be different
    """
    # Configure logger to enable DEBUG level for isEnabledFor check
    logger_mock.isEnabledFor.return_value = True

    datasource = SqlaTable(
        table_name="test_table",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=Database(
            database_name="my_database",
            sqlalchemy_uri="sqlite://",
            impersonate_user=True,
        ),
    )

    feature_flag_mock.is_feature_enabled.side_effect = (
        cache_impersonation_flag_side_effect
    )
    query_object = QueryObject(row_limit=1, datasource=datasource)

    with override_user(User(username="test_user1")):
        cache_key1 = query_object.cache_key()

    with override_user(User(username="test_user2")):
        cache_key2 = query_object.cache_key()

    assert cache_key1 != cache_key2

    # Should have both impersonation and cache key generation logs (any order)
    logger_mock.debug.assert_has_calls(
        [
            call(
                "Adding impersonation key to QueryObject cache dict: %s", "test_user1"
            ),
            call(
                "Adding impersonation key to QueryObject cache dict: %s", "test_user2"
            ),
        ],
        any_order=True,
    )


def test_cache_key_normalization_metrics_crlf():
    """Verify CRLF vs LF parity in Metrics"""
    metric_crlf = {
        "expressionType": "SQL",
        "sqlExpression": "SELECT *\r\nFROM table\r\nWHERE x = 1",
    }
    metric_lf = {
        "expressionType": "SQL",
        "sqlExpression": "SELECT *\nFROM table\nWHERE x = 1",
    }

    qo_crlf = QueryObject(metrics=[metric_crlf])
    qo_lf = QueryObject(metrics=[metric_lf])

    assert qo_crlf.cache_key() == qo_lf.cache_key()


def test_cache_key_normalization_columns_crlf():
    """Verify CRLF vs LF parity in Columns"""
    column_crlf = {
        "expressionType": "SQL",
        "sqlExpression": "CASE WHEN x THEN 1\r\nELSE 0 END",
    }
    column_lf = {
        "expressionType": "SQL",
        "sqlExpression": "CASE WHEN x THEN 1\nELSE 0 END",
    }

    qo_crlf = QueryObject(columns=[column_crlf])
    qo_lf = QueryObject(columns=[column_lf])

    assert qo_crlf.cache_key() == qo_lf.cache_key()


def test_cache_key_normalization_whitespace():
    """Verify whitespace stripping in SQL expressions"""
    metric_space = {"expressionType": "SQL", "sqlExpression": "  SELECT * FROM table  "}
    metric_no_space = {"expressionType": "SQL", "sqlExpression": "SELECT * FROM table"}

    qo_space = QueryObject(metrics=[metric_space])
    qo_no_space = QueryObject(metrics=[metric_no_space])

    assert qo_space.cache_key() == qo_no_space.cache_key()


def test_cache_key_normalization_orderby_defensive():
    """Verify defensive normalization of OrderBy structures"""
    metric_sql = {"expressionType": "SQL", "sqlExpression": "col\r\n"}
    # Standard orderby structure: [(metric_dict, ascend_bool)]
    qo1 = QueryObject(orderby=[(metric_sql, True)])

    metric_sql_clean = {"expressionType": "SQL", "sqlExpression": "col"}
    qo2 = QueryObject(orderby=[(metric_sql_clean, True)])

    assert qo1.cache_key() == qo2.cache_key()


def test_cache_key_no_side_effects():
    """Verify that cache_key generation does not mutate the original object"""
    metric_sql = {"expressionType": "SQL", "sqlExpression": "SELECT *\r\nFROM table "}
    qo = QueryObject(metrics=[metric_sql])
    original_dict = copy.deepcopy(qo.to_dict())

    # Generate cache key multiple times
    key1 = qo.cache_key()
    key2 = qo.cache_key()

    assert key1 == key2
    # Ensure original object is not mutated
    assert qo.to_dict() == original_dict
    assert qo.metrics[0]["sqlExpression"] == "SELECT *\r\nFROM table "


def test_cache_key_non_sql_metrics_unchanged():
    """Verify that non-SQL metrics are handled without modification"""
    metrics = ["count", {"expressionType": "SIMPLE", "column": {"column_name": "x"}}]
    qo = QueryObject(metrics=metrics)
    # Should not crash and should work normally
    key = qo.cache_key()
    assert key is not None


def test_cache_key_mixed_metrics():
    """Verify that mixed metrics (names and ad-hoc SQL) are handled correctly"""
    metric_sql = {"expressionType": "SQL", "sqlExpression": "SELECT 1\r\n"}
    metric_name = "count"
    qo = QueryObject(metrics=[metric_sql, metric_name])

    # Normalization should happen for the SQL one
    key1 = qo.cache_key()

    metric_sql_clean = {"expressionType": "SQL", "sqlExpression": "SELECT 1"}
    qo_clean = QueryObject(metrics=[metric_sql_clean, metric_name])
    key2 = qo_clean.cache_key()

    assert key1 == key2


def test_cache_key_normalization_mixed_newlines():
    """Verify that expressions with mixed \\r\\n and \\n are unified"""
    metric_mixed = {
        "expressionType": "SQL",
        "sqlExpression": "SELECT 1\r\nFROM t\nWHERE 1=1\r\n",
    }
    metric_clean = {
        "expressionType": "SQL",
        "sqlExpression": "SELECT 1\nFROM t\nWHERE 1=1",
    }

    qo_mixed = QueryObject(metrics=[metric_mixed])
    qo_clean = QueryObject(metrics=[metric_clean])

    assert qo_mixed.cache_key() == qo_clean.cache_key()


def test_cache_key_orderby_malformed_defensive():
    """Verify that malformed OrderBy structures do not cause crashes"""
    qo = QueryObject(
        orderby=[None, ("not_a_dict", True), ({"no_expression_type": "x"}, False)]
    )
    key = qo.cache_key()
    assert key is not None
