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
# pylint: disable=too-few-public-methods, invalid-name
from __future__ import annotations

import dataclasses
import logging
from abc import ABC
from typing import Any, Callable, TYPE_CHECKING

from flask_babel import gettext as __

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
    SupersetGenericDBErrorException,
    SupersetTimeoutException,
)
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.utils import core as utils
from superset.utils.core import get_username
from superset.utils.dates import now_as_float

if TYPE_CHECKING:
    from superset.daos.query import QueryDAO
    from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext

QueryStatus = utils.QueryStatus
logger = logging.getLogger(__name__)

SqlResults = dict[str, Any]

GetSqlResultsTask = Callable[..., SqlResults]


class SqlJsonExecutor:
    def execute(
        self,
        execution_context: SqlJsonExecutionContext,
        rendered_query: str,
        log_params: dict[str, Any] | None,
    ) -> SqlJsonExecutionStatus:
        raise NotImplementedError()


class SqlJsonExecutorBase(SqlJsonExecutor, ABC):
    _query_dao: QueryDAO
    _get_sql_results_task: GetSqlResultsTask

    def __init__(self, query_dao: QueryDAO, get_sql_results_task: GetSqlResultsTask):
        self._query_dao = query_dao
        self._get_sql_results_task = get_sql_results_task


class SynchronousSqlJsonExecutor(SqlJsonExecutorBase):
    _timeout_duration_in_seconds: int
    _sqllab_backend_persistence_feature_enable: bool

    def __init__(
        self,
        query_dao: QueryDAO,
        get_sql_results_task: GetSqlResultsTask,
        timeout_duration_in_seconds: int,
        sqllab_backend_persistence_feature_enable: bool,
    ):
        super().__init__(query_dao, get_sql_results_task)
        self._timeout_duration_in_seconds = timeout_duration_in_seconds
        self._sqllab_backend_persistence_feature_enable = (
            sqllab_backend_persistence_feature_enable
        )

    def execute(
        self,
        execution_context: SqlJsonExecutionContext,
        rendered_query: str,
        log_params: dict[str, Any] | None,
    ) -> SqlJsonExecutionStatus:
        query_id = execution_context.query.id
        try:
            data = self._get_sql_results_with_timeout(
                execution_context, rendered_query, log_params
            )
            execution_context.set_execution_result(data)
        except SupersetTimeoutException:
            raise
        except Exception as ex:
            logger.exception("Query %i failed unexpectedly", query_id)
            raise SupersetGenericDBErrorException(
                utils.error_msg_from_exception(ex)
            ) from ex

        if data.get("status") == QueryStatus.FAILED:  # type: ignore
            # new error payload with rich context
            if data["errors"]:  # type: ignore
                raise SupersetErrorsException(
                    [SupersetError(**params) for params in data["errors"]]  # type: ignore
                )
            # old string-only error message
            print(data)
            raise SupersetGenericDBErrorException(data["error"])  # type: ignore

        return SqlJsonExecutionStatus.HAS_RESULTS

    def _get_sql_results_with_timeout(
        self,
        execution_context: SqlJsonExecutionContext,
        rendered_query: str,
        log_params: dict[str, Any] | None,
    ) -> SqlResults | None:
        with utils.timeout(
            seconds=self._timeout_duration_in_seconds,
            error_message=self._get_timeout_error_msg(),
        ):
            return self._get_sql_results(execution_context, rendered_query, log_params)

    def _get_sql_results(
        self,
        execution_context: SqlJsonExecutionContext,
        rendered_query: str,
        log_params: dict[str, Any] | None,
    ) -> SqlResults | None:
        return self._get_sql_results_task(
            execution_context.query.id,
            rendered_query,
            return_results=True,
            store_results=self._is_store_results(execution_context),
            username=get_username(),
            expand_data=execution_context.expand_data,
            log_params=log_params,
        )

    def _is_store_results(self, execution_context: SqlJsonExecutionContext) -> bool:
        return (
            self._sqllab_backend_persistence_feature_enable
            and not execution_context.select_as_cta
        )

    def _get_timeout_error_msg(self) -> str:
        return (
            f"The query exceeded the {self._timeout_duration_in_seconds} "
            "seconds timeout."
        )


class ASynchronousSqlJsonExecutor(SqlJsonExecutorBase):
    def execute(
        self,
        execution_context: SqlJsonExecutionContext,
        rendered_query: str,
        log_params: dict[str, Any] | None,
    ) -> SqlJsonExecutionStatus:
        query_id = execution_context.query.id
        logger.info("Query %i: Running query on a Celery worker", query_id)
        try:
            task = self._get_sql_results_task.delay(  # type: ignore
                query_id,
                rendered_query,
                return_results=False,
                store_results=not execution_context.select_as_cta,
                username=get_username(),
                start_time=now_as_float(),
                expand_data=execution_context.expand_data,
                log_params=log_params,
            )
            try:
                task.forget()
            except NotImplementedError:
                logger.warning(
                    "Unable to forget Celery task as backend"
                    "does not support this operation"
                )
        except Exception as ex:
            logger.exception("Query %i: %s", query_id, str(ex))

            message = __("Failed to start remote query on a worker.")
            error = SupersetError(
                message=message,
                error_type=SupersetErrorType.ASYNC_WORKERS_ERROR,
                level=ErrorLevel.ERROR,
            )
            error_payload = dataclasses.asdict(error)
            query = execution_context.query
            query.set_extra_json_key("errors", [error_payload])
            query.status = QueryStatus.FAILED
            query.error_message = message
            raise SupersetErrorException(error) from ex
        return SqlJsonExecutionStatus.QUERY_IS_RUNNING
