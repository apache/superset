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


class HologresEngineSpec(PostgresBaseEngineSpec):
    """
    Engine spec for Alibaba Cloud Hologres.

    Hologres is fully compatible with PostgreSQL 11.
    """

    engine = "hologres"
    engine_name = "Hologres"
    default_driver = "psycopg2"

    metadata = {
        "description": (
            "Alibaba Cloud Hologres is a real-time interactive analytics service, "
            "fully compatible with PostgreSQL 11."
        ),
        "logo": "hologres.png",
        "homepage_url": "https://www.alibabacloud.com/product/hologres",
        "categories": [
            DatabaseCategory.CLOUD_DATA_WAREHOUSES,
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["psycopg2"],
        "connection_string": (
            "postgresql+psycopg2://{username}:{password}@{host}:{port}/{database}"
        ),
        "parameters": {
            "username": "AccessKey ID of your Alibaba Cloud account",
            "password": "AccessKey secret of your Alibaba Cloud account",
            "host": "Public endpoint of the Hologres instance",
            "port": "Port number of the Hologres instance",
            "database": "Name of the Hologres database",
        },
        "default_port": 80,
        "notes": "Uses the PostgreSQL driver. psycopg2 comes bundled with Superset.",
    }
