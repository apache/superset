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
from __future__ import annotations

import logging
from operator import eq, ge, gt, le, lt, ne
from timeit import default_timer
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd
from celery.exceptions import SoftTimeLimitExceeded
from flask_babel import lazy_gettext as _

from superset import app, jinja_context, security_manager
from superset.commands.base import BaseCommand
from superset.commands.report.exceptions import (
    AlertQueryError,
    AlertQueryInvalidTypeError,
    AlertQueryMultipleColumnsError,
    AlertQueryMultipleRowsError,
    AlertQueryTimeout,
    AlertValidatorConfigError,
)
from superset.reports.models import ReportSchedule, ReportScheduleValidatorType
from superset.tasks.utils import get_executor
from superset.utils import json
from superset.utils.core import override_user
from superset.utils.decorators import logs_context
from superset.utils.retries import retry_call

logger = logging.getLogger(__name__)


ALERT_SQL_LIMIT = 2
# All sql statements have an applied LIMIT,
# to avoid heavy loads done by a user mistake
OPERATOR_FUNCTIONS = {">=": ge, ">": gt, "<=": le, "<": lt, "==": eq, "!=": ne}


class AlertCommand(BaseCommand):
    def __init__(self, report_schedule: ReportSchedule, execution_id: UUID):
        self._report_schedule = report_schedule
        self._execution_id = execution_id
        self._result: float | None = None

    def run(self) -> bool:
        """
        Executes an alert SQL query and validates it.
        Will set the report_schedule.last_value or last_value_row_json
        with the query result

        :return: bool, if the alert triggered or not
        :raises AlertQueryError: SQL query is not valid
        :raises AlertQueryInvalidTypeError: The output from the SQL query
        is not an allowed type
        :raises AlertQueryMultipleColumnsError: The SQL query returned multiple columns
        :raises AlertQueryMultipleRowsError: The SQL query returned multiple rows
        :raises AlertQueryTimeout: The SQL query received a celery soft timeout
        :raises AlertValidatorConfigError: The validator query data is not valid
        """
        self.validate()

        if self._is_validator_not_null:
            self._report_schedule.last_value_row_json = str(self._result)
            return self._result not in (0, None, np.nan)
        self._report_schedule.last_value = self._result
        try:
            operator = json.loads(self._report_schedule.validator_config_json)["op"]
            threshold = json.loads(self._report_schedule.validator_config_json)[
                "threshold"
            ]
            return OPERATOR_FUNCTIONS[operator](self._result, threshold)  # type: ignore
        except (KeyError, json.JSONDecodeError) as ex:
            raise AlertValidatorConfigError() from ex

    def _validate_not_null(self, rows: np.recarray[Any, Any]) -> None:
        self._validate_result(rows)
        self._result = rows[0][1]

    @staticmethod
    def _validate_result(rows: np.recarray[Any, Any]) -> None:
        # check if query return more than one row
        if len(rows) > 1:
            raise AlertQueryMultipleRowsError(
                message=_(
                    "Alert query returned more than one row. %(num_rows)s rows returned",  # noqa: E501
                    num_rows=len(rows),
                )
            )
        # check if query returned more than one column
        if len(rows[0]) > 2:
            raise AlertQueryMultipleColumnsError(
                # len is subtracted by 1 to discard pandas index column
                _(
                    "Alert query returned more than one column. "
                    "%(num_cols)s columns returned",
                    num_cols=(len(rows[0]) - 1),
                )
            )

    def _validate_operator(self, rows: np.recarray[Any, Any]) -> None:
        self._validate_result(rows)
        if rows[0][1] in (0, None, np.nan):
            self._result = 0.0
            return
        try:
            # Check if it's float or if we can convert it
            self._result = float(rows[0][1])
            return
        except (AssertionError, TypeError, ValueError) as ex:
            raise AlertQueryInvalidTypeError() from ex

    @property
    def _is_validator_not_null(self) -> bool:
        return (
            self._report_schedule.validator_type == ReportScheduleValidatorType.NOT_NULL
        )

    @property
    def _is_validator_operator(self) -> bool:
        return (
            self._report_schedule.validator_type == ReportScheduleValidatorType.OPERATOR
        )

    def _get_alert_metadata_from_object(self) -> dict[str, Any]:
        return {
            "report_schedule_id": self._report_schedule.id,
            "execution_id": self._execution_id,
        }

    @logs_context(context_func=_get_alert_metadata_from_object)
    def _execute_query(self) -> pd.DataFrame:
        """
        Executes the actual alert SQL query template

        :return: A pandas dataframe
        :raises AlertQueryError: SQL query is not valid
        :raises AlertQueryTimeout: The SQL query received a celery soft timeout
        """
        sql_template = jinja_context.get_template_processor(
            database=self._report_schedule.database
        )
        rendered_sql = sql_template.process_template(self._report_schedule.sql)
        try:
            limited_rendered_sql = self._report_schedule.database.apply_limit_to_sql(
                rendered_sql, ALERT_SQL_LIMIT
            )

            if app.config["MUTATE_ALERT_QUERY"]:
                limited_rendered_sql = (
                    self._report_schedule.database.mutate_sql_based_on_config(
                        limited_rendered_sql
                    )
                )

            executor, username = get_executor(  # pylint: disable=unused-variable
                executors=app.config["ALERT_REPORTS_EXECUTORS"],
                model=self._report_schedule,
            )
            user = security_manager.find_user(username)
            with override_user(user):
                start = default_timer()
                df = self._report_schedule.database.get_df(sql=limited_rendered_sql)
                stop = default_timer()
                logger.info(
                    "Query for %s took %.2f ms",
                    self._report_schedule.name,
                    (stop - start) * 1000.0,
                )
                return df
        except SoftTimeLimitExceeded as ex:
            logger.warning("A timeout occurred while executing the alert query: %s", ex)
            raise AlertQueryTimeout() from ex
        except Exception as ex:
            logger.warning("An error occurred when running alert query")
            # The exception message here can reveal to much information to malicious
            # users, so we raise a generic message.
            raise AlertQueryError(
                message=_("An error occurred when running alert query")
            ) from ex

    def validate(self) -> None:
        """
        Validate the query result as a Pandas DataFrame
        """
        # When there are transient errors when executing queries, users will get
        # notified with the error stacktrace which can be avoided by retrying
        df = retry_call(
            self._execute_query,
            exception=AlertQueryError,
            max_tries=app.config["ALERT_REPORTS_QUERY_EXECUTION_MAX_TRIES"],
        )

        if df.empty and self._is_validator_not_null:
            self._result = None
            return
        if df.empty and self._is_validator_operator:
            self._result = 0.0
            return
        rows = df.to_records()
        if self._is_validator_not_null:
            self._validate_not_null(rows)
            return
        self._validate_operator(rows)
