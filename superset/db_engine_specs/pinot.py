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
from typing import Dict, Optional

from sqlalchemy.sql.expression import ColumnClause

from superset.db_engine_specs.base import BaseEngineSpec, TimestampExpression


class PinotEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    engine = "pinot"
    engine_name = "Apache Pinot"
    allows_subqueries = False
    allows_joins = False
    allows_alias_in_select = False
    allows_alias_in_orderby = False

    # Pinot does its own conversion below
    _time_grain_expressions: Dict[Optional[str], str] = {
        "PT1S": "1:SECONDS",
        "PT1M": "1:MINUTES",
        "PT1H": "1:HOURS",
        "P1D": "1:DAYS",
        "P1W": "week",
        "P1M": "month",
        "P3MY": "quarter",
        "P1Y": "year",
    }

    _python_to_java_time_patterns: Dict[str, str] = {
        "%Y": "yyyy",
        "%m": "MM",
        "%d": "dd",
        "%H": "HH",
        "%M": "mm",
        "%S": "ss",
    }

    _use_date_trunc_function: Dict[str, bool] = {
        "PT1S": False,
        "PT1M": False,
        "PT1H": False,
        "P1D": False,
        "P1W": True,
        "P1M": True,
        "P3M": True,
        "P1Y": True,
    }

    @classmethod
    def get_timestamp_expr(
        cls,
        col: ColumnClause,
        pdf: Optional[str],
        time_grain: Optional[str],
        type_: Optional[str] = None,
    ) -> TimestampExpression:
        if not pdf:
            raise NotImplementedError(f"Empty date format for '{col}'")
        is_epoch = pdf in ("epoch_s", "epoch_ms")

        # The DATETIMECONVERT pinot udf is documented at
        # Per https://github.com/apache/incubator-pinot/wiki/dateTimeConvert-UDF
        # We are not really converting any time units, just bucketing them.
        tf = ""
        java_date_format = ""
        if not is_epoch:
            java_date_format = pdf
            for (
                python_pattern,
                java_pattern,
            ) in cls._python_to_java_time_patterns.items():
                java_date_format = java_date_format.replace(
                    python_pattern, java_pattern
                )
            tf = f"1:SECONDS:SIMPLE_DATE_FORMAT:{java_date_format}"
        else:
            seconds_or_ms = "MILLISECONDS" if pdf == "epoch_ms" else "SECONDS"
            tf = f"1:{seconds_or_ms}:EPOCH"
        if time_grain:
            granularity = cls.get_time_grain_expressions().get(time_grain)
            if not granularity:
                raise NotImplementedError(f"No pinot grain spec for '{time_grain}'")
        else:
            return TimestampExpression("{{col}}", col)

        # In pinot the output is a string since there is no timestamp column like pg
        if cls._use_date_trunc_function.get(time_grain):
            if is_epoch:
                time_expr = f"DATETRUNC('{granularity}', {{col}}, '{seconds_or_ms}')"
            else:
                time_expr = (
                    f"ToDateTime(DATETRUNC('{granularity}', "
                    + f"FromDateTime({{col}}, '{java_date_format}'), "
                    + f"'MILLISECONDS'), '{java_date_format}')"
                )
        else:
            time_expr = f"DATETIMECONVERT({{col}}, '{tf}', '{tf}', '{granularity}')"

        return TimestampExpression(time_expr, col)
