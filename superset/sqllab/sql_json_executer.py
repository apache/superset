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
import dataclasses
from abc import ABC
from typing import Any, Callable, Dict, Optional, TYPE_CHECKING
from superset import app, is_feature_enabled
from superset.errors import SupersetError, SupersetErrorType, ErrorLevel
from superset.exceptions import SupersetErrorException, SupersetTimeoutException, \
    SupersetGenericDBErrorException, SupersetErrorsException

from superset.utils import core as utils
from flask_babel import gettext as __
from flask import g
import logging

from superset.utils.dates import now_as_float

if TYPE_CHECKING:
    from superset.queries.dao import QueryDAO
    from superset.sqllab.execution_context import SqlJsonExecutionContext

QueryStatus = utils.QueryStatus
logger = logging.getLogger(__name__)

SqlResults = Optional[Dict[str, Any]]

GetSqlResultsTask = Callable[..., SqlResults]


class SqlJsonExecutor:
    def execute(self, execution_context: SqlJsonExecutionContext,
                rendered_query: str,
                log_params: Optional[Dict[str, Any]]) -> SqlJsonExecutionContext:
        raise NotImplementedError()


class SqlJsonExecutorBase(SqlJsonExecutor, ABC):
    _query_dao: QueryDAO
    _get_sql_results_task: GetSqlResultsTask

    def __init__(self, query_dao: QueryDAO, get_sql_results_task: GetSqlResultsTask):
        self._query_dao = query_dao
        self._get_sql_results_task = get_sql_results_task


class SynchronousSqlJsonExecutor(SqlJsonExecutorBase):

    def execute(self,
                execution_context: SqlJsonExecutionContext,
                rendered_query: str,
                log_params: Optional[Dict[str, Any]]) -> SqlJsonExecutionContext:
        query_id = execution_context.query.id
        try:
            timeout = app.config["SQLLAB_TIMEOUT"]
            timeout_msg = f"The query exceeded the {timeout} seconds timeout."
            store_results = (
                is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE")
                and not execution_context.select_as_cta
            )
            with utils.timeout(seconds=timeout, error_message=timeout_msg):
                # pylint: disable=no-value-for-parameter
                data = self._get_sql_results_task(
                    query_id,
                    rendered_query,
                    return_results=True,
                    store_results=store_results,
                    user_name=g.user.username
                    if g.user and hasattr(g.user, "username")
                    else None,
                    expand_data=execution_context.expand_data,
                    log_params=log_params,
                )
            self._query_dao.update_saved_query_exec_info(query_id)
            # payload = json.dumps(
            #     apply_display_max_row_limit(data, app.config["DISPLAY_MAX_ROW"]),
            #     default=utils.pessimistic_json_iso_dttm_ser,
            #     ignore_nan=True,
            #     encoding=None,
            # )
            execution_context.set_execution_result(data)
        except SupersetTimeoutException as ex:
        # re-raise exception for api exception handler
            raise ex
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Query %i failed unexpectedly", query_id)
            raise SupersetGenericDBErrorException(utils.error_msg_from_exception(ex))

        if data.get("status") == QueryStatus.FAILED:
            # new error payload with rich context
            if data["errors"]:
                raise SupersetErrorsException(
                    [SupersetError(**params) for params in data["errors"]]
                )
            # old string-only error message
            raise SupersetGenericDBErrorException(data["error"])

        return execution_context


class ASynchronousSqlJsonExecutor(SqlJsonExecutorBase):

    def execute(self, execution_context: SqlJsonExecutionContext, rendered_query: str,
                log_params: Optional[Dict[str, Any]]) -> SqlJsonExecutionContext:

        query_id = execution_context.query.id
        logger.info("Query %i: Running query on a Celery worker", query_id)
        try:
            task = self._get_sql_results_task.delay(
                query_id,
                rendered_query,
                return_results=False,
                store_results=not execution_context.select_as_cta,
                user_name=g.user.username
                if g.user and hasattr(g.user, "username")
                else None,
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
            # session.commit()
            raise SupersetErrorException(error)
        self._query_dao.update_saved_query_exec_info(query_id)
        return execution_context
