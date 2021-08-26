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

import json
import logging
from dataclasses import dataclass
from typing import Any, cast, Dict, Optional

from flask import g

from superset import app, is_feature_enabled
from superset.sql_parse import CtasMethod
from superset.utils import core as utils

QueryStatus = utils.QueryStatus
logger = logging.getLogger(__name__)

SqlResults = Dict[str, Any]


@dataclass
class SqlJsonExecutionContext:  # pylint: disable=too-many-instance-attributes
    database_id: int
    schema: str
    sql: str
    template_params: Dict[str, Any]
    async_flag: bool
    limit: int
    status: str
    select_as_cta: bool
    ctas_method: CtasMethod
    tmp_table_name: str
    client_id: str
    client_id_or_short_id: str
    sql_editor_id: str
    tab_name: str
    user_id: Optional[int]
    expand_data: bool

    def __init__(self, query_params: Dict[str, Any]):
        self._init_from_query_params(query_params)
        self.user_id = self._get_user_id()
        self.client_id_or_short_id = cast(str, self.client_id or utils.shortid()[:10])

    def _init_from_query_params(self, query_params: Dict[str, Any]) -> None:
        self.database_id = cast(int, query_params.get("database_id"))
        self.schema = cast(str, query_params.get("schema"))
        self.sql = cast(str, query_params.get("sql"))
        self.template_params = self._get_template_params(query_params)
        self.async_flag = cast(bool, query_params.get("runAsync"))
        self.limit = self._get_limit_param(query_params)
        self.status = cast(str, query_params.get("status"))
        self.select_as_cta = cast(bool, query_params.get("select_as_cta"))
        self.ctas_method = cast(
            CtasMethod, query_params.get("ctas_method", CtasMethod.TABLE)
        )
        self.tmp_table_name = cast(str, query_params.get("tmp_table_name"))
        self.client_id = cast(str, query_params.get("client_id"))
        self.sql_editor_id = cast(str, query_params.get("sql_editor_id"))
        self.tab_name = cast(str, query_params.get("tab"))
        self.expand_data: bool = cast(
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

    def _get_user_id(self) -> Optional[int]:  # pylint: disable=R0201
        try:
            return g.user.get_id() if g.user else None
        except RuntimeError:
            return None

    def is_run_asynchronous(self) -> bool:
        return self.async_flag
