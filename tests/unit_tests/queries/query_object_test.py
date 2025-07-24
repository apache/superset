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
        "inner_from_dttm": None,
        "inner_to_dttm": None,
        "is_rowcount": False,
        "is_timeseries": False,
        "metrics": None,
        "order_desc": True,
        "orderby": [],
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
    logger_mock.debug.assert_not_called()


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_query_by_user_on_with_user(logger_mock, feature_flag_mock):
    """
    When the same user is requesting a cache key with CACHE_QUERY_BY_USER
    flag on, the key will be the same
    """

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

    logger_mock.debug.assert_called_with(
        "Adding impersonation key to QueryObject cache dict: %s", "test_user"
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

    logger_mock.debug.assert_has_calls(
        [
            call(
                "Adding impersonation key to QueryObject cache dict: %s", "test_user1"
            ),
            call(
                "Adding impersonation key to QueryObject cache dict: %s", "test_user2"
            ),
        ]
    )


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_impersonation_on_no_user(logger_mock, feature_flag_mock):
    """
    When CACHE_IMPERSONATION flag is on and there is no user,
    cache key will be the same
    """

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
    logger_mock.debug.assert_not_called()


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_impersonation_on_with_user(logger_mock, feature_flag_mock):
    """
    When the same user is requesting a cache key with CACHE_IMPERSONATION
    flag on, the key will be the same
    """

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

    logger_mock.debug.assert_not_called()


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

    logger_mock.debug.assert_not_called()


@patch("superset.common.query_object.feature_flag_manager")
@patch("superset.common.query_object.logger")
def test_cache_key_cache_impersonation_on_with_different_user_and_db_impersonation(
    logger_mock, feature_flag_mock
):
    """
    When two different users are requesting a cache key with CACHE_IMPERSONATION
    flag on, and cache_impersonation is enabled on the database,
    the keys will be different
    """

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

    logger_mock.debug.assert_has_calls(
        [
            call(
                "Adding impersonation key to QueryObject cache dict: %s", "test_user1"
            ),
            call(
                "Adding impersonation key to QueryObject cache dict: %s", "test_user2"
            ),
        ]
    )
