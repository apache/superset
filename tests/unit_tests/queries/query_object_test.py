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
from superset.superset_typing import Metric
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
        "grouping_sets": [],
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
        "time_compare_full_range": False,
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


def test_cache_key_stable_regardless_of_extra_cache_keys_order():
    """
    Regression for #34543: the cache key must not depend on the order of
    ``extra_cache_keys``.

    ``SqlaTable.get_extra_cache_keys`` (superset/connectors/sqla/models.py)
    returns ``list(set(extra_cache_keys))``. Python's string hashing is
    randomized per-process (``PYTHONHASHSEED``), so the same set of values
    can iterate in a different order in the Celery worker process (which
    writes the query results to cache) than in the web process (which
    re-derives the cache key to read them back). Because ``hash_from_dict``
    only sorts dict keys and not list values, two ``extra_cache_keys`` lists
    with identical Jinja ``url_param()`` values but different order hash to
    different cache keys, causing async chart-data lookups to 422 with
    "Error loading data from cache" whenever more than one url_param is
    referenced (a single-element list has only one possible order, which is
    why the bug is only visible with multiple parameters).
    """
    query_object1 = QueryObject(row_limit=1)
    query_object2 = QueryObject(row_limit=1)
    same_values_different_order = ["CAR_IDS=1,2,3", "CHASSIS_IDS=100,200"]
    cache_key1 = query_object1.cache_key(extra_cache_keys=same_values_different_order)
    cache_key2 = query_object2.cache_key(
        extra_cache_keys=list(reversed(same_values_different_order))
    )
    assert cache_key1 == cache_key2


def test_cache_key_stable_for_mixed_type_extra_cache_keys():
    """
    ``extra_cache_keys`` values are typed as ``Hashable``, so a mix of
    strings and non-strings that stringify identically (e.g. ``1`` and
    ``"1"``) can appear together. Sorting on a bare ``str()`` value treats
    those as equal keys, so Python's stable sort would fall back to
    whatever order they arrived in from ``list(set(...))`` -- which is not
    deterministic across processes. The sort key must also account for
    type so ordering doesn't silently regress to that non-determinism.
    """
    query_object1 = QueryObject(row_limit=1)
    query_object2 = QueryObject(row_limit=1)
    mixed_values = ["CAR_IDS=1,2,3", 1, "1", None]
    cache_key1 = query_object1.cache_key(extra_cache_keys=mixed_values)
    cache_key2 = query_object2.cache_key(extra_cache_keys=list(reversed(mixed_values)))
    assert cache_key1 == cache_key2


def test_cache_key_sensitive_to_orderby_order():
    """
    Negative control for the ``extra_cache_keys`` fix above: unlike that
    field, ``orderby`` is order-significant (it determines sort direction
    of the executed SQL), so the cache key must still change when the
    order of its entries changes. This guards against a fix that
    canonicalizes list values generically instead of targeting
    ``extra_cache_keys`` specifically.
    """
    metric_a: Metric = "count"
    metric_b: Metric = "sum__value"
    query_object1 = QueryObject(
        row_limit=1, orderby=[(metric_a, True), (metric_b, False)]
    )
    query_object2 = QueryObject(
        row_limit=1, orderby=[(metric_b, False), (metric_a, True)]
    )
    assert query_object1.cache_key() != query_object2.cache_key()


def test_cache_key_changes_for_new_query_object_same_params():
    """
    When a new query object is created with the same params,
    the cache key will be the same
    """
    query_object1 = QueryObject(row_limit=1)
    cache_key1 = query_object1.cache_key()
    query_object2 = QueryObject(row_limit=1)
    assert query_object2.cache_key() == cache_key1


@patch("superset.utils.cache_keys.feature_flag_manager")
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


@patch("superset.utils.cache_keys.feature_flag_manager")
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


@patch("superset.utils.cache_keys.feature_flag_manager")
@patch("superset.utils.cache_keys.logger")
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

    # Should have impersonation log emitted by the cache_keys helper
    logger_mock.debug.assert_has_calls(
        [
            call("Adding impersonation key to cache dict: %s", "test_user"),
        ],
        any_order=True,
    )


@patch("superset.utils.cache_keys.feature_flag_manager")
@patch("superset.utils.cache_keys.logger")
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

    # Should have impersonation logs emitted by the cache_keys helper
    logger_mock.debug.assert_has_calls(
        [
            call("Adding impersonation key to cache dict: %s", "test_user1"),
            call("Adding impersonation key to cache dict: %s", "test_user2"),
        ],
        any_order=True,
    )


@patch("superset.utils.cache_keys.feature_flag_manager")
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


@patch("superset.utils.cache_keys.feature_flag_manager")
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


@patch("superset.utils.cache_keys.feature_flag_manager")
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


@patch("superset.utils.cache_keys.feature_flag_manager")
@patch("superset.utils.cache_keys.logger")
def test_cache_key_cache_impersonation_on_with_different_user_and_db_impersonation(
    logger_mock,
    feature_flag_mock,
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

    # Should have impersonation logs emitted by the cache_keys helper
    logger_mock.debug.assert_has_calls(
        [
            call("Adding impersonation key to cache dict: %s", "test_user1"),
            call("Adding impersonation key to cache dict: %s", "test_user2"),
        ],
        any_order=True,
    )
