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
# pylint: disable=line-too-long
from __future__ import annotations

import dataclasses
import logging
from typing import Any, Dict, Optional

import simplejson as json
from flask import g
from flask_babel import gettext as __, ngettext
from jinja2.exceptions import TemplateError
from jinja2.meta import find_undeclared_variables
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.session import Session

from superset import app, db, is_feature_enabled, sql_lab
from superset.commands.base import BaseCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
    SupersetGenericDBErrorException,
    SupersetGenericErrorException,
    SupersetSecurityException,
    SupersetTemplateParamsErrorException,
    SupersetTimeoutException,
)
from superset.jinja_context import BaseTemplateProcessor, get_template_processor
from superset.models.core import Database
from superset.models.sql_lab import LimitingFactor, Query
from superset.queries.dao import QueryDAO
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.utils import core as utils
from superset.utils.dates import now_as_float
from superset.utils.sqllab_execution_context import SqlJsonExecutionContext
from superset.views.utils import apply_display_max_row_limit

config = app.config
QueryStatus = utils.QueryStatus
logger = logging.getLogger(__name__)

PARAMETER_MISSING_ERR = (
    "Please check your template parameters for syntax errors and make sure "
    "they match across your SQL query and Set Parameters. Then, try running "
    "your query again."
)

SqlResults = Dict[str, Any]

CommandResult = Dict[str, Any]


class ExecuteSqlCommand(BaseCommand):
    execution_context: SqlJsonExecutionContext
    log_params: Optional[Dict[str, Any]] = None
    session: Session

    def __init__(
        self,
        execution_context: SqlJsonExecutionContext,
        log_params: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.execution_context = execution_context
        self.log_params = log_params
        self.session = db.session()

    def validate(self) -> None:
        pass

    def run(  # pylint: disable=too-many-statements,useless-suppression
        self,
    ) -> CommandResult:
        """Runs arbitrary sql and returns data as json"""

        query = self._get_existing_query(self.execution_context, self.session)

        if self.is_query_handled(query):
            self.execution_context.set_query(query)  # type: ignore
            status = SqlJsonExecutionStatus.QUERY_ALREADY_CREATED
        else:
            status = self._run_sql_json_exec_from_scratch()

        return {
            "status": status,
            "payload": self._create_payload_from_execution_context(status),
        }

    @classmethod
    def _get_existing_query(
        cls, execution_context: SqlJsonExecutionContext, session: Session
    ) -> Optional[Query]:
        query = (
            session.query(Query)
            .filter_by(
                client_id=execution_context.client_id,
                user_id=execution_context.user_id,
                sql_editor_id=execution_context.sql_editor_id,
            )
            .one_or_none()
        )
        return query

    @classmethod
    def is_query_handled(cls, query: Optional[Query]) -> bool:
        return query is not None and query.status in [
            QueryStatus.RUNNING,
            QueryStatus.PENDING,
            QueryStatus.TIMED_OUT,
        ]

    def _run_sql_json_exec_from_scratch(self) -> SqlJsonExecutionStatus:
        self.execution_context.set_database(self._get_the_query_db())
        query = self.execution_context.create_query()
        try:
            self._save_new_query(query)
            logger.info("Triggering query_id: %i", query.id)
            self._validate_access(query)
            self.execution_context.set_query(query)
            rendered_query = self._render_query()

            self._set_query_limit_if_required(rendered_query)

            return self._execute_query(rendered_query)
        except Exception as ex:
            query.status = QueryStatus.FAILED
            self.session.commit()
            raise ex

    def _get_the_query_db(self) -> Database:
        mydb = self.session.query(Database).get(self.execution_context.database_id)
        self._validate_query_db(mydb)
        return mydb

    @classmethod
    def _validate_query_db(cls, database: Optional[Database]) -> None:
        if not database:
            raise SupersetGenericErrorException(
                __(
                    "The database referenced in this query was not found. Please "
                    "contact an administrator for further assistance or try again."
                )
            )

    def _save_new_query(self, query: Query) -> None:
        try:
            self.session.add(query)
            self.session.flush()
            self.session.commit()  # shouldn't be necessary
        except SQLAlchemyError as ex:
            logger.error("Errors saving query details %s", str(ex), exc_info=True)
            self.session.rollback()
        if not query.id:
            raise SupersetGenericErrorException(
                __(
                    "The query record was not created as expected. Please "
                    "contact an administrator for further assistance or try again."
                )
            )

    def _validate_access(self, query: Query) -> None:
        try:
            query.raise_for_access()
        except SupersetSecurityException as ex:
            query.set_extra_json_key("errors", [dataclasses.asdict(ex.error)])
            query.status = QueryStatus.FAILED
            query.error_message = ex.error.message
            self.session.commit()
            raise SupersetErrorException(ex.error, status=403) from ex

    def _render_query(self) -> str:
        def validate(
            rendered_query: str, template_processor: BaseTemplateProcessor
        ) -> None:
            if is_feature_enabled("ENABLE_TEMPLATE_PROCESSING"):
                # pylint: disable=protected-access
                ast = template_processor._env.parse(rendered_query)
                undefined_parameters = find_undeclared_variables(ast)  # type: ignore
                if undefined_parameters:
                    raise SupersetTemplateParamsErrorException(
                        message=ngettext(
                            "The parameter %(parameters)s in your query is undefined.",
                            "The following parameters in your query are undefined: %(parameters)s.",
                            len(undefined_parameters),
                            parameters=utils.format_list(undefined_parameters),
                        )
                        + " "
                        + PARAMETER_MISSING_ERR,
                        error=SupersetErrorType.MISSING_TEMPLATE_PARAMS_ERROR,
                        extra={
                            "undefined_parameters": list(undefined_parameters),
                            "template_parameters": self.execution_context.template_params,
                        },
                    )

        query = self.execution_context.query

        try:
            template_processor = get_template_processor(
                database=query.database, query=query
            )
            rendered_query = template_processor.process_template(
                query.sql, **self.execution_context.template_params
            )
            validate(rendered_query, template_processor)
        except TemplateError as ex:
            raise SupersetTemplateParamsErrorException(
                message=__(
                    'The query contains one or more malformed template parameters. Please check your query and confirm that all template parameters are surround by double braces, for example, "{{ ds }}". Then, try running your query again.'
                ),
                error=SupersetErrorType.INVALID_TEMPLATE_PARAMS_ERROR,
            ) from ex

        return rendered_query

    def _set_query_limit_if_required(self, rendered_query: str,) -> None:
        if self._is_required_to_set_limit():
            self._set_query_limit(rendered_query)

    def _is_required_to_set_limit(self) -> bool:
        return not (
            config.get("SQLLAB_CTAS_NO_LIMIT") and self.execution_context.select_as_cta
        )

    def _set_query_limit(self, rendered_query: str) -> None:
        db_engine_spec = self.execution_context.database.db_engine_spec  # type: ignore
        limits = [
            db_engine_spec.get_limit_from_sql(rendered_query),
            self.execution_context.limit,
        ]
        if limits[0] is None or limits[0] > limits[1]:  # type: ignore
            self.execution_context.query.limiting_factor = LimitingFactor.DROPDOWN
        elif limits[1] > limits[0]:  # type: ignore
            self.execution_context.query.limiting_factor = LimitingFactor.QUERY
        else:  # limits[0] == limits[1]
            self.execution_context.query.limiting_factor = (
                LimitingFactor.QUERY_AND_DROPDOWN
            )
        self.execution_context.query.limit = min(
            lim for lim in limits if lim is not None
        )

    def _execute_query(self, rendered_query: str,) -> SqlJsonExecutionStatus:
        # Flag for whether or not to expand data
        # (feature that will expand Presto row objects and arrays)
        # Async request.
        if self.execution_context.is_run_asynchronous():
            return self._sql_json_async(rendered_query)

        return self._sql_json_sync(rendered_query)

    def _sql_json_async(self, rendered_query: str,) -> SqlJsonExecutionStatus:
        """
        Send SQL JSON query to celery workers.
        :param rendered_query: the rendered query to perform by workers
        :return: A Flask Response
        """
        query = self.execution_context.query
        logger.info("Query %i: Running query on a Celery worker", query.id)
        # Ignore the celery future object and the request may time out.
        query_id = query.id
        try:
            task = sql_lab.get_sql_results.delay(
                query.id,
                rendered_query,
                return_results=False,
                store_results=not query.select_as_cta,
                user_name=g.user.username
                if g.user and hasattr(g.user, "username")
                else None,
                start_time=now_as_float(),
                expand_data=self.execution_context.expand_data,
                log_params=self.log_params,
            )

            # Explicitly forget the task to ensure the task metadata is removed from the
            # Celery results backend in a timely manner.
            try:
                task.forget()
            except NotImplementedError:
                logger.warning(
                    "Unable to forget Celery task as backend"
                    "does not support this operation"
                )
        except Exception as ex:
            logger.exception("Query %i: %s", query.id, str(ex))

            message = __("Failed to start remote query on a worker.")
            error = SupersetError(
                message=message,
                error_type=SupersetErrorType.ASYNC_WORKERS_ERROR,
                level=ErrorLevel.ERROR,
            )
            error_payload = dataclasses.asdict(error)

            query.set_extra_json_key("errors", [error_payload])
            query.status = QueryStatus.FAILED
            query.error_message = message
            self.session.commit()

            raise SupersetErrorException(error) from ex

        # Update saved query with execution info from the query execution
        QueryDAO.update_saved_query_exec_info(query_id)

        self.session.commit()
        return SqlJsonExecutionStatus.QUERY_IS_RUNNING

    def _sql_json_sync(self, rendered_query: str) -> SqlJsonExecutionStatus:
        """
        Execute SQL query (sql json).

        :param rendered_query: The rendered query (included templates)
        :raises: SupersetTimeoutException
        """
        query = self.execution_context.query
        try:
            timeout = config["SQLLAB_TIMEOUT"]
            timeout_msg = f"The query exceeded the {timeout} seconds timeout."
            query_id = query.id
            data = self._get_sql_results_with_timeout(
                timeout, rendered_query, timeout_msg,
            )
            # Update saved query if needed
            QueryDAO.update_saved_query_exec_info(query_id)
            self.execution_context.set_execution_result(data)
        except SupersetTimeoutException as ex:
            # re-raise exception for api exception handler
            raise ex
        except Exception as ex:
            logger.exception("Query %i failed unexpectedly", query.id)
            raise SupersetGenericDBErrorException(
                utils.error_msg_from_exception(ex)
            ) from ex

        if data is not None and data.get("status") == QueryStatus.FAILED:
            # new error payload with rich context
            if data["errors"]:
                raise SupersetErrorsException(
                    [SupersetError(**params) for params in data["errors"]]
                )
            # old string-only error message
            raise SupersetGenericDBErrorException(data["error"])
        return SqlJsonExecutionStatus.HAS_RESULTS

    def _get_sql_results_with_timeout(
        self, timeout: int, rendered_query: str, timeout_msg: str,
    ) -> Optional[SqlResults]:
        query = self.execution_context.query
        with utils.timeout(seconds=timeout, error_message=timeout_msg):
            # pylint: disable=no-value-for-parameter
            return sql_lab.get_sql_results(
                query.id,
                rendered_query,
                return_results=True,
                store_results=self._is_store_results(query),
                user_name=g.user.username
                if g.user and hasattr(g.user, "username")
                else None,
                expand_data=self.execution_context.expand_data,
                log_params=self.log_params,
            )

    @classmethod
    def _is_store_results(cls, query: Query) -> bool:
        return (
            is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE") and not query.select_as_cta
        )

    def _create_payload_from_execution_context(  # pylint: disable=invalid-name
        self, status: SqlJsonExecutionStatus,
    ) -> str:

        if status == SqlJsonExecutionStatus.HAS_RESULTS:
            return self._to_payload_results_based(
                self.execution_context.get_execution_result() or {}
            )
        return self._to_payload_query_based(self.execution_context.query)

    def _to_payload_results_based(  # pylint: disable=no-self-use
        self, execution_result: SqlResults
    ) -> str:
        display_max_row = config["DISPLAY_MAX_ROW"]
        return json.dumps(
            apply_display_max_row_limit(execution_result, display_max_row),
            default=utils.pessimistic_json_iso_dttm_ser,
            ignore_nan=True,
            encoding=None,
        )

    def _to_payload_query_based(  # pylint: disable=no-self-use
        self, query: Query
    ) -> str:
        return json.dumps(
            {"query": query.to_dict()},
            default=utils.json_int_dttm_ser,
            ignore_nan=True,
        )
