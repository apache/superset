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
from re import Pattern
from typing import Any, Optional

from flask_babel import gettext as __
from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import SupersetErrorType

SYNTAX_ERROR_REGEX = re.compile(
    ": mismatched input '(?P<syntax_error>.*?)'. Expecting: "
)


class AthenaEngineSpec(BaseEngineSpec):
    engine = "awsathena"
    engine_name = "Amazon Athena"
    allows_escaped_colons = False
    disable_ssh_tunneling = True

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "date_trunc('second', CAST({col} AS TIMESTAMP))",
        TimeGrain.MINUTE: "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        TimeGrain.HOUR: "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        TimeGrain.DAY: "date_trunc('day', CAST({col} AS TIMESTAMP))",
        TimeGrain.WEEK: "date_trunc('week', CAST({col} AS TIMESTAMP))",
        TimeGrain.MONTH: "date_trunc('month', CAST({col} AS TIMESTAMP))",
        TimeGrain.QUARTER: "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        TimeGrain.YEAR: "date_trunc('year', CAST({col} AS TIMESTAMP))",
        TimeGrain.WEEK_ENDING_SATURDAY: "date_add('day', 5, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
        TimeGrain.WEEK_STARTING_SUNDAY: "date_add('day', -1, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
    }

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        SYNTAX_ERROR_REGEX: (
            __(
                "Please check your query for syntax errors at or "
                'near "%(syntax_error)s". Then, try running your query again.'
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"DATE '{dttm.date().isoformat()}'"
        if isinstance(sqla_type, types.TIMESTAMP):
            datetime_formatted = dttm.isoformat(sep=" ", timespec="milliseconds")
            return f"""TIMESTAMP '{datetime_formatted}'"""
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @staticmethod
    def _mutate_label(label: str) -> str:
        """
        Athena only supports lowercase column names and aliases.

        :param label: Expected expression label
        :return: Conditionally mutated label
        """
        return label.lower()
