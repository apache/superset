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
import json
import logging
from operator import eq, ge, gt, le, lt, ne
from typing import Optional

import numpy as np
from flask_babel import lazy_gettext as _

from superset import jinja_context
from superset.commands.base import BaseCommand
from superset.models.reports import ReportSchedule, ReportScheduleValidatorType
from superset.reports.commands.exceptions import (
    AlertQueryError,
    AlertQueryInvalidTypeError,
    AlertQueryMultipleColumnsError,
    AlertQueryMultipleRowsError,
    AlertValidatorConfigError,
)

logger = logging.getLogger(__name__)


OPERATOR_FUNCTIONS = {">=": ge, ">": gt, "<=": le, "<": lt, "==": eq, "!=": ne}


class AlertCommand(BaseCommand):
    def __init__(self, report_schedule: ReportSchedule):
        self._report_schedule = report_schedule
        self._result: Optional[float] = None

    def run(self) -> bool:
        self.validate()

        if self._report_schedule.validator_type == ReportScheduleValidatorType.NOT_NULL:
            self._report_schedule.last_value_row_json = str(self._result)
            return self._result not in (0, None, np.nan)
        self._report_schedule.last_value = self._result
        try:
            operator = json.loads(self._report_schedule.validator_config_json)["op"]
            threshold = json.loads(self._report_schedule.validator_config_json)[
                "threshold"
            ]
            return OPERATOR_FUNCTIONS[operator](self._result, threshold)
        except (KeyError, json.JSONDecodeError):
            raise AlertValidatorConfigError()

    def _validate_not_null(self, rows: np.recarray) -> None:
        self._validate_result(rows)
        self._result = rows[0][1]

    @staticmethod
    def _validate_result(rows: np.recarray) -> None:
        # check if query return more then one row
        if len(rows) > 1:
            raise AlertQueryMultipleRowsError(
                message=_(
                    "Alert query returned more then one row. %s rows returned"
                    % len(rows),
                )
            )
        # check if query returned more then one column
        if len(rows[0]) > 2:
            raise AlertQueryMultipleColumnsError(
                # len is subtracted by 1 to discard pandas index column
                _(
                    "Alert query returned more then one column. %s columns returned"
                    % (len(rows[0]) - 1)
                )
            )

    def _validate_operator(self, rows: np.recarray) -> None:
        self._validate_result(rows)
        if rows[0][1] is None:
            return
        try:
            # Check if it's float or if we can convert it
            self._result = float(rows[0][1])
            return
        except (AssertionError, TypeError, ValueError):
            raise AlertQueryInvalidTypeError()

    def validate(self) -> None:
        """
        Validate the query result as a Pandas DataFrame
        """
        sql_template = jinja_context.get_template_processor(
            database=self._report_schedule.database
        )
        rendered_sql = sql_template.process_template(self._report_schedule.sql)
        try:
            df = self._report_schedule.database.get_df(rendered_sql)
        except Exception as ex:
            raise AlertQueryError(message=str(ex))

        if df.empty:
            return
        rows = df.to_records()
        if self._report_schedule.validator_type == ReportScheduleValidatorType.NOT_NULL:
            self._validate_not_null(rows)
            return
        self._validate_operator(rows)
