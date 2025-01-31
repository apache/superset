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

from datetime import datetime
from typing import Any, TYPE_CHECKING

from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec

if TYPE_CHECKING:
    from superset.connectors.sqla.models import TableColumn
    from superset.models.core import Database


class ParseableEngineSpec(BaseEngineSpec):
    """Engine spec for Parseable log analytics database."""

    engine = "parseable"
    engine_name = "Parseable"

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "date_trunc('second', {col})",
        TimeGrain.MINUTE: "date_trunc('minute', {col})",
        TimeGrain.HOUR: "date_trunc('hour', {col})",
        TimeGrain.DAY: "date_trunc('day', {col})",
        TimeGrain.WEEK: "date_trunc('week', {col})",
        TimeGrain.MONTH: "date_trunc('month', {col})",
        TimeGrain.QUARTER: "date_trunc('quarter', {col})",
        TimeGrain.YEAR: "date_trunc('year', {col})",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "to_timestamp({col})"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "to_timestamp({col} / 1000)"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.TIMESTAMP):
            return f"'{dttm.strftime('%Y-%m-%dT%H:%M:%S.000')}'"
        return None

    @classmethod
    def alter_new_orm_column(cls, orm_col: TableColumn) -> None:
        """Handle p_timestamp column specifically for Parseable."""
        if orm_col.column_name == "p_timestamp":
            orm_col.python_date_format = "epoch_ms"
            orm_col.is_dttm = True

    @classmethod
    def get_extra_params(cls, database: Database) -> dict[str, Any]:
        """Additional parameters for Parseable connections."""
        return {
            "engine_params": {
                "connect_args": {
                    "timeout": 300,  # 5 minutes timeout
                }
            }
        }
