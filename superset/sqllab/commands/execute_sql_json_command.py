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
from typing import Any, Dict, Optional, TYPE_CHECKING
from flask import g
from flask_babel import gettext as __

from superset.exceptions import SupersetGenericErrorException
from superset.sqllab.limiting_factor import LimitingFactor
from superset.utils import core as utils
from superset.sqllab.execution_context import SqlJsonExecutionContext
from superset.sqllab.sql_json_executer import SqlJsonExecutor
from superset.commands.base import BaseCommand
from superset.utils.sql_query_results import get_cta_schema_name

import logging

if TYPE_CHECKING:
    from superset.models.sql_lab import Query
    from superset.models.core import Database
    from superset.queries.dao import QueryDAO
    from superset.databases.dao import DatabaseDAO

QueryStatus = utils.QueryStatus
logger = logging.getLogger(__name__)


class ExecuteSqlJsonCommand(BaseCommand):
    _access_validator: CanAccessQueryValidator
    _execution_context_convertor: ExecutionContextConvertor
    _sql_query_render: SqlQueryRender
    _query_dao: QueryDAO
    _database_dao: DatabaseDAO
    _sql_json_executor: SqlJsonExecutor
    _execution_context: SqlJsonExecutionContext
    _log_params: Optional[Dict[str, Any]]
    _sqllab_ctas_no_limit: bool

    def __init__(self,
                 access_validator: CanAccessQueryValidator,
                 execution_context_convertor: ExecutionContextConvertor,
                 sql_query_render: SqlQueryRender,
                 query_dao: QueryDAO,
                 database_dao: DatabaseDAO,
                 sql_json_executor: SqlJsonExecutor,
                 context: SqlJsonExecutionContext,
                 sqllab_ctas_no_limit_flag: bool,
                 log_params: Optional[Dict[str, Any]] = None) -> None:
        self._access_validator = access_validator
        self._execution_context_convertor = execution_context_convertor
        self._sql_query_render = sql_query_render
        self._query_dao = query_dao
        self._database_dao = database_dao
        self._sql_json_executor = sql_json_executor
        self._execution_context = context
        self._sqllab_ctas_no_limit = sqllab_ctas_no_limit_flag
        self._log_params = log_params

    def run(self) -> str:
        query: Query = self._try_get_existing_query()
        if query is not None and query.is_running():
            self._execution_context.query = query
        else:
            self._run_from_scratch()
        return self._execution_context_convertor.to_payload(self._execution_context)

    def _run_from_scratch(self) -> None:
        self._set_context_temp_schema_name()
        query = self._execution_context.build_query()
        self._query_dao.save(query)
        self._access_validator.validate(query)
        rendered_query = self._get_rendered_query()
        self._set_query_limits_if_required(rendered_query)
        self._sql_json_executor.execute(self._execution_context,
                                               rendered_query,
                                               self._log_params)

    def _get_associated_database(self) -> Database:
        rv_db = self._fetch_associated_database()
        self._validate_associated_database(rv_db)
        return rv_db

    def _fetch_associated_database(self) -> Optional[Database]:
        return self._database_dao.find_by_id(self._execution_context.database_id)

    def _validate_associated_database(self, db: Optional[Database]) -> None:
        if db is None:
            raise SupersetGenericErrorException(
                __(
                    "The database referenced in this query was not found. Please "
                    "contact an administrator for further assistance or try again."
                )
            )

    def _set_context_temp_schema_name(self) -> None:
        associated_db = self._get_associated_database()
        if self._execution_context.select_as_cta and associated_db.force_ctas_schema:
            self._execution_context.tmp_schema_name = associated_db.force_ctas_schema
        elif self._execution_context.select_as_cta:
            self._execution_context.tmp_schema_name = get_cta_schema_name(associated_db,
                                                                          g.user,
                                                                          self._execution_context.schema,
                                                                          self._execution_context.sql)

    def validate(self) -> None:
        pass

    def _try_get_existing_query(self) -> Optional[Query]:
        return self._query_dao.find_one_or_none(
            client_id=self._execution_context.client_id,
            user_id=self._execution_context.user_id,
            sql_editor_id=self._execution_context.sql_editor_id
        )

    def _get_rendered_query(self) -> str:
        try:
            return self._sql_query_render.render(self._execution_context)
        except Exception as ex:
            self._query_dao.update(self._execution_context.query)
            raise ex

    def _set_query_limits_if_required(self, rendered_query: str) -> None:
        if not (self._sqllab_ctas_no_limit and self._execution_context.select_as_cta):
            # set LIMIT after template processing
            self._set_query_limits(rendered_query)

    def _set_query_limits(self, rendered_query: str) -> None:
        query_model = self._execution_context.query
        limits = [self._execution_context.query.database.db_engine_spec.get_limit_from_sql(
            rendered_query),
            self._execution_context.limit]
        if limits[0] is None or limits[0] > limits[1]:
            query_model.limiting_factor = LimitingFactor.DROPDOWN
        elif limits[1] > limits[0]:
            query_model.limiting_factor = LimitingFactor.QUERY
        else:  # limits[0] == limits[1]
            query_model.limiting_factor = LimitingFactor.QUERY_AND_DROPDOWN
        query_model.limit = min(lim for lim in limits if lim is not None)


class CanAccessQueryValidator:
    def validate(self, query: Query) -> None:
        raise NotImplementedError()


class ExecutionContextConvertor:
    def to_payload(self, execution_context: SqlJsonExecutionContext) -> str:
        raise NotImplementedError()


class SqlQueryRender:
    def render(self, execution_context: SqlJsonExecutionContext) -> str:
        raise NotImplementedError()
