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

import re
from datetime import datetime
from re import Pattern
from typing import Any, TYPE_CHECKING

from flask_babel import gettext as __
from sqlalchemy import types
from sqlalchemy.engine.reflection import Inspector

from superset.config import VERSION_STRING
from superset.constants import TimeGrain, USER_AGENT
from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import SupersetErrorType

if TYPE_CHECKING:
    # prevent circular imports
    from superset.models.core import Database


COLUMN_DOES_NOT_EXIST_REGEX = re.compile("no such column: (?P<column_name>.+)")


class DuckDBEngineSpec(BaseEngineSpec):
    engine = "duckdb"
    engine_name = "DuckDB"

    sqlalchemy_uri_placeholder = "duckdb:////path/to/duck.db"

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC('second', {col})",
        TimeGrain.MINUTE: "DATE_TRUNC('minute', {col})",
        TimeGrain.HOUR: "DATE_TRUNC('hour', {col})",
        TimeGrain.DAY: "DATE_TRUNC('day', {col})",
        TimeGrain.WEEK: "DATE_TRUNC('week', {col})",
        TimeGrain.MONTH: "DATE_TRUNC('month', {col})",
        TimeGrain.QUARTER: "DATE_TRUNC('quarter', {col})",
        TimeGrain.YEAR: "DATE_TRUNC('year', {col})",
    }

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('We can\'t seem to resolve the column "%(column_name)s"'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, (types.String, types.DateTime)):
            return f"""'{dttm.isoformat(sep=" ", timespec="microseconds")}'"""
        return None

    @classmethod
    def get_table_names(
        cls, database: Database, inspector: Inspector, schema: str | None
    ) -> set[str]:
        return set(inspector.get_table_names(schema))

    @staticmethod
    def get_extra_params(database: Database) -> dict[str, Any]:
        """
        Add a user agent to be used in the requests.
        """
        extra: dict[str, Any] = BaseEngineSpec.get_extra_params(database)
        engine_params: dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: dict[str, Any] = engine_params.setdefault("connect_args", {})
        config: dict[str, Any] = connect_args.setdefault("config", {})
        custom_user_agent = config.pop("custom_user_agent", "")
        delim = " " if custom_user_agent else ""
        user_agent = USER_AGENT.replace(" ", "-").lower()
        user_agent = f"{user_agent}/{VERSION_STRING}{delim}{custom_user_agent}"
        config.setdefault("custom_user_agent", user_agent)

        return extra


class MotherDuckEngineSpec(DuckDBEngineSpec):
    engine = "duckdb"
    engine_name = "MotherDuck"

    sqlalchemy_uri_placeholder = (
        "duckdb:///md:{database_name}?motherduck_token={SERVICE_TOKEN}"
    )
