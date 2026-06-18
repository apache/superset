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
from typing import Any
from unittest.mock import Mock

from pytest import fixture  # noqa: PT013

from superset.common.query_object_factory import QueryObjectFactory
from tests.common.query_context_generator import QueryContextGenerator


def create_app_config() -> dict[str, Any]:
    return {
        "ROW_LIMIT": 5000,
        "DEFAULT_RELATIVE_START_TIME": "today",
        "DEFAULT_RELATIVE_END_TIME": "today",
        "SAMPLES_ROW_LIMIT": 1000,
        "SQL_MAX_ROW": 100000,
    }


@fixture
def app_config() -> dict[str, Any]:
    return create_app_config().copy()


@fixture
def connector_registry() -> Mock:
    mock = Mock(spec=["get_datasource"])
    mock.get_datasource().verbose_map = {"sum__num": "SUM", "unused": "UNUSED"}
    return mock


def apply_max_row_limit(
    limit: int,
    server_pagination: bool | None = None,
) -> int:
    max_limit = (
        create_app_config()["TABLE_VIZ_MAX_ROW_SERVER"]
        if server_pagination
        else create_app_config()["SQL_MAX_ROW"]
    )
    if limit != 0:
        return min(max_limit, limit)
    return max_limit


@fixture
def query_object_factory(
    app_config: dict[str, Any], connector_registry: Mock
) -> QueryObjectFactory:
    import superset.common.query_object_factory as mod

    mod.apply_max_row_limit = apply_max_row_limit
    return QueryObjectFactory(app_config, connector_registry)


@fixture
def raw_query_context() -> dict[str, Any]:
    return QueryContextGenerator().generate("birth_names")


@fixture
def metric_label_raw_query_context() -> dict[str, Any]:
    return QueryContextGenerator().generate("birth_names:metric_labels")


class TestQueryObjectFactory:
    def test_query_context_limit_and_offset_defaults(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: dict[str, Any],
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
        raw_query_context: dict[str, Any],
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
        raw_query_context: dict[str, Any],
    ):
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object["post_processing"] = [None]
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        assert query_object.post_processing == []

    def test_query_context_metric_names(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: dict[str, Any],
    ):
        raw_query_context["queries"][0]["metrics"] = [
            {"label": "sum__num"},
            {"label": "num_girls"},
            {"label": "num_boys"},
        ]
        raw_query_object = raw_query_context["queries"][0]
        query_object = query_object_factory.create(
            raw_query_context["result_type"],
            datasource=raw_query_context["datasource"],
            **raw_query_object,
        )
        assert query_object.metric_names == ["SUM", "num_girls", "num_boys"]

    def test_deprecated_groupby_renamed_to_columns(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: dict[str, Any],
    ):
        """groupby in stored query_context should be silently renamed to columns."""
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object.pop("columns", None)
        raw_query_object["groupby"] = ["name", "gender"]
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        assert query_object.columns == ["name", "gender"]
        assert not hasattr(query_object, "groupby")

    def test_deprecated_groupby_does_not_overwrite_columns(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: dict[str, Any],
    ):
        """When both groupby and columns are present, columns takes precedence."""
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object["columns"] = ["state"]
        raw_query_object["groupby"] = ["name", "gender"]
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        assert query_object.columns == ["state"]

    def test_deprecated_groupby_empty_list_is_ignored(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: dict[str, Any],
    ):
        """groupby=[] is falsy — popped but columns should default to []."""
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object.pop("columns", None)
        raw_query_object["groupby"] = []
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        assert query_object.columns == []
        assert not hasattr(query_object, "groupby")

    def test_deprecated_granularity_sqla_renamed_to_granularity(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: dict[str, Any],
    ):
        """granularity_sqla in stored query_context should be renamed to granularity."""
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object.pop("granularity", None)
        raw_query_object["granularity_sqla"] = "ds"
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        assert query_object.granularity == "ds"

    def test_deprecated_timeseries_limit_renamed_to_series_limit(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: dict[str, Any],
    ):
        """timeseries_limit should be renamed to series_limit."""
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object.pop("series_limit", None)
        raw_query_object["timeseries_limit"] = 5
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        assert query_object.series_limit == 5

    def test_deprecated_timeseries_limit_zero_is_not_renamed(
        self,
        query_object_factory: QueryObjectFactory,
        raw_query_context: dict[str, Any],
    ):
        """timeseries_limit=0 is falsy — popped; series_limit defaults to 0."""
        raw_query_object = raw_query_context["queries"][0]
        raw_query_object.pop("series_limit", None)
        raw_query_object["timeseries_limit"] = 0
        query_object = query_object_factory.create(
            raw_query_context["result_type"], **raw_query_object
        )
        # 0 is falsy so it does not propagate — QueryObject default is also 0
        assert query_object.series_limit == 0
