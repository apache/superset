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
from copy import deepcopy

import pytest

from superset.utils.core import (
    AdhocMetric,
    ExtraFiltersReasonType,
    ExtraFiltersTimeColumnType,
    GenericDataType,
    get_metric_name,
    get_metric_names,
    get_time_filter_status,
    is_adhoc_metric,
    NO_TIME_RANGE,
)
from tests.unit_tests.fixtures.datasets import get_dataset_mock

STR_METRIC = "my_metric"
SIMPLE_SUM_ADHOC_METRIC: AdhocMetric = {
    "aggregate": "SUM",
    "column": {
        "column_name": "my_col",
        "type": "INT",
        "type_generic": GenericDataType.NUMERIC,
    },
    "expressionType": "SIMPLE",
    "label": "my SUM",
}
SQL_ADHOC_METRIC: AdhocMetric = {
    "expressionType": "SQL",
    "label": "my_sql",
    "sqlExpression": "SUM(my_col)",
}


def test_get_metric_name_saved_metric():
    assert get_metric_name(STR_METRIC) == "my_metric"


def test_get_metric_name_adhoc():
    metric = deepcopy(SIMPLE_SUM_ADHOC_METRIC)
    assert get_metric_name(metric) == "my SUM"
    del metric["label"]
    assert get_metric_name(metric) == "SUM(my_col)"
    metric["label"] = ""
    assert get_metric_name(metric) == "SUM(my_col)"
    del metric["aggregate"]
    assert get_metric_name(metric) == "my_col"
    metric["aggregate"] = ""
    assert get_metric_name(metric) == "my_col"

    metric = deepcopy(SQL_ADHOC_METRIC)
    assert get_metric_name(metric) == "my_sql"
    del metric["label"]
    assert get_metric_name(metric) == "SUM(my_col)"
    metric["label"] = ""
    assert get_metric_name(metric) == "SUM(my_col)"


def test_get_metric_name_invalid_metric():
    metric = deepcopy(SIMPLE_SUM_ADHOC_METRIC)
    del metric["label"]
    del metric["column"]
    with pytest.raises(ValueError):
        get_metric_name(metric)

    metric = deepcopy(SIMPLE_SUM_ADHOC_METRIC)
    del metric["label"]
    metric["expressionType"] = "FOO"
    with pytest.raises(ValueError):
        get_metric_name(metric)

    metric = deepcopy(SQL_ADHOC_METRIC)
    del metric["label"]
    metric["expressionType"] = "FOO"
    with pytest.raises(ValueError):
        get_metric_name(metric)


def test_get_metric_names():
    assert get_metric_names(
        [STR_METRIC, SIMPLE_SUM_ADHOC_METRIC, SQL_ADHOC_METRIC]
    ) == ["my_metric", "my SUM", "my_sql"]


def test_is_adhoc_metric():
    assert is_adhoc_metric(STR_METRIC) is False
    assert is_adhoc_metric(SIMPLE_SUM_ADHOC_METRIC) is True
    assert is_adhoc_metric(SQL_ADHOC_METRIC) is True


def test_get_time_filter_status_time_col():
    dataset = get_dataset_mock()

    assert get_time_filter_status(
        dataset, {ExtraFiltersTimeColumnType.TIME_COL: "ds"}
    ) == ([{"column": ExtraFiltersTimeColumnType.TIME_COL}], [])


def test_get_time_filter_status_time_range():
    dataset = get_dataset_mock()

    assert get_time_filter_status(
        dataset, {ExtraFiltersTimeColumnType.TIME_RANGE: "1 year ago"}
    ) == ([{"column": ExtraFiltersTimeColumnType.TIME_RANGE}], [])


def test_get_time_filter_status_time_grain():
    dataset = get_dataset_mock()

    assert get_time_filter_status(
        dataset, {ExtraFiltersTimeColumnType.TIME_GRAIN: "PT1M"}
    ) == ([{"column": ExtraFiltersTimeColumnType.TIME_GRAIN}], [])


def test_get_time_filter_status_no_temporal_col():
    dataset = get_dataset_mock()
    dataset.columns[0].is_dttm = False

    assert get_time_filter_status(
        dataset, {ExtraFiltersTimeColumnType.TIME_COL: "foobar"}
    ) == (
        [],
        [
            {
                "reason": ExtraFiltersReasonType.COL_NOT_IN_DATASOURCE,
                "column": ExtraFiltersTimeColumnType.TIME_COL,
            }
        ],
    )

    assert get_time_filter_status(
        dataset, {ExtraFiltersTimeColumnType.TIME_RANGE: "1 year ago"}
    ) == (
        [],
        [
            {
                "reason": ExtraFiltersReasonType.NO_TEMPORAL_COLUMN,
                "column": ExtraFiltersTimeColumnType.TIME_RANGE,
            }
        ],
    )

    assert get_time_filter_status(
        dataset, {ExtraFiltersTimeColumnType.TIME_GRAIN: "PT1M"}
    ) == (
        [],
        [
            {
                "reason": ExtraFiltersReasonType.NO_TEMPORAL_COLUMN,
                "column": ExtraFiltersTimeColumnType.TIME_GRAIN,
            }
        ],
    )
