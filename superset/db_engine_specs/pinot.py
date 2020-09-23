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
import datetime
from typing import Dict, List, Optional

from sqlalchemy.sql.expression import ColumnClause, ColumnElement

from superset.db_engine_specs.base import BaseEngineSpec, TimestampExpression


class PinotEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    engine = "pinot"
    engine_name = "Apache Pinot"
    allows_subqueries = False
    allows_joins = False
    allows_column_aliases = False

    # Pinot does its own conversion below
    _time_grain_expressions: Dict[Optional[str], str] = {
        "PT1S": "1:SECONDS",
        "PT1M": "1:MINUTES",
        "PT1H": "1:HOURS",
        "P1D": "1:DAYS",
        "P1W": "1:WEEKS",
        "P1M": "1:MONTHS",
        "P0.25Y": "3:MONTHS",
        "P1Y": "1:YEARS",
    }

    _python_to_java_time_patterns: Dict[str, str] = {
        "%Y": "yyyy",
        "%m": "MM",
        "%d": "dd",
        "%H": "HH",
        "%M": "mm",
        "%S": "ss",
    }

    @classmethod
    def get_timestamp_expr(
        cls,
        col: ColumnClause,
        pdf: Optional[str],
        time_grain: Optional[str],
        type_: Optional[str] = None,
    ) -> TimestampExpression:
        is_epoch = pdf in ("epoch_s", "epoch_ms")

        # The DATETIMECONVERT pinot udf is documented at
        # Per https://github.com/apache/incubator-pinot/wiki/dateTimeConvert-UDF
        # We are not really converting any time units, just bucketing them.
        tf = ""
        if not is_epoch:
            try:
                today = datetime.datetime.today()
                today.strftime(str(pdf))
            except ValueError:
                raise ValueError(f"Invalid column datetime format:{str(pdf)}")
            java_date_format = str(pdf)
            for (
                python_pattern,
                java_pattern,
            ) in cls._python_to_java_time_patterns.items():
                java_date_format.replace(python_pattern, java_pattern)
            tf = f"1:SECONDS:SIMPLE_DATE_FORMAT:{java_date_format}"
        else:
            seconds_or_ms = "MILLISECONDS" if pdf == "epoch_ms" else "SECONDS"
            tf = f"1:{seconds_or_ms}:EPOCH"
        if time_grain:
            granularity = cls.get_time_grain_expressions().get(time_grain)
            if not granularity:
                raise NotImplementedError("No pinot grain spec for " + str(time_grain))
        else:
            return TimestampExpression("{{col}}", col)
        # In pinot the output is a string since there is no timestamp column like pg
        time_expr = f"DATETIMECONVERT({{col}}, '{tf}', '{tf}', '{granularity}')"
        return TimestampExpression(time_expr, col)

    @classmethod
    def make_select_compatible(
        cls, groupby_exprs: Dict[str, ColumnElement], select_exprs: List[ColumnElement]
    ) -> List[ColumnElement]:
        return select_exprs
