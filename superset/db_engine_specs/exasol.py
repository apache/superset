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
from typing import Any, Optional

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory


class ExasolEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Engine spec for Exasol"""

    engine = "exa"
    engine_name = "Exasol"
    max_column_name_length = 128

    metadata = {
        "description": (
            "Exasol is a high-performance, in-memory, MPP analytical database."
        ),
        "logo": "exasol.png",
        "homepage_url": "https://www.exasol.com/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["sqlalchemy-exasol"],
        "connection_string": "exa+pyodbc://{username}:{password}@{dsn}",
        "default_port": 8563,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "dsn": "DSN name configured in odbc.ini",
        },
        "drivers": [
            {
                "name": "pyodbc",
                "pypi_package": "sqlalchemy-exasol",
                "connection_string": "exa+pyodbc://{username}:{password}@{dsn}",
                "is_recommended": True,
                "notes": "Requires ODBC driver and DSN configuration.",
            },
            {
                "name": "turbodbc",
                "pypi_package": "sqlalchemy-exasol[turbodbc]",
                "connection_string": "exa+turbodbc://{username}:{password}@{dsn}",
                "is_recommended": False,
                "notes": "Faster but requires additional dependencies.",
            },
            {
                "name": "websocket",
                "pypi_package": "sqlalchemy-exasol[websocket]",
                "connection_string": (
                    "exa+websocket://{username}:{password}@{host}:{port}/{schema}"
                ),
                "is_recommended": False,
                "notes": "Pure Python, no ODBC required.",
            },
        ],
    }

    # Exasol's DATE_TRUNC function is PostgresSQL compatible
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

    @classmethod
    def fetch_data(
        cls, cursor: Any, limit: Optional[int] = None
    ) -> list[tuple[Any, ...]]:
        data = super().fetch_data(cursor, limit)
        # Lists of `pyodbc.Row` need to be unpacked further
        return cls.pyodbc_rows_to_tuples(data)
