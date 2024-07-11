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

import contextlib
import logging
from dataclasses import dataclass
from typing import Any, cast, TYPE_CHECKING

from flask import g
from sqlalchemy.orm.exc import DetachedInstanceError

from superset import is_feature_enabled
from superset.models.sql_lab import Query
from superset.sql_parse import CtasMethod
from superset.utils import core as utils, json
from superset.utils.core import apply_max_row_limit, get_user_id
from superset.utils.dates import now_as_float
from superset.views.utils import get_cta_schema_name

if TYPE_CHECKING:
    from superset.connectors.sqla.models import Database

logger = logging.getLogger(__name__)

SqlResults = dict[str, Any]


@dataclass
class SqlJsonExecutionContext:  # pylint: disable=too-many-instance-attributes
    database_id: int
    catalog: str | None
    schema: str
    sql: str
    template_params: dict[str, Any]
    async_flag: bool
    limit: int
    status: str
    client_id: str
    client_id_or_short_id: str
    sql_editor_id: str
    tab_name: str
    user_id: int | None
    expand_data: bool
    create_table_as_select: CreateTableAsSelect | None
    database: Database | None
    query: Query
    _sql_result: SqlResults | None

    def __init__(self, query_params: dict[str, Any]):
        self.create_table_as_select = None
        self.database = None
        self._init_from_query_params(query_params)
        self.user_id = get_user_id()
        self.client_id_or_short_id = cast(str, self.client_id or utils.shortid()[:10])

    def set_query(self, query: Query) -> None:
        self.query = query

    def _init_from_query_params(self, query_params: dict[str, Any]) -> None:
        self.database_id = cast(int, query_params.get("database_id"))
        self.catalog = cast(str, query_params.get("catalog"))
        self.schema = cast(str, query_params.get("schema"))
        self.sql = cast(str, query_params.get("sql"))
        self.template_params = self._get_template_params(query_params)
        self.async_flag = is_feature_enabled("SQLLAB_FORCE_RUN_ASYNC") or cast(
            bool, query_params.get("runAsync")
        )
        self.limit = self._get_limit_param(query_params)
        self.status = cast(str, query_params.get("status"))
        if cast(bool, query_params.get("select_as_cta")):
            self.create_table_as_select = CreateTableAsSelect.create_from(query_params)
        self.client_id = cast(str, query_params.get("client_id"))
        self.sql_editor_id = cast(str, query_params.get("sql_editor_id"))
        self.tab_name = cast(str, query_params.get("tab"))
        self.expand_data: bool = cast(
            bool,
            is_feature_enabled("PRESTO_EXPAND_DATA")
            and query_params.get("expand_data"),
        )

    @staticmethod
    def _get_template_params(query_params: dict[str, Any]) -> dict[str, Any]:
        try:
            template_params = json.loads(query_params.get("templateParams") or "{}")
        except json.JSONDecodeError:
            logger.warning(
                "Invalid template parameter %s specified. Defaulting to empty dict",
                str(query_params.get("templateParams")),
            )
            template_params = {}
        return template_params

    @staticmethod
    def _get_limit_param(query_params: dict[str, Any]) -> int:
        limit = apply_max_row_limit(query_params.get("queryLimit") or 0)
        if limit < 0:
            logger.warning(
                "Invalid limit of %i specified. Defaulting to max limit.", limit
            )
            limit = 0
        return limit

    def is_run_asynchronous(self) -> bool:
        return self.async_flag

    @property
    def select_as_cta(self) -> bool:
        return self.create_table_as_select is not None

    def set_database(self, database: Database) -> None:
        self._validate_db(database)
        self.database = database
        if self.select_as_cta:
            schema_name = self._get_ctas_target_schema_name(database)
            self.create_table_as_select.target_schema_name = schema_name  # type: ignore

    def _get_ctas_target_schema_name(self, database: Database) -> str | None:
        if database.force_ctas_schema:
            return database.force_ctas_schema
        return get_cta_schema_name(database, g.user, self.schema, self.sql)

    def _validate_db(self, database: Database) -> None:
        # TODO validate db.id is equal to self.database_id
        pass

    def get_execution_result(self) -> SqlResults | None:
        return self._sql_result

    def set_execution_result(self, sql_result: SqlResults | None) -> None:
        self._sql_result = sql_result

    def create_query(self) -> Query:
        start_time = now_as_float()
        if self.select_as_cta:
            return Query(
                database_id=self.database_id,
                sql=self.sql,
                catalog=self.catalog,
                schema=self.schema,
                select_as_cta=True,
                ctas_method=self.create_table_as_select.ctas_method,  # type: ignore
                start_time=start_time,
                tab_name=self.tab_name,
                status=self.status,
                limit=self.limit,
                sql_editor_id=self.sql_editor_id,
                tmp_table_name=self.create_table_as_select.target_table_name,  # type: ignore
                tmp_schema_name=self.create_table_as_select.target_schema_name,  # type: ignore
                user_id=self.user_id,
                client_id=self.client_id_or_short_id,
            )
        return Query(
            database_id=self.database_id,
            sql=self.sql,
            catalog=self.catalog,
            schema=self.schema,
            select_as_cta=False,
            start_time=start_time,
            tab_name=self.tab_name,
            limit=self.limit,
            status=self.status,
            sql_editor_id=self.sql_editor_id,
            user_id=self.user_id,
            client_id=self.client_id_or_short_id,
        )

    def get_query_details(self) -> str:
        with contextlib.suppress(DetachedInstanceError):
            if hasattr(self, "query"):
                if self.query.id:
                    return f"query '{self.query.id}' - '{self.query.sql}'"
        return f"query '{self.sql}'"


class CreateTableAsSelect:  # pylint: disable=too-few-public-methods
    ctas_method: CtasMethod
    target_schema_name: str | None
    target_table_name: str

    def __init__(
        self, ctas_method: CtasMethod, target_schema_name: str, target_table_name: str
    ):
        self.ctas_method = ctas_method
        self.target_schema_name = target_schema_name
        self.target_table_name = target_table_name

    @staticmethod
    def create_from(query_params: dict[str, Any]) -> CreateTableAsSelect:
        ctas_method = query_params.get("ctas_method", CtasMethod.TABLE)
        schema = cast(str, query_params.get("schema"))
        tmp_table_name = cast(str, query_params.get("tmp_table_name"))
        return CreateTableAsSelect(ctas_method, schema, tmp_table_name)
