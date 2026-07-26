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
from typing import Any, Optional

from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory


class PhoenixEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Dialect for Apache Phoenix"""

    engine = "phoenix"
    engine_name = "Apache Phoenix"

    metadata = {
        "description": (
            "Apache Phoenix is a relational database layer over Apache HBase, "
            "providing low-latency SQL queries over HBase data."
        ),
        "logo": "apache-phoenix.png",
        "homepage_url": "https://phoenix.apache.org/",
        "categories": [
            DatabaseCategory.APACHE_PROJECTS,
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["phoenixdb"],
        "connection_string": "phoenix://{hostname}:{port}/",
        "default_port": 8765,
        "notes": (
            "Phoenix provides a SQL interface to Apache HBase. "
            "The phoenixdb driver connects via the Phoenix Query Server "
            "and supports a subset of SQLAlchemy."
        ),
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: (
            "CAST(TRUNC(CAST({col} AS TIMESTAMP), 'SECOND') AS TIMESTAMP)"
        ),
        TimeGrain.MINUTE: (
            "CAST(TRUNC(CAST({col} AS TIMESTAMP), 'MINUTE') AS TIMESTAMP)"
        ),
        TimeGrain.HOUR: ("CAST(TRUNC(CAST({col} AS TIMESTAMP), 'HOUR') AS TIMESTAMP)"),
        TimeGrain.DAY: "CAST(TRUNC(CAST({col} AS TIMESTAMP), 'DAY') AS DATE)",
        TimeGrain.WEEK: "CAST(TRUNC(CAST({col} AS TIMESTAMP), 'WEEK') AS DATE)",
        TimeGrain.MONTH: ("CAST(TRUNC(CAST({col} AS TIMESTAMP), 'MONTH') AS DATE)"),
        TimeGrain.QUARTER: ("CAST(TRUNC(CAST({col} AS TIMESTAMP), 'QUARTER') AS DATE)"),
        TimeGrain.YEAR: "CAST(TRUNC(CAST({col} AS TIMESTAMP), 'YEAR') AS DATE)",
    }

    @classmethod
    def convert_dttm(
        cls,
        target_type: str,
        dttm: datetime,
        db_extra: Optional[dict[str, Any]] = None,
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"TO_DATE('{dttm.date().isoformat()}', 'yyyy-MM-dd')"
        if isinstance(sqla_type, (types.DateTime, types.TIMESTAMP)):
            datetime_formatted = dttm.isoformat(sep=" ", timespec="seconds")
            return f"TO_TIMESTAMP('{datetime_formatted}', 'yyyy-MM-dd HH:mm:ss')"
        return None
