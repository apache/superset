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
from typing import Any
from urllib import parse

from sqlalchemy import types
from sqlalchemy.engine.url import URL

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.exceptions import SupersetDBAPIProgrammingError


class DrillEngineSpec(BaseEngineSpec):
    """Engine spec for Apache Drill"""

    engine = "drill"
    engine_name = "Apache Drill"
    default_driver = "sadrill"

    supports_dynamic_schema = True

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "NEARESTDATE({col}, 'SECOND')",
        TimeGrain.MINUTE: "NEARESTDATE({col}, 'MINUTE')",
        TimeGrain.FIFTEEN_MINUTES: "NEARESTDATE({col}, 'QUARTER_HOUR')",
        TimeGrain.THIRTY_MINUTES: "NEARESTDATE({col}, 'HALF_HOUR')",
        TimeGrain.HOUR: "NEARESTDATE({col}, 'HOUR')",
        TimeGrain.DAY: "NEARESTDATE({col}, 'DAY')",
        TimeGrain.WEEK: "NEARESTDATE({col}, 'WEEK_SUNDAY')",
        TimeGrain.MONTH: "NEARESTDATE({col}, 'MONTH')",
        TimeGrain.QUARTER: "NEARESTDATE({col}, 'QUARTER')",
        TimeGrain.YEAR: "NEARESTDATE({col}, 'YEAR')",
    }

    # Returns a function to convert a Unix timestamp in milliseconds to a date
    @classmethod
    def epoch_to_dttm(cls) -> str:
        return cls.epoch_ms_to_dttm().replace("{col}", "({col}*1000)")

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "TO_DATE({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"TO_DATE('{dttm.date().isoformat()}', 'yyyy-MM-dd')"
        if isinstance(sqla_type, types.TIMESTAMP):
            datetime_formatted = dttm.isoformat(sep=" ", timespec="seconds")
            return f"""TO_TIMESTAMP('{datetime_formatted}', 'yyyy-MM-dd HH:mm:ss')"""
        return None

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: str | None = None,
        schema: str | None = None,
    ) -> tuple[URL, dict[str, Any]]:
        if schema:
            uri = uri.set(database=parse.quote(schema.replace(".", "/"), safe=""))

        return uri, connect_args

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> str | None:
        """
        Return the configured schema.
        """
        return parse.unquote(sqlalchemy_uri.database).replace("/", ".")

    @classmethod
    def get_url_for_impersonation(
        cls,
        url: URL,
        impersonate_user: bool,
        username: str | None,
        access_token: str | None,
    ) -> URL:
        """
        Return a modified URL with the username set.

        :param url: SQLAlchemy URL object
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        """
        if impersonate_user and username is not None:
            if url.drivername == "drill+odbc":
                url = url.update_query_dict({"DelegationUID": username})
            elif url.drivername in ["drill+sadrill", "drill+jdbc"]:
                url = url.update_query_dict({"impersonation_target": username})
            else:
                raise SupersetDBAPIProgrammingError(
                    f"impersonation is not supported for {url.drivername}"
                )

        return url

    @classmethod
    def fetch_data(
        cls,
        cursor: Any,
        limit: int | None = None,
    ) -> list[tuple[Any, ...]]:
        """
        Custom `fetch_data` for Drill.

        When no rows are returned, Drill raises a `RuntimeError` with the message
        "generator raised StopIteration". This method catches the exception and
        returns an empty list instead.
        """
        try:
            return super().fetch_data(cursor, limit)
        except RuntimeError as ex:
            if str(ex) == "generator raised StopIteration":
                return []
            raise
