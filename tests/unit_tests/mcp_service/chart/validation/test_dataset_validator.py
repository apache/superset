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

import pytest

from superset.mcp_service.chart.schemas import ColumnRef
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.common.error_schemas import (
    ChartGenerationError,
    DatasetContext,
)


def _validate_sum(sql_type: str) -> list[ChartGenerationError]:
    context = DatasetContext(
        id=69,
        table_name="virtual_metrics",
        schema=None,
        database_name="database",
        available_columns=[
            {"name": "computed_total", "type": sql_type, "is_numeric": False}
        ],
        available_metrics=[],
    )

    return DatasetValidator._validate_aggregations(
        [ColumnRef(name="computed_total", aggregate="SUM")], context
    )


@pytest.mark.parametrize(
    "sql_type",
    [
        "BIGINT",
        "SMALLINT",
        "TINYINT",
        "REAL",
        "NUMBER",
        "DOUBLE PRECISION",
        "INT8",
        "FLOAT8",
        "DECIMAL(10, 2)",
        "MONEY",
        "SMALLMONEY",
    ],
)
def test_numeric_type_spelling_is_accepted(sql_type: str) -> None:
    assert _validate_sum(sql_type) == []


@pytest.mark.parametrize("sql_type", ["", "UNKNOWN"])
def test_unknown_type_is_deferred_to_compile_check(sql_type: str) -> None:
    assert _validate_sum(sql_type) == []


@pytest.mark.parametrize("sql_type", ["VARCHAR", "INTERVAL", "POINT"])
def test_non_numeric_type_is_rejected_for_numeric_aggregation(
    sql_type: str,
) -> None:
    assert _validate_sum(sql_type)[0].error_type == "invalid_aggregation"
