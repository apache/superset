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
"""The warm-up cache lookup must use the same key as request-time execution."""

from typing import Any
from unittest.mock import MagicMock, patch

from superset.commands.chart.warm_up_cache import ChartWarmUpCacheCommand
from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject


def _query_context(
    time_range: str = "Last week", database_extra: str = "{}"
) -> MagicMock:
    datasource = MagicMock()
    datasource.database.extra = database_extra
    datasource.database.impersonate_user = False
    datasource.uid = "1__table"
    datasource.changed_on = None
    datasource.get_extra_cache_keys.return_value = []
    datasource.column_names = ["a"]
    query = QueryObject(
        datasource=datasource,
        columns=["a"],
        metrics=["count"],
        time_range=time_range,
    )
    query_context = MagicMock()
    query_context.datasource = datasource
    query_context.queries = [query]
    query_context.get_cache_timeout.return_value = 300
    processor = QueryContextProcessor(query_context)
    query_context.query_cache_key.side_effect = processor.query_cache_key
    return query_context


def _lookup_keys(query_context: MagicMock, rls: list[str]) -> list[str]:
    """Keys the warm-up path looks up, recorded from the cache read."""
    looked_up: list[str] = []
    with (
        patch("superset.commands.chart.warm_up_cache.cache_manager") as cm,
        patch(
            "superset.common.query_context_processor.security_manager",
            new_callable=MagicMock,
        ) as sm,
    ):
        sm.get_rls_cache_key.return_value = rls
        cm.data_cache.get.side_effect = lambda key: looked_up.append(key)
        ChartWarmUpCacheCommand._missing_cache_keys(query_context)
    return looked_up


def _request_key(query_context: MagicMock, rls: list[str]) -> Any:
    """Key the request path derives: validate the query, then build the key."""
    query = query_context.queries[0]
    query.validate()
    with patch(
        "superset.common.query_context_processor.security_manager",
        new_callable=MagicMock,
    ) as sm:
        sm.get_rls_cache_key.return_value = rls
        return query_context.query_cache_key(query)


def test_warmup_key_matches_request_key(app_context: None) -> None:
    query_context = _query_context()
    assert _lookup_keys(query_context, ["rls"]) == [
        _request_key(query_context, ["rls"])
    ]


def test_row_level_security_changes_the_key(app_context: None) -> None:
    query_context = _query_context()
    assert _lookup_keys(query_context, ["region = 'EU'"]) != _lookup_keys(
        query_context, ["region = 'US'"]
    )


def test_relative_time_range_key_is_stable(app_context: None) -> None:
    """Keys use the user-supplied relative range, not the resolved timestamps."""
    first = _lookup_keys(_query_context("Last week"), [])
    second = _lookup_keys(_query_context("Last week"), [])
    assert first == second
    assert first != _lookup_keys(_query_context("Last month"), [])


def test_per_user_caching_key_follows_the_running_user(app_context: None) -> None:
    """With per-user caching, the key depends on the user the task runs as."""
    from superset.utils.core import override_user

    query_context = _query_context(database_extra='{"per_user_caching": true}')
    engine_spec = query_context.datasource.database.db_engine_spec
    engine_spec.get_impersonation_key.side_effect = lambda user: f"user-{user.id}"

    with override_user(MagicMock(id=1), force=True):
        first = _lookup_keys(query_context, [])
    with override_user(MagicMock(id=2), force=True):
        second = _lookup_keys(query_context, [])
    with override_user(MagicMock(id=1), force=True):
        again = _lookup_keys(query_context, [])

    assert first != second
    assert first == again
