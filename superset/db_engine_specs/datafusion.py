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

from datetime import datetime
from typing import Any

from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs import BaseEngineSpec
from superset.db_engine_specs.base import DatabaseCategory


def _date_bin(interval: str) -> str:
    # DataFusion rejects multiplying an interval by a Float64 (FLOOR(...)), so
    # sub-hour buckets use its native DATE_BIN with the Unix epoch as origin.
    return f"DATE_BIN(INTERVAL '{interval}', {{col}}, TIMESTAMP '1970-01-01 00:00:00')"


class DataFusionEngineSpec(BaseEngineSpec):
    engine_name = "Apache DataFusion"
    engine = "datafusion"
    drivers = {
        "flightsql": "Arrow Flight SQL protocol for DataFusion",
    }
    default_driver = "flightsql"
    sqlalchemy_uri_placeholder = "datafusion://host:port"
    supports_file_upload = False

    metadata = {
        "description": "DataFusion is a highly performant query engine",
        "logo": "datafusion.png",
        "homepage_url": "https://datafusion.apache.org/",
        "categories": [
            DatabaseCategory.QUERY_ENGINES,
            DatabaseCategory.OPEN_SOURCE,
            DatabaseCategory.APACHE_PROJECTS,
        ],
        "pypi_packages": ["flightsql-dbapi"],
        "connection_string": "datafusion://host:port",
        "drivers": [
            {
                "name": "Arrow Flight SQL (Recommended)",
                "pypi_package": "flightsql-dbapi",
                "connection_string": "datafusion://host:port",
                "is_recommended": True,
            }
        ],
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC('second', {col})",
        TimeGrain.FIVE_SECONDS: _date_bin("5 seconds"),
        TimeGrain.THIRTY_SECONDS: _date_bin("30 seconds"),
        TimeGrain.MINUTE: "DATE_TRUNC('minute', {col})",
        TimeGrain.FIVE_MINUTES: _date_bin("5 minutes"),
        TimeGrain.TEN_MINUTES: _date_bin("10 minutes"),
        TimeGrain.FIFTEEN_MINUTES: _date_bin("15 minutes"),
        TimeGrain.THIRTY_MINUTES: _date_bin("30 minutes"),
        TimeGrain.HOUR: "DATE_TRUNC('hour', {col})",
        TimeGrain.DAY: "DATE_TRUNC('day', {col})",
        TimeGrain.WEEK: "DATE_TRUNC('week', {col})",
        TimeGrain.MONTH: "DATE_TRUNC('month', {col})",
        TimeGrain.QUARTER: "DATE_TRUNC('quarter', {col})",
        TimeGrain.YEAR: "DATE_TRUNC('year', {col})",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        # DataFusion's to_timestamp()/to_date() take chrono format strings, not
        # Oracle/PostgreSQL ones, so render ANSI typed literals instead.
        if isinstance(sqla_type, types.Date) and not isinstance(
            sqla_type, types.DateTime
        ):
            return f"DATE '{dttm.date().isoformat()}'"
        if isinstance(sqla_type, types.DateTime):
            dttm_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            return f"TIMESTAMP '{dttm_formatted}'"
        return None
