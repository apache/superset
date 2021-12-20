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
from typing import Any, Dict, Optional
from unittest.mock import Mock, patch

from pytest import fixture, mark

from superset.common.query_object_factory import QueryObjectFactory
from tests.common.query_context_generator import QueryContextGenerator


def create_app_config() -> Dict[str, Any]:
    return {
        "ROW_LIMIT": 5000,
        "DEFAULT_RELATIVE_START_TIME": "today",
        "DEFAULT_RELATIVE_END_TIME": "today",
        "SAMPLES_ROW_LIMIT": 1000,
        "SIP_15_ENABLED": True,
        "SQL_MAX_ROW": 100000,
        "SIP_15_GRACE_PERIOD_END": None,
    }


@fixture
def app_config() -> Dict[str, Any]:
    return create_app_config().copy()


@fixture
def session_factory() -> Mock:
    return Mock()


@fixture
def connector_registry() -> Mock:
    return Mock(spec=["get_datasource"])


def apply_max_row_limit(limit: int, max_limit: Optional[int] = None) -> int:
    if max_limit is None:
        max_limit = create_app_config()["SQL_MAX_ROW"]
    if limit != 0:
        return min(max_limit, limit)
    return max_limit


@fixture
def query_object_factory(
    app_config: Dict[str, Any], connector_registry: Mock, session_factory: Mock
) -> QueryObjectFactory:
    import superset.common.query_object_factory as mod

    mod.apply_max_row_limit = apply_max_row_limit
    return QueryObjectFactory(app_config, connector_registry, session_factory)


@fixture
def raw_query_context() -> Dict[str, Any]:
    return QueryContextGenerator().generate("birth_names")


class TestQueryObjectFactory:
    def test_query_context_limit_and_offset_defaults(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: Dict[str, Any],
    ):
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object.pop("row_limit", None)
        raw_query_object.pop("row_offset", None)
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        assert query_object.row_limit == 5000
        assert query_object.row_offset == 0

    def test_query_context_limit(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: Dict[str, Any],
    ):
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object["row_limit"] = 100
        raw_query_object["row_offset"] = 200
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )

        assert query_object.row_limit == 100
        assert query_object.row_offset == 200

    def test_query_context_null_post_processing_op(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: Dict[str, Any],
    ):
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object["post_processing"] = [None]
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        assert query_object.post_processing == []
