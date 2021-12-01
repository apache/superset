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
# pylint: disable=too-few-public-methods, too-many-arguments
from __future__ import annotations

import logging
from typing import Any, Dict, Optional, TYPE_CHECKING

from flask_babel import gettext as __

from superset.commands.base import BaseCommand
from superset.common.db_query_status import QueryStatus
from superset.dao.exceptions import DAOCreateFailedError
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetErrorsException, SupersetGenericErrorException
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.exceptions import (
    QueryIsForbiddenToAccessException,
    SqlLabException,
)
from superset.sqllab.limiting_factor import LimitingFactor

if TYPE_CHECKING:
    from superset.databases.dao import DatabaseDAO
    from superset.queries.dao import QueryDAO
    from superset.sqllab.sql_json_executer import SqlJsonExecutor
    from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext

logger = logging.getLogger(__name__)

CommandResult = Dict[str, Any]


class ExecuteSqlCommand(BaseCommand):
    _execution_context: SqlJsonExecutionContext
    _query_dao: QueryDAO
    _database_dao: DatabaseDAO
    _access_validator: CanAccessQueryValidator
    _sql_query_render: SqlQueryRender
    _sql_json_executor: SqlJsonExecutor
    _execution_context_convertor: ExecutionContextConvertor
    _sqllab_ctas_no_limit: bool
    _log_params: Optional[Dict[str, Any]] = None

    def __init__(
        self,
        execution_context: SqlJsonExecutionContext,
        query_dao: QueryDAO,
        database_dao: DatabaseDAO,
        access_validator: CanAccessQueryValidator,
        sql_query_render: SqlQueryRender,
        sql_json_executor: SqlJsonExecutor,
        execution_context_convertor: ExecutionContextConvertor,
        sqllab_ctas_no_limit_flag: bool,
        log_params: Optional[Dict[str, Any]] = None,
    ) -> None:
        self._execution_context = execution_context
        self._query_dao = query_dao
        self._database_dao = database_dao
        self._access_validator = access_validator
        self._sql_query_render = sql_query_render
        self._sql_json_executor = sql_json_executor
        self._execution_context_convertor = execution_context_convertor
        self._sqllab_ctas_no_limit = sqllab_ctas_no_limit_flag
        self._log_params = log_params

    def validate(self) -> None:
        pass

    def run(  # pylint: disable=too-many-statements,useless-suppression
        self,
    ) -> CommandResult:
        """Runs arbitrary sql and returns data as json"""
        try:
            query = self._try_get_existing_query()
            if self.is_query_handled(query):
                self._execution_context.set_query(query)  # type: ignore
                status = SqlJsonExecutionStatus.QUERY_ALREADY_CREATED
            else:
                status = self._run_sql_json_exec_from_scratch()
            return {
                "status": status,
                "payload": self._execution_context_convertor.to_payload(
                    self._execution_context, status
                ),
            }
        except (SqlLabException, SupersetErrorsException) as ex:
            raise ex
        except Exception as ex:
            raise SqlLabException(self._execution_context, exception=ex) from ex

    def _try_get_existing_query(self) -> Optional[Query]:
        return self._query_dao.find_one_or_none(
            client_id=self._execution_context.client_id,
            user_id=self._execution_context.user_id,
            sql_editor_id=self._execution_context.sql_editor_id,
        )

    @classmethod
    def is_query_handled(cls, query: Optional[Query]) -> bool:
        return query is not None and query.status in [
            QueryStatus.RUNNING,
            QueryStatus.PENDING,
            QueryStatus.TIMED_OUT,
        ]

    def _run_sql_json_exec_from_scratch(self) -> SqlJsonExecutionStatus:
        self._execution_context.set_database(self._get_the_query_db())
        query = self._execution_context.create_query()
        self._save_new_query(query)
        try:
            logger.info("Triggering query_id: %i", query.id)
            self._validate_access(query)
            self._execution_context.set_query(query)
            rendered_query = self._sql_query_render.render(self._execution_context)
            self._set_query_limit_if_required(rendered_query)
            return self._sql_json_executor.execute(
                self._execution_context, rendered_query, self._log_params
            )
        except Exception as ex:
            self._query_dao.update(query, {"status": QueryStatus.FAILED})
            raise ex

    def _get_the_query_db(self) -> Database:
        mydb = self._database_dao.find_by_id(self._execution_context.database_id)
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
            self._query_dao.save(query)
        except DAOCreateFailedError as ex:
            raise SqlLabException(
                self._execution_context,
                SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                "The query record was not created as expected",
                ex,
                "Please contact an administrator for further assistance or try again.",
            ) from ex

    def _validate_access(self, query: Query) -> None:
        try:
            self._access_validator.validate(query)
        except Exception as ex:
            raise QueryIsForbiddenToAccessException(self._execution_context, ex) from ex

    def _set_query_limit_if_required(self, rendered_query: str,) -> None:
        if self._is_required_to_set_limit():
            self._set_query_limit(rendered_query)

    def _is_required_to_set_limit(self) -> bool:
        return not (
            self._sqllab_ctas_no_limit and self._execution_context.select_as_cta
        )

    def _set_query_limit(self, rendered_query: str) -> None:
        db_engine_spec = self._execution_context.database.db_engine_spec  # type: ignore
        limits = [
            db_engine_spec.get_limit_from_sql(rendered_query),
            self._execution_context.limit,
        ]
        if limits[0] is None or limits[0] > limits[1]:  # type: ignore
            self._execution_context.query.limiting_factor = LimitingFactor.DROPDOWN
        elif limits[1] > limits[0]:  # type: ignore
            self._execution_context.query.limiting_factor = LimitingFactor.QUERY
        else:  # limits[0] == limits[1]
            self._execution_context.query.limiting_factor = (
                LimitingFactor.QUERY_AND_DROPDOWN
            )
        self._execution_context.query.limit = min(
            lim for lim in limits if lim is not None
        )


class CanAccessQueryValidator:
    def validate(self, query: Query) -> None:
        raise NotImplementedError()


class SqlQueryRender:
    def render(self, execution_context: SqlJsonExecutionContext) -> str:
        raise NotImplementedError()


class ExecutionContextConvertor:
    def to_payload(
        self,
        execution_context: SqlJsonExecutionContext,
        execution_status: SqlJsonExecutionStatus,
    ) -> str:
        raise NotImplementedError()
