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

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory


class MonetDbEngineSpec(BaseEngineSpec):
    """Engine spec for MonetDB

    MonetDB is an open-source column-oriented relational database management system
    designed for high performance on complex queries against large databases.
    """

    engine = "monetdb"
    engine_name = "MonetDB"
    default_driver = "pymonetdb"

    metadata = {
        "description": (
            "MonetDB is an open-source column-oriented relational database "
            "for high-performance analytics."
        ),
        "logo": "monet-db.png",
        "homepage_url": "https://www.monetdb.org/",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["sqlalchemy-monetdb", "pymonetdb"],
        "connection_string": "monetdb://{username}:{password}@{host}:{port}/{database}",
        "default_port": 50000,
        "parameters": {
            "username": "Database username (default: monetdb)",
            "password": "Database password (default: monetdb)",
            "host": "MonetDB server host",
            "port": "Default 50000",
            "database": "Database name",
        },
        "docs_url": "https://www.monetdb.org/documentation/",
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "CAST(FLOOR(EXTRACT(EPOCH FROM {col})) AS TIMESTAMP)",
        TimeGrain.MINUTE: (
            "CAST({col} AS TIMESTAMP) - "
            "CAST(EXTRACT(SECOND FROM {col}) AS INTERVAL SECOND)"
        ),
        TimeGrain.HOUR: (
            "CAST({col} AS TIMESTAMP) - "
            "CAST(EXTRACT(MINUTE FROM {col}) AS INTERVAL MINUTE) - "
            "CAST(EXTRACT(SECOND FROM {col}) AS INTERVAL SECOND)"
        ),
        TimeGrain.DAY: "CAST({col} AS DATE)",
        TimeGrain.MONTH: (
            "CAST(EXTRACT(YEAR FROM {col}) || '-' || "
            "LPAD(CAST(EXTRACT(MONTH FROM {col}) AS VARCHAR), 2, '0') || '-01' AS DATE)"
        ),
        TimeGrain.YEAR: "CAST(EXTRACT(YEAR FROM {col}) || '-01-01' AS DATE)",
    }
