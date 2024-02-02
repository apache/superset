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
from datetime import datetime
from typing import Any, TYPE_CHECKING

from sqlalchemy import types

from superset import is_feature_enabled
from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.exceptions import SupersetDBAPIConnectionError
from superset.exceptions import SupersetException
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.connectors.sqla.models import TableColumn
    from superset.models.core import Database

logger = logging.getLogger()


class DruidEngineSpec(BaseEngineSpec):
    """Engine spec for Druid.io"""

    engine = "druid"
    engine_name = "Apache Druid"
    allows_joins = is_feature_enabled("DRUID_JOINS")
    allows_subqueries = True

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT1S')",
        TimeGrain.FIVE_SECONDS: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT5S')",
        TimeGrain.THIRTY_SECONDS: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT30S')",
        TimeGrain.MINUTE: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT1M')",
        TimeGrain.FIVE_MINUTES: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT5M')",
        TimeGrain.TEN_MINUTES: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT10M')",
        TimeGrain.FIFTEEN_MINUTES: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT15M')",
        TimeGrain.THIRTY_MINUTES: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT30M')",
        TimeGrain.HOUR: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT1H')",
        TimeGrain.SIX_HOURS: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'PT6H')",
        TimeGrain.DAY: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'P1D')",
        TimeGrain.WEEK: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'P1W')",
        TimeGrain.MONTH: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'P1M')",
        TimeGrain.QUARTER: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'P3M')",
        TimeGrain.YEAR: "TIME_FLOOR(CAST({col} AS TIMESTAMP), 'P1Y')",
        TimeGrain.WEEK_ENDING_SATURDAY: (
            "TIME_SHIFT(TIME_FLOOR(TIME_SHIFT(CAST({col} AS TIMESTAMP), "
            "'P1D', 1), 'P1W'), 'P1D', 5)"
        ),
        TimeGrain.WEEK_STARTING_SUNDAY: (
            "TIME_SHIFT(TIME_FLOOR(TIME_SHIFT(CAST({col} AS TIMESTAMP), "
            "'P1D', 1), 'P1W'), 'P1D', -1)"
        ),
    }

    @classmethod
    def alter_new_orm_column(cls, orm_col: TableColumn) -> None:
        if orm_col.column_name == "__time":
            orm_col.is_dttm = True

    @staticmethod
    def get_extra_params(database: Database) -> dict[str, Any]:
        """
        For Druid, the path to a SSL certificate is placed in `connect_args`.

        :param database: database instance from which to extract extras
        :raises CertificateException: If certificate is not valid/unparseable
        :raises SupersetException: If database extra json payload is unparseable
        """
        try:
            extra = json.loads(database.extra or "{}")
        except json.JSONDecodeError as ex:
            raise SupersetException("Unable to parse database extras") from ex

        if database.server_cert:
            engine_params = extra.get("engine_params", {})
            connect_args = engine_params.get("connect_args", {})
            connect_args["scheme"] = "https"
            path = utils.create_ssl_cert_file(database.server_cert)
            connect_args["ssl_verify_cert"] = path
            engine_params["connect_args"] = connect_args
            extra["engine_params"] = engine_params
        return extra

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"CAST(TIME_PARSE('{dttm.date().isoformat()}') AS DATE)"
        if isinstance(sqla_type, (types.DateTime, types.TIMESTAMP)):
            return f"""TIME_PARSE('{dttm.isoformat(timespec="seconds")}')"""
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        """
        Convert from number of seconds since the epoch to a timestamp.
        """
        return "MILLIS_TO_TIMESTAMP({col} * 1000)"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        """
        Convert from number of milliseconds since the epoch to a timestamp.
        """
        return "MILLIS_TO_TIMESTAMP({col})"

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        # pylint: disable=import-outside-toplevel
        from requests import exceptions as requests_exceptions

        return {
            requests_exceptions.ConnectionError: SupersetDBAPIConnectionError,
        }
