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
from sqlalchemy import types
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeEngine

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec


class PinotEngineSpec(BaseEngineSpec):
    engine = "pinot"
    engine_name = "Apache Pinot"

    allows_subqueries = False
    allows_joins = False
    allows_alias_in_select = False
    allows_alias_in_orderby = False

    # https://docs.pinot.apache.org/users/user-guide-query/supported-transformations#datetime-functions
    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "CAST(DATE_TRUNC('second', "
        + "CAST({col} AS TIMESTAMP)) AS TIMESTAMP)",
        TimeGrain.MINUTE: "CAST(DATE_TRUNC('minute', "
        + "CAST({col} AS TIMESTAMP)) AS TIMESTAMP)",
        TimeGrain.FIVE_MINUTES: "CAST(ROUND(DATE_TRUNC('minute', "
        + "CAST({col} AS TIMESTAMP)), 300000) AS TIMESTAMP)",
        TimeGrain.TEN_MINUTES: "CAST(ROUND(DATE_TRUNC('minute', "
        + "CAST({col} AS TIMESTAMP)), 600000) AS TIMESTAMP)",
        TimeGrain.FIFTEEN_MINUTES: "CAST(ROUND(DATE_TRUNC('minute', "
        + "CAST({col} AS TIMESTAMP)), 900000) AS TIMESTAMP)",
        TimeGrain.THIRTY_MINUTES: "CAST(ROUND(DATE_TRUNC('minute', "
        + "CAST({col} AS TIMESTAMP)), 1800000) AS TIMESTAMP)",
        TimeGrain.HOUR: "CAST(DATE_TRUNC('hour', CAST({col} AS TIMESTAMP)) AS TIMESTAMP)",  # noqa: E501
        TimeGrain.DAY: "CAST(DATE_TRUNC('day', CAST({col} AS TIMESTAMP)) AS TIMESTAMP)",
        TimeGrain.WEEK: "CAST(DATE_TRUNC('week', CAST({col} AS TIMESTAMP)) AS TIMESTAMP)",  # noqa: E501
        TimeGrain.MONTH: "CAST(DATE_TRUNC('month', "
        + "CAST({col} AS TIMESTAMP)) AS TIMESTAMP)",
        TimeGrain.QUARTER: "CAST(DATE_TRUNC('quarter', "
        + "CAST({col} AS TIMESTAMP)) AS TIMESTAMP)",
        TimeGrain.YEAR: "CAST(DATE_TRUNC('year', CAST({col} AS TIMESTAMP)) AS TIMESTAMP)",  # noqa: E501
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return (
            "DATETIMECONVERT({col}, '1:SECONDS:EPOCH', '1:SECONDS:EPOCH', '1:SECONDS')"
        )

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return (
            "DATETIMECONVERT({col}, '1:MILLISECONDS:EPOCH', "
            + "'1:MILLISECONDS:EPOCH', '1:MILLISECONDS')"
        )

    @classmethod
    def column_datatype_to_string(
        cls, sqla_column_type: TypeEngine, dialect: Dialect
    ) -> str:
        # Pinot driver infers TIMESTAMP column as LONG, so make the quick fix.
        # When the Pinot driver fix this bug, current method could be removed.
        if isinstance(sqla_column_type, types.TIMESTAMP):
            return sqla_column_type.compile().upper()

        return super().column_datatype_to_string(sqla_column_type, dialect)
