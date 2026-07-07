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
Behavioral tests for ``viz.BaseViz.cache_key`` covering per-user cache-key
inclusion.
"""

from typing import Any
from unittest.mock import patch

from flask_appbuilder.security.sqla.models import User

from superset import viz
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.utils.core import override_user

QUERY_OBJ: dict[str, Any] = {"row_limit": 100, "from_dttm": None, "to_dttm": None}


def _viz_for(database: Database) -> viz.BaseViz:
    datasource = SqlaTable(
        table_name="t",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=database,
    )
    return viz.BaseViz(datasource=datasource, form_data={"viz_type": "table"})


def test_no_per_user_opt_in_keys_match_across_users():
    """
    Without any per-user caching opt-in, two different users on the same
    database/query must produce the *same* cache key (regression guard — we
    must not accidentally make every cache key per-user).
    """
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    obj = _viz_for(database)

    with override_user(User(username="alice")):
        key_a = obj.cache_key(QUERY_OBJ)
    with override_user(User(username="bob")):
        key_b = obj.cache_key(QUERY_OBJ)

    assert key_a == key_b


def test_per_user_caching_in_extra_yields_distinct_keys_per_user():
    """
    With ``per_user_caching: true`` set on the database, two different users
    must produce *different* cache keys for the same query.
    """
    database = Database(
        database_name="d",
        sqlalchemy_uri="sqlite://",
        extra='{"per_user_caching": true}',
    )
    obj = _viz_for(database)

    with override_user(User(username="alice")):
        key_a = obj.cache_key(QUERY_OBJ)
    with override_user(User(username="bob")):
        key_b = obj.cache_key(QUERY_OBJ)

    assert key_a != key_b


def test_same_user_same_query_idempotent():
    database = Database(
        database_name="d",
        sqlalchemy_uri="sqlite://",
        extra='{"per_user_caching": true}',
    )
    obj = _viz_for(database)

    with override_user(User(username="alice")):
        assert obj.cache_key(QUERY_OBJ) == obj.cache_key(QUERY_OBJ)


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_cache_query_by_user_flag_yields_distinct_keys(feature_flag_mock):
    """
    Global ``CACHE_QUERY_BY_USER`` flag also reaches the legacy viz path.
    """
    feature_flag_mock.is_feature_enabled.side_effect = (
        lambda feature=None: feature == "CACHE_QUERY_BY_USER"
    )
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    obj = _viz_for(database)

    with override_user(User(username="alice")):
        key_a = obj.cache_key(QUERY_OBJ)
    with override_user(User(username="bob")):
        key_b = obj.cache_key(QUERY_OBJ)

    assert key_a != key_b
