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
import re
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import types
from sqlalchemy.dialects.mssql.base import SMALLDATETIME

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIDatabaseError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.sql.parse import LimitMethod
from superset.utils.core import GenericDataType


class KustoSqlEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    limit_method = LimitMethod.WRAP_SQL
    engine = "kustosql"
    engine_name = "KustoSQL"
    time_groupby_inline = True
    allows_joins = True
    allows_subqueries = True
    allows_sql_comments = False

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATEADD(second, \
            'DATEDIFF(second, 2000-01-01', {col}), '2000-01-01')",
        TimeGrain.MINUTE: "DATEADD(minute, DATEDIFF(minute, 0, {col}), 0)",
        TimeGrain.FIVE_MINUTES: "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 5 * 5, 0)",  # noqa: E501
        TimeGrain.TEN_MINUTES: "DATEADD(minute, \
            DATEDIFF(minute, 0, {col}) / 10 * 10, 0)",
        TimeGrain.FIFTEEN_MINUTES: "DATEADD(minute, \
            DATEDIFF(minute, 0, {col}) / 15 * 15, 0)",
        TimeGrain.HALF_HOUR: "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 30 * 30, 0)",
        TimeGrain.HOUR: "DATEADD(hour, DATEDIFF(hour, 0, {col}), 0)",
        TimeGrain.DAY: "DATEADD(day, DATEDIFF(day, 0, {col}), 0)",
        TimeGrain.WEEK: "DATEADD(day, -1, DATEADD(week, DATEDIFF(week, 0, {col}), 0))",
        TimeGrain.MONTH: "DATEADD(month, DATEDIFF(month, 0, {col}), 0)",
        TimeGrain.QUARTER: "DATEADD(quarter, DATEDIFF(quarter, 0, {col}), 0)",
        TimeGrain.YEAR: "DATEADD(year, DATEDIFF(year, 0, {col}), 0)",
        TimeGrain.WEEK_STARTING_SUNDAY: "DATEADD(day, -1,"
        " DATEADD(week, DATEDIFF(week, 0, {col}), 0))",
        TimeGrain.WEEK_STARTING_MONDAY: "DATEADD(week,"
        " DATEDIFF(week, 0, DATEADD(day, -1, {col})), 0)",
    }

    type_code_map: dict[int, str] = {}  # loaded from get_datatype only if needed

    column_type_mappings = (
        (
            re.compile(r"^smalldatetime.*", re.IGNORECASE),
            SMALLDATETIME(),
            GenericDataType.TEMPORAL,
        ),
    )

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        # pylint: disable=import-outside-toplevel,import-error
        import sqlalchemy_kusto.errors as kusto_exceptions

        return {
            kusto_exceptions.DatabaseError: SupersetDBAPIDatabaseError,
            kusto_exceptions.OperationalError: SupersetDBAPIOperationalError,
            kusto_exceptions.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"CONVERT(DATE, '{dttm.date().isoformat()}', 23)"
        if isinstance(sqla_type, types.TIMESTAMP):
            datetime_formatted = dttm.isoformat(sep=" ", timespec="seconds")
            return f"""CONVERT(TIMESTAMP, '{datetime_formatted}', 20)"""
        if isinstance(sqla_type, SMALLDATETIME):
            datetime_formatted = dttm.isoformat(sep=" ", timespec="seconds")
            return f"""CONVERT(SMALLDATETIME, '{datetime_formatted}', 20)"""
        if isinstance(sqla_type, types.DateTime):
            datetime_formatted = dttm.isoformat(timespec="milliseconds")
            return f"""CONVERT(DATETIME, '{datetime_formatted}', 126)"""
        return None


class KustoKqlEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    engine = "kustokql"
    engine_name = "KustoKQL"
    time_groupby_inline = True
    allows_joins = True
    allows_subqueries = True
    allows_sql_comments = False
    run_multiple_statements_as_one = True

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "bin({col},1s)",
        TimeGrain.THIRTY_SECONDS: "bin({col},30s)",
        TimeGrain.MINUTE: "bin({col},1m)",
        TimeGrain.FIVE_MINUTES: "bin({col},5m)",
        TimeGrain.THIRTY_MINUTES: "bin({col},30m)",
        TimeGrain.HOUR: "bin({col},1h)",
        TimeGrain.DAY: "startofday({col})",
        TimeGrain.WEEK: "startofweek({col})",
        TimeGrain.MONTH: "startofmonth({col})",
        TimeGrain.YEAR: "startofyear({col})",
    }

    type_code_map: dict[int, str] = {}  # loaded from get_datatype only if needed

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        # pylint: disable=import-outside-toplevel,import-error
        import sqlalchemy_kusto.errors as kusto_exceptions

        return {
            kusto_exceptions.DatabaseError: SupersetDBAPIDatabaseError,
            kusto_exceptions.OperationalError: SupersetDBAPIOperationalError,
            kusto_exceptions.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"""datetime({dttm.date().isoformat()})"""
        if isinstance(sqla_type, types.DateTime):
            return f"""datetime({dttm.isoformat(timespec="microseconds")})"""

        return None
