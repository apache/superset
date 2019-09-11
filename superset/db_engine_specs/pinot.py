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
# pylint: disable=C,R,W
from typing import Dict, List, Optional

from sqlalchemy.sql.expression import ColumnClause, ColumnElement

from superset.db_engine_specs.base import BaseEngineSpec, TimestampExpression


class PinotEngineSpec(BaseEngineSpec):
    engine = "pinot"
    allows_subqueries = False
    allows_joins = False
    allows_column_aliases = False

    # Pinot does its own conversion below
    _time_grain_functions: Dict[Optional[str], str] = {
        "PT1S": "1:SECONDS",
        "PT1M": "1:MINUTES",
        "PT1H": "1:HOURS",
        "P1D": "1:DAYS",
        "P1W": "1:WEEKS",
        "P1M": "1:MONTHS",
        "P0.25Y": "3:MONTHS",
        "P1Y": "1:YEARS",
    }

    @classmethod
    def get_timestamp_expr(
        cls, col: ColumnClause, pdf: Optional[str], time_grain: Optional[str]
    ) -> TimestampExpression:
        is_epoch = pdf in ("epoch_s", "epoch_ms")
        if not is_epoch:
            raise NotImplementedError("Pinot currently only supports epochs")
        # The DATETIMECONVERT pinot udf is documented at
        # Per https://github.com/apache/incubator-pinot/wiki/dateTimeConvert-UDF
        # We are not really converting any time units, just bucketing them.
        seconds_or_ms = "MILLISECONDS" if pdf == "epoch_ms" else "SECONDS"
        tf = f"1:{seconds_or_ms}:EPOCH"
        granularity = cls.get_time_grain_functions().get(time_grain)
        if not granularity:
            raise NotImplementedError("No pinot grain spec for " + str(time_grain))
        # In pinot the output is a string since there is no timestamp column like pg
        time_expr = f'DATETIMECONVERT({{col}}, "{tf}", "{tf}", "{granularity}")'
        return TimestampExpression(time_expr, col)

    @classmethod
    def make_select_compatible(
        cls, groupby_exprs: Dict[str, ColumnElement], select_exprs: List[ColumnElement]
    ) -> List[ColumnElement]:
        # Pinot does not want the group by expr's to appear in the select clause
        select_sans_groupby = []
        # We want identity and not equality, so doing the filtering manually
        for s in select_exprs:
            for gr in groupby_exprs:
                if s is gr:
                    break
            else:
                select_sans_groupby.append(s)
        return select_sans_groupby
