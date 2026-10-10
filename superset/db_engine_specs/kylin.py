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
from typing import Any, Optional

from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory


class KylinEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Dialect for Apache Kylin"""

    engine = "kylin"
    engine_name = "Apache Kylin"

    metadata = {
        "description": "Apache Kylin is an open-source OLAP engine for big data.",
        "logo": "apache-kylin.png",
        "homepage_url": "https://kylin.apache.org/",
        "categories": [
            DatabaseCategory.APACHE_PROJECTS,
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["kylinpy"],
        "connection_string": (
            "kylin://{username}:{password}@{hostname}:{port}/{project}"
            "?{param1}={value1}&{param2}={value2}"
        ),
        "default_port": 7070,
    }

    # Kylin validates every query with Calcite; queries no cube can answer are
    # pushed down as SQL text to Spark SQL. ``FLOOR(<ts> TO <unit>)`` cannot be
    # parsed by Spark, so the grains only use CAST, TIMESTAMPADD and field
    # functions, which both paths accept. Weeks start on Sunday (DAYOFWEEK is 1
    # for Sunday on both paths).
    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: (
            "TIMESTAMPADD(SECOND, HOUR({col}) * 3600 + MINUTE({col}) * 60"
            " + SECOND({col}), CAST(CAST({col} AS DATE) AS TIMESTAMP))"
        ),
        TimeGrain.MINUTE: (
            "TIMESTAMPADD(MINUTE, HOUR({col}) * 60 + MINUTE({col}),"
            " CAST(CAST({col} AS DATE) AS TIMESTAMP))"
        ),
        TimeGrain.HOUR: (
            "TIMESTAMPADD(HOUR, HOUR({col}), CAST(CAST({col} AS DATE) AS TIMESTAMP))"
        ),
        TimeGrain.DAY: "CAST({col} AS DATE)",
        TimeGrain.WEEK: (
            "TIMESTAMPADD(DAY, 1 - DAYOFWEEK({col}), CAST({col} AS DATE))"
        ),
        TimeGrain.MONTH: (
            "TIMESTAMPADD(DAY, 1 - DAYOFMONTH({col}), CAST({col} AS DATE))"
        ),
        TimeGrain.QUARTER: (
            "TIMESTAMPADD(MONTH, 3 * QUARTER({col}) - 3,"
            " TIMESTAMPADD(DAY, 1 - DAYOFYEAR({col}), CAST({col} AS DATE)))"
        ),
        TimeGrain.YEAR: (
            "TIMESTAMPADD(DAY, 1 - DAYOFYEAR({col}), CAST({col} AS DATE))"
        ),
    }

    @staticmethod
    def _mutate_label(label: str) -> str:
        """
        Kylin's Calcite resolves identifiers in GROUP BY and ORDER BY against
        SELECT aliases first. A time-grain column labelled with its source
        column's name (``<grain of "TS"> AS "TS" ... GROUP BY <grain of "TS">``)
        is then rejected as "not being grouped". Suffix every label so it never
        shadows the column it is derived from; Superset maps the result columns
        back to the expected labels.
        """
        return f"{label}__"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if isinstance(sqla_type, types.TIMESTAMP):
            datetime_formatted = dttm.isoformat(sep=" ", timespec="seconds")
            return f"""CAST('{datetime_formatted}' AS TIMESTAMP)"""
        return None
