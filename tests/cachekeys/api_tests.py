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
# isort:skip_file
"""Unit tests for Superset"""
from typing import Dict, Any

from tests.test_app import app  # noqa

from superset.extensions import cache_manager, db
from superset.models.cache import CacheKey
from tests.base_tests import (
    SupersetTestCase,
    post_assert_metric,
    test_client,
    logged_in_admin,
)  # noqa


def invalidate(params: Dict[str, Any]):
    return post_assert_metric(
        test_client, "api/v1/cachekey/invalidate", params, "invalidate"
    )


def test_invalidate_cache(logged_in_admin):
    rv = invalidate({"datasource_uids": ["3__table"]})
    assert rv.status_code == 201


def test_invalidate_existing_cache(logged_in_admin):
    db.session.add(CacheKey(cache_key="cache_key", datasource_uid="3__table"))
    db.session.commit()
    cache_manager.cache.set("cache_key", "value")

    rv = invalidate({"datasource_uids": ["3__table"]})

    assert rv.status_code == 201
    assert cache_manager.cache.get("cache_key") == None
    assert (
        not db.session.query(CacheKey).filter(CacheKey.cache_key == "cache_key").first()
    )


def test_invalidate_cache_empty_input(logged_in_admin):
    rv = invalidate({"datasource_uids": []})
    assert rv.status_code == 201

    rv = invalidate({"datasources": []})
    assert rv.status_code == 201

    rv = invalidate({"datasource_uids": [], "datasources": []})
    assert rv.status_code == 201


def test_invalidate_cache_bad_request(logged_in_admin):
    rv = invalidate(
        {
            "datasource_uids": [],
            "datasources": [{"datasource_name": "", "datasource_type": None}],
        }
    )
    assert rv.status_code == 400

    rv = invalidate(
        {
            "datasource_uids": [],
            "datasources": [{"datasource_name": "", "datasource_type": "bla"}],
        }
    )
    assert rv.status_code == 400

    rv = invalidate(
        {
            "datasource_uids": "datasource",
            "datasources": [{"datasource_name": "", "datasource_type": "bla"}],
        }
    )
    assert rv.status_code == 400


def test_invalidate_existing_caches(logged_in_admin):
    bn = SupersetTestCase.get_birth_names_dataset()

    db.session.add(CacheKey(cache_key="cache_key1", datasource_uid="3__druid"))
    db.session.add(CacheKey(cache_key="cache_key2", datasource_uid="3__druid"))
    db.session.add(CacheKey(cache_key="cache_key4", datasource_uid=f"{bn.id}__table"))
    db.session.add(CacheKey(cache_key="cache_keyX", datasource_uid="X__table"))
    db.session.commit()

    cache_manager.cache.set("cache_key1", "value")
    cache_manager.cache.set("cache_key2", "value")
    cache_manager.cache.set("cache_key4", "value")
    cache_manager.cache.set("cache_keyX", "value")

    rv = invalidate(
        {
            "datasource_uids": ["3__druid", "4__druid"],
            "datasources": [
                {
                    "datasource_name": "birth_names",
                    "database_name": "examples",
                    "schema": "",
                    "datasource_type": "table",
                },
                {  # table exists, no cache to invalidate
                    "datasource_name": "energy_usage",
                    "database_name": "examples",
                    "schema": "",
                    "datasource_type": "table",
                },
                {  # table doesn't exist
                    "datasource_name": "does_not_exist",
                    "database_name": "examples",
                    "schema": "",
                    "datasource_type": "table",
                },
                {  # database doesn't exist
                    "datasource_name": "birth_names",
                    "database_name": "does_not_exist",
                    "schema": "",
                    "datasource_type": "table",
                },
                {  # database doesn't exist
                    "datasource_name": "birth_names",
                    "database_name": "examples",
                    "schema": "does_not_exist",
                    "datasource_type": "table",
                },
            ],
        }
    )

    assert rv.status_code == 201
    assert cache_manager.cache.get("cache_key1") is None
    assert cache_manager.cache.get("cache_key2") is None
    assert cache_manager.cache.get("cache_key4") is None
    assert cache_manager.cache.get("cache_keyX") == "value"
    assert (
        not db.session.query(CacheKey)
        .filter(CacheKey.cache_key.in_({"cache_key1", "cache_key2", "cache_key4"}))
        .first()
    )
    assert (
        db.session.query(CacheKey)
        .filter(CacheKey.cache_key == "cache_keyX")
        .first()
        .datasource_uid
        == "X__table"
    )
