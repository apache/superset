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
from typing import Any, TypedDict

from flask_babel import gettext as __

from superset import app, db
from superset.commands.base import BaseCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetTimeoutException
from superset.jinja_context import get_template_processor
from superset.models.core import Database
from superset.utils import core as utils

config = app.config
SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT = config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"]
stats_logger = config["STATS_LOGGER"]

logger = logging.getLogger(__name__)


class EstimateQueryCostType(TypedDict):
    database_id: int
    sql: str
    template_params: dict[str, Any]
    catalog: str | None
    schema: str | None


class QueryEstimationCommand(BaseCommand):
    _database_id: int
    _sql: str
    _template_params: dict[str, Any]
    _schema: str
    _database: Database
    _catalog: str | None

    def __init__(self, params: EstimateQueryCostType) -> None:
        self._database_id = params["database_id"]
        self._sql = params.get("sql", "")
        self._template_params = params.get("template_params", {})
        self._schema = params.get("schema") or ""
        self._catalog = params.get("catalog")

    def validate(self) -> None:
        self._database = db.session.query(Database).get(self._database_id)
        if not self._database:
            raise SupersetErrorException(
                SupersetError(
                    message=__("The database could not be found"),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )

    def run(
        self,
    ) -> list[dict[str, Any]]:
        self.validate()

        sql = self._sql
        if self._template_params:
            template_processor = get_template_processor(self._database)
            sql = template_processor.process_template(sql, **self._template_params)

        timeout = SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT
        timeout_msg = f"The estimation exceeded the {timeout} seconds timeout."
        try:
            with utils.timeout(seconds=timeout, error_message=timeout_msg):
                cost = self._database.db_engine_spec.estimate_query_cost(
                    self._database,
                    self._catalog,
                    self._schema,
                    sql,
                    utils.QuerySource.SQL_LAB,
                )
        except SupersetTimeoutException as ex:
            logger.exception(ex)
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "The query estimation was killed after %(sqllab_timeout)s "
                        "seconds. It might be too complex, or the database might be "
                        "under heavy load.",
                        sqllab_timeout=SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT,
                    ),
                    error_type=SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=500,
            ) from ex

        spec = self._database.db_engine_spec
        query_cost_formatters: dict[str, Any] = app.config[
            "QUERY_COST_FORMATTERS_BY_ENGINE"
        ]
        query_cost_formatter = query_cost_formatters.get(
            spec.engine, spec.query_cost_formatter
        )
        cost = query_cost_formatter(cost)
        return cost
