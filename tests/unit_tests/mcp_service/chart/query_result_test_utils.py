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

"""Shared real-producer fixtures for MCP query-result consumer tests."""

from types import SimpleNamespace
from typing import Any, cast

import pandas as pd

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.common.query_object import QueryObject
from superset.utils.core import GenericDataType


def real_compare_command_result(sql: str) -> dict[str, Any]:
    """Return a FULL command envelope after a built-in ratio divides by zero."""
    query = QueryObject(
        post_processing=[
            {
                "operation": "compare",
                "options": {
                    "source_columns": ["source"],
                    "compare_columns": ["comparison"],
                    "compare_type": "ratio",
                },
            }
        ]
    )
    frame = query.exec_post_processing(
        pd.DataFrame(
            {
                "source": [1.0],
                "comparison": [0.0],
                "finite": [2.5],
                "finite_integer": [2**53 + 1],
            }
        )
    )
    context = SimpleNamespace(
        datasource=object(), result_format=ChartDataResultFormat.JSON
    )
    records = QueryContextProcessor(cast(QueryContext, context)).get_data(
        frame, [GenericDataType.NUMERIC] * len(frame.columns)
    )

    class _Context:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": records,
                        "colnames": list(frame.columns),
                        "coltypes": [GenericDataType.NUMERIC] * len(frame.columns),
                        "query": sql,
                        "rowcount": 1,
                    }
                ]
            }

    return ChartDataCommand(_Context()).run()  # type: ignore[arg-type]
