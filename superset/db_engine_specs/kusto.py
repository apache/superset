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
from datetime import datetime
from typing import Any, Dict, List, Optional, Type

from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIDatabaseError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)
from superset.sql_parse import ParsedQuery
from superset.utils import core as utils


class KustoSqlEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    limit_method = LimitMethod.WRAP_SQL
    engine = "kustosql"
    engine_name = "KustoSQL"
    time_groupby_inline = True
    time_secondary_columns = True
    allows_joins = True
    allows_subqueries = True
    allows_sql_comments = False

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATEADD(second, DATEDIFF(second, '2000-01-01', {col}), '2000-01-01')",
        "PT1M": "DATEADD(minute, DATEDIFF(minute, 0, {col}), 0)",
        "PT5M": "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 5 * 5, 0)",
        "PT10M": "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 10 * 10, 0)",
        "PT15M": "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 15 * 15, 0)",
        "PT0.5H": "DATEADD(minute, DATEDIFF(minute, 0, {col}) / 30 * 30, 0)",
        "PT1H": "DATEADD(hour, DATEDIFF(hour, 0, {col}), 0)",
        "P1D": "DATEADD(day, DATEDIFF(day, 0, {col}), 0)",
        "P1W": "DATEADD(day, -1, DATEADD(week, DATEDIFF(week, 0, {col}), 0))",
        "P1M": "DATEADD(month, DATEDIFF(month, 0, {col}), 0)",
        "P0.25Y": "DATEADD(quarter, DATEDIFF(quarter, 0, {col}), 0)",
        "P1Y": "DATEADD(year, DATEDIFF(year, 0, {col}), 0)",
        "1969-12-28T00:00:00Z/P1W": "DATEADD(day, -1,"
        " DATEADD(week, DATEDIFF(week, 0, {col}), 0))",
        "1969-12-29T00:00:00Z/P1W": "DATEADD(week,"
        " DATEDIFF(week, 0, DATEADD(day, -1, {col})), 0)",
    }

    type_code_map: Dict[int, str] = {}  # loaded from get_datatype only if needed

    @classmethod
    def get_dbapi_exception_mapping(cls) -> Dict[Type[Exception], Type[Exception]]:
        # pylint: disable=import-outside-toplevel,import-error
        import sqlalchemy_kusto.errors as kusto_exceptions

        return {
            kusto_exceptions.DatabaseError: SupersetDBAPIDatabaseError,
            kusto_exceptions.OperationalError: SupersetDBAPIOperationalError,
            kusto_exceptions.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"CONVERT(DATE, '{dttm.date().isoformat()}', 23)"
        if tt == utils.TemporalType.DATETIME:
            datetime_formatted = dttm.isoformat(timespec="milliseconds")
            return f"""CONVERT(DATETIME, '{datetime_formatted}', 126)"""
        if tt == utils.TemporalType.SMALLDATETIME:
            datetime_formatted = dttm.isoformat(sep=" ", timespec="seconds")
            return f"""CONVERT(SMALLDATETIME, '{datetime_formatted}', 20)"""
        if tt == utils.TemporalType.TIMESTAMP:
            datetime_formatted = dttm.isoformat(sep=" ", timespec="seconds")
            return f"""CONVERT(TIMESTAMP, '{datetime_formatted}', 20)"""
        return None

    @classmethod
    def is_readonly_query(cls, parsed_query: ParsedQuery) -> bool:
        """Pessimistic readonly, 100% sure statement won't mutate anything"""
        return parsed_query.sql.lower().startswith("select")


class KustoKqlEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    limit_method = LimitMethod.WRAP_SQL
    engine = "kustokql"
    engine_name = "KustoKQL"
    time_groupby_inline = True
    time_secondary_columns = True
    allows_joins = True
    allows_subqueries = True
    allows_sql_comments = False
    run_multiple_statements_as_one = True

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "{col}/ time(1s)",
        "PT1M": "{col}/ time(1min)",
        "PT1H": "{col}/ time(1h)",
        "P1D": "{col}/ time(1d)",
        "P1M": "datetime_diff('month',CreateDate, datetime(0001-01-01 00:00:00))+1",
        "P1Y": "datetime_diff('year',CreateDate, datetime(0001-01-01 00:00:00))+1",
    }

    type_code_map: Dict[int, str] = {}  # loaded from get_datatype only if needed

    @classmethod
    def get_dbapi_exception_mapping(cls) -> Dict[Type[Exception], Type[Exception]]:
        # pylint: disable=import-outside-toplevel,import-error
        import sqlalchemy_kusto.errors as kusto_exceptions

        return {
            kusto_exceptions.DatabaseError: SupersetDBAPIDatabaseError,
            kusto_exceptions.OperationalError: SupersetDBAPIOperationalError,
            kusto_exceptions.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        if target_type.upper() in [
            utils.TemporalType.DATETIME,
            utils.TemporalType.TIMESTAMP,
        ]:
            return f"""datetime({dttm.isoformat(timespec="microseconds")})"""
        if target_type.upper() == utils.TemporalType.DATE:
            return f"""datetime({dttm.date().isoformat()})"""

        return None

    @classmethod
    def is_readonly_query(cls, parsed_query: ParsedQuery) -> bool:
        """
        Pessimistic readonly, 100% sure statement won't mutate anything.
        """
        return KustoKqlEngineSpec.is_select_query(
            parsed_query
        ) or parsed_query.sql.startswith(".show")

    @classmethod
    def is_select_query(cls, parsed_query: ParsedQuery) -> bool:
        return not parsed_query.sql.startswith(".")

    @classmethod
    def parse_sql(cls, sql: str) -> List[str]:
        """
        Kusto supports a single query statement, but it could include sub queries
        and variables declared via let keyword.
        """
        return [sql]
