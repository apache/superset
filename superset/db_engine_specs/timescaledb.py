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

from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


class TimescaleDBEngineSpec(PostgresBaseEngineSpec):
    """
    Engine spec for TimescaleDB.

    TimescaleDB is an open-source time-series database built on PostgreSQL.
    """

    engine = "timescaledb"
    engine_name = "TimescaleDB"
    default_driver = "psycopg2"

    metadata = {
        "description": (
            "TimescaleDB is an open-source relational database for time-series "
            "and analytics, built on PostgreSQL."
        ),
        "logo": "timescale.png",
        "homepage_url": "https://www.timescale.com/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["psycopg2"],
        "connection_string": (
            "postgresql://{username}:{password}@{host}:{port}/{database}"
        ),
        "default_port": 5432,
        "connection_examples": [
            {
                "description": "Timescale Cloud (SSL required)",
                "connection_string": (
                    "postgresql://{username}:{password}@{host}:{port}/"
                    "{database}?sslmode=require"
                ),
            },
        ],
        "notes": "Uses the PostgreSQL driver. psycopg2 comes bundled with Superset.",
        "docs_url": "https://docs.timescale.com/",
    }
