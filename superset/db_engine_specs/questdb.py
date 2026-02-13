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


class QuestDBEngineSpec(BaseEngineSpec):
    """
    Engine spec for QuestDB.

    QuestDB is a high-performance, open-source time-series database optimized
    for fast ingest and SQL queries.
    """

    engine = "questdb"
    engine_name = "QuestDB"
    default_driver = "questdb"

    metadata = {
        "description": (
            "QuestDB is a high-performance, open-source time-series database "
            "optimized for fast ingest and SQL queries."
        ),
        "logo": "questdb.png",
        "homepage_url": "https://questdb.io/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["questdb-connect"],
        "connection_string": "questdb://{username}:{password}@{host}:{port}/{database}",
        "default_port": 8812,
        "notes": (
            "QuestDB is optimized for time-series data. Install questdb-connect "
            "for SQLAlchemy support."
        ),
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "timestamp_floor('s', {col})",
        TimeGrain.MINUTE: "timestamp_floor('m', {col})",
        TimeGrain.HOUR: "timestamp_floor('h', {col})",
        TimeGrain.DAY: "timestamp_floor('d', {col})",
        TimeGrain.WEEK: "timestamp_floor('w', {col})",
        TimeGrain.MONTH: "timestamp_floor('M', {col})",
        TimeGrain.YEAR: "timestamp_floor('y', {col})",
    }
