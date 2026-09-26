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

"""Real chart-data producer fixtures shared by MCP consumer tests."""

from datetime import datetime, timedelta, tzinfo
from types import SimpleNamespace
from typing import Any, cast, NoReturn

import pandas as pd

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.db_query_status import QueryStatus
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.utils.core import GenericDataType


class HostileTimezone(tzinfo):
    """Timezone whose protocol and representation hooks must remain unused."""

    def __init__(self) -> None:
        self.calls = 0

    def _fail(self) -> NoReturn:
        self.calls += 1
        raise AssertionError("hostile timezone hook executed")

    def utcoffset(self, _dt: datetime | None) -> timedelta | None:
        self._fail()

    def dst(self, _dt: datetime | None) -> timedelta | None:
        self._fail()

    def tzname(self, _dt: datetime | None) -> str | None:
        self._fail()

    def fromutc(self, _dt: datetime) -> datetime:
        self._fail()

    def __repr__(self) -> str:
        self._fail()


class FakeQueryContext:
    """Minimal command-compatible context returning a real producer payload."""

    result_type = ChartDataResultType.FULL
    result_format = ChartDataResultFormat.JSON

    def __init__(self, query: dict[str, Any]) -> None:
        self.query = query

    def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
        return {"queries": [self.query]}


def chart_data_command_result(
    rows: list[dict[str, Any]] | None = None,
    *,
    columns: list[str] | None = None,
    coltypes: list[GenericDataType] | None = None,
    frame: pd.DataFrame | None = None,
    cache_timeout: int = 300,
) -> dict[str, Any]:
    """Materialize a DataFrame and pass it through ``ChartDataCommand.run``."""
    rows = rows if rows is not None else [{"value": 1}]
    if columns is None:
        if frame is not None:
            columns = list(frame.columns)
        elif rows:
            columns = list(rows[0])
        else:
            columns = ["value"]
    if coltypes is None:
        coltypes = [GenericDataType.NUMERIC] * len(columns)
    frame = frame if frame is not None else pd.DataFrame(rows, columns=columns)
    processor_context = SimpleNamespace(
        datasource=object(), result_format=ChartDataResultFormat.JSON
    )
    data = QueryContextProcessor(cast(QueryContext, processor_context)).get_data(
        frame, coltypes
    )
    query = {
        "cache_key": None,
        "cached_dttm": None,
        "queried_dttm": None,
        "cache_timeout": cache_timeout,
        "data": data,
        "colnames": columns,
        "coltypes": coltypes,
        "error": None,
        "is_cached": None,
        "query": "SELECT 1",
        "status": QueryStatus.SUCCESS,
        "rowcount": len(frame),
        "sql_rowcount": len(frame),
        "result_format": ChartDataResultFormat.JSON,
        "applied_filters": [],
        "rejected_filters": [],
    }
    return ChartDataCommand(FakeQueryContext(query)).run()  # type: ignore[arg-type]
