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


class YugabyteDBEngineSpec(PostgresBaseEngineSpec):
    """
    Engine spec for YugabyteDB.

    YugabyteDB is a distributed SQL database built on top of PostgreSQL.
    """

    engine = "yugabytedb"
    engine_name = "YugabyteDB"
    default_driver = "psycopg2"

    metadata = {
        "description": (
            "YugabyteDB is a distributed SQL database built on top of PostgreSQL."
        ),
        "logo": "yugabyte.png",
        "homepage_url": "https://www.yugabyte.com/",
        "categories": [
            DatabaseCategory.CLOUD_DATA_WAREHOUSES,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["psycopg2"],
        "connection_string": (
            "postgresql://{username}:{password}@{host}:{port}/{database}"
        ),
        "default_port": 5433,
        "notes": "Uses the PostgreSQL driver. psycopg2 comes bundled with Superset.",
        "docs_url": "https://docs.yugabyte.com/",
    }
