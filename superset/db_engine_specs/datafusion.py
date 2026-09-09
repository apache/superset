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
        TimeGrain.FIVE_SECONDS: "DATE_TRUNC('minute', {col}) + INTERVAL '5 seconds' * FLOOR(EXTRACT(SECOND FROM {col}) / 5)",  # noqa: E501
        TimeGrain.THIRTY_SECONDS: "DATE_TRUNC('minute', {col}) + INTERVAL '30 seconds' * FLOOR(EXTRACT(SECOND FROM {col}) / 30)",  # noqa: E501
        TimeGrain.MINUTE: "DATE_TRUNC('minute', {col})",
        TimeGrain.FIVE_MINUTES: "DATE_TRUNC('hour', {col}) + INTERVAL '5 minutes' * FLOOR(EXTRACT(MINUTE FROM {col}) / 5)",  # noqa: E501
        TimeGrain.TEN_MINUTES: "DATE_TRUNC('hour', {col}) + INTERVAL '10 minutes' * FLOOR(EXTRACT(MINUTE FROM {col}) / 10)",  # noqa: E501
        TimeGrain.FIFTEEN_MINUTES: "DATE_TRUNC('hour', {col}) + INTERVAL '15 minutes' * FLOOR(EXTRACT(MINUTE FROM {col}) / 15)",  # noqa: E501
        TimeGrain.THIRTY_MINUTES: "DATE_TRUNC('hour', {col}) + INTERVAL '30 minutes' * FLOOR(EXTRACT(MINUTE FROM {col}) / 30)",  # noqa: E501
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

        if isinstance(sqla_type, types.Date):
            return f"TO_DATE('{dttm.date().isoformat()}', 'YYYY-MM-DD')"
        if isinstance(sqla_type, types.DateTime):
            dttm_formatted = dttm.isoformat(sep=" ", timespec="milliseconds")
            return f"""TO_TIMESTAMP('{dttm_formatted}', 'YYYY-MM-DD HH24:MI:SS.FFF')"""
        return None
