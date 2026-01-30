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
from superset.db_engine_specs.sqlite import SqliteEngineSpec


class CloudflareD1EngineSpec(SqliteEngineSpec):
    """Engine spec for Cloudflare D1 serverless SQLite database."""

    engine = "d1"
    engine_name = "Cloudflare D1"
    default_driver = "d1"

    metadata = {
        "description": "Cloudflare D1 is a serverless SQLite database.",
        "logo": "cloudflare.png",
        "homepage_url": "https://developers.cloudflare.com/d1/",
        "categories": [
            DatabaseCategory.CLOUD_DATA_WAREHOUSES,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.HOSTED_OPEN_SOURCE,
        ],
        "pypi_packages": ["superset-engine-d1"],
        "connection_string": (
            "d1://{cloudflare_account_id}:{cloudflare_api_token}"
            "@{cloudflare_d1_database_id}"
        ),
        "parameters": {
            "cloudflare_account_id": "Cloudflare account ID",
            "cloudflare_api_token": "Cloudflare API token",
            "cloudflare_d1_database_id": "D1 database ID",
        },
        "install_instructions": "pip install superset-engine-d1",
    }
