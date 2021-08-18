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
from typing import Any, Dict, cast, Type, TYPE_CHECKING, Optional
from flask import g

from superset.utils import core as utils
from superset.sql_parse import CtasMethod
from superset import app, is_feature_enabled
from superset.utils.dates import now_as_float

import logging
import json

if TYPE_CHECKING:
    from superset.models.sql_lab import Query

QueryStatus = utils.QueryStatus
logger = logging.getLogger(__name__)

SqlResults = Dict[str, Any]


class SqlJsonExecutionContext:
    _query_model_class: Type[Query]
    _database_id: int
    _schema: str
    _sql: str
    _template_params: Dict[str, Any]
    _async_flag: bool
    _limit: int
    _select_as_cta: bool
    _ctas_method: CtasMethod
    _tmp_table_name: str
    _client_id: str
    _client_id_or_short_id: str
    _sql_editor_id: str
    _tab_name: str
    _user_id: int
    _query: Query
    _expand_data: bool
    _sql_result: Optional[SqlResults]

    def __eq__(self, o: SqlJsonExecutionContext) -> bool:
        return self.database_id == o._database_id and self.status == o.status and \
                self._client_id == o._client_id and self._user_id == o._user_id and \
                self._query == o._query and self.get_execution_result() == \
               o.get_execution_result()

    @classmethod
    def set_query_model(cls, query_model_class: Type[Query]):
        cls._query_model_class = query_model_class

    def __new__(cls, *args, **kwargs):
        if cls._query_model_class is None:
            from superset.models.sql_lab import Query
            cls.set_query_model(Query)
        return super(SqlJsonExecutionContext, cls).__new__(cls)

    def __init__(self, query_params: Dict[str, Any]):
        self._sql_result = None
        self._init_from_query_params(query_params)
        self._user_id = self._get_user_id()
        self._client_id_or_short_id = cast(str, self._client_id or utils.shortid()[:10])

    def _init_from_query_params(self, query_params):
        self._database_id = cast(int, query_params.get("database_id"))
        self._schema = cast(str, query_params.get("schema"))
        self._sql = cast(str, query_params.get("sql"))
        self._template_params = self._get_template_params(query_params)
        self._async_flag = cast(bool, query_params.get("runAsync"))
        self._limit = self._get_limit_param(query_params)
        self._select_as_cta = cast(bool, query_params.get("select_as_cta"))
        self._ctas_method = cast(
            CtasMethod, query_params.get("ctas_method", CtasMethod.TABLE)
        )
        self._tmp_table_name = cast(str, query_params.get("tmp_table_name"))
        self._client_id = cast(str, query_params.get("client_id"))
        self._sql_editor_id = cast(str, query_params.get("sql_editor_id"))
        self._tab_name = cast(str, query_params.get("tab"))
        self._expand_data: bool = cast(
            bool,
            is_feature_enabled("PRESTO_EXPAND_DATA")
            and query_params.get("expand_data"),
        )

    @staticmethod
    def _get_template_params(query_params: Dict[str, Any]) -> Dict[str, Any]:
        try:
            template_params = json.loads(query_params.get("templateParams") or "{}")
        except json.JSONDecodeError:
            logger.warning(
                "Invalid template parameter %s" " specified. Defaulting to empty dict",
                str(query_params.get("templateParams")),
            )
            template_params = {}
        return template_params

    @staticmethod
    def _get_limit_param(query_params: Dict[str, Any]) -> int:
        limit: int = query_params.get("queryLimit") or app.config["SQL_MAX_ROW"]
        if limit < 0:
            logger.warning(
                "Invalid limit of %i specified. Defaulting to max limit.", limit
            )
            limit = 0
        return limit

    def _get_user_id(self) -> Optional[int]:
        try:
            return g.user.get_id() if g.user else None
        except RuntimeError:
            return None

    def build_query(self) -> Query:
        return self._query_model_class(
            database_id=self._database_id,
            sql=self._sql,
            schema=self._schema,
            select_as_cta=self._select_as_cta,
            ctas_method=self._ctas_method,
            start_time=now_as_float(),
            tab_name=self._tab_name,
            status=self._status,
            sql_editor_id=self._sql_editor_id,
            tmp_table_name=self._tmp_table_name,
            user_id=self._user_id,
            client_id=self._client_id_or_short_id,
        )

    def is_running(self) -> bool:
        return self._query is not None and self._query.is_running()

    def is_should_run_asynchronous(self) -> bool:
        return self._async_flag

    @property
    def database_id(self) -> int:
        return self._database_id

    @property
    def limit(self) -> int:
        return self._limit

    @property
    def schema(self) -> str:
        return self._schema

    @property
    def sql(self) -> str:
        return self._sql

    @property
    def template_params(self) -> Dict[str, Any]:
        return self._template_params

    @property
    def query(self) -> Query:
        if self.query is None:
            self._query = self.build_query()
        return self._query

    @query.setter
    def query(self, query: Query):
        self.query = query

    @property
    def client_id(self) -> str:
        return self._client_id

    @property
    def user_id(self) -> int:
        return self._user_id

    @property
    def sql_editor_id(self) -> str:
        return self._sql_editor_id

    @property
    def select_as_cta(self) -> bool:
        return self._select_as_cta

    @property
    def expand_data(self) -> bool:
        return self._expand_data

    @property
    def status(self) -> str:
        return self.query.status

    def get_execution_result(self) -> Optional[SqlResults]:
        return self._sql_result

    def set_execution_result(self, sql_result: SqlResults) -> None:
        self._sql_result = sql_result


