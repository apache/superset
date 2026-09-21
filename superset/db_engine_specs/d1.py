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

import re
from typing import Any, TYPE_CHECKING

from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.sqlite import SqliteEngineSpec

if TYPE_CHECKING:
    from superset.models.core import Database

# Whitespace and SQL comments ahead of the first keyword of a statement
LEADING_COMMENTS_REGEX = re.compile(
    r"^(?:\s+|--[^\n]*(?:\n|$)|/\*.*?\*/)+",
    re.DOTALL,
)


class CloudflareD1EngineSpec(SqliteEngineSpec):
    """Engine spec for Cloudflare D1 serverless SQLite database."""

    engine = "d1"
    engine_name = "Cloudflare D1"
    default_driver = "d1"

    # The driver sends the API token to the host named by ``base_url``
    disallow_uri_query_params = {"httpx": {"base_url"}}

    metadata = {
        "description": "Cloudflare D1 is a serverless SQLite database.",
        "logo": "cloudflare.png",
        "homepage_url": "https://developers.cloudflare.com/d1/",
        "categories": [
            DatabaseCategory.CLOUD_DATA_WAREHOUSES,
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.HOSTED_OPEN_SOURCE,
        ],
        "pypi_packages": ["sqlalchemy-d1"],
        "connection_string": (
            "d1://{cloudflare_account_id}:{cloudflare_api_token}"
            "@{cloudflare_d1_database_id}"
        ),
        "parameters": {
            "cloudflare_account_id": "Cloudflare account ID",
            "cloudflare_api_token": "Cloudflare API token",
            "cloudflare_d1_database_id": "D1 database ID",
        },
        "install_instructions": 'pip install "apache-superset[d1]"',
        "version_requirements": (
            "sqlalchemy-d1 0.2.0 or later is required for SQLAlchemy 2. "
            "sqlalchemy-d1 0.1.0 pins SQLAlchemy below 2.0 and depends on the "
            "retired dbapi-d1 package."
        ),
    }

    @classmethod
    def execute(
        cls,
        cursor: Any,
        query: str,
        database: Database,
        **kwargs: Any,
    ) -> None:
        """
        Drop comments ahead of the statement before it reaches the driver.

        The DBAPI in sqlalchemy-cloudflare-d1 only reports column names when the
        statement text starts with SELECT, PRAGMA or WITH. A query with a leading
        comment, typed by a user or added by ``SQL_QUERY_MUTATOR``, comes back as
        rows without a cursor description. Every query path goes through here:
        SQL Lab, datasets made from SQL, charts and alerts.
        """
        stripped = LEADING_COMMENTS_REGEX.sub("", query, count=1)
        super().execute(cursor, stripped or query, database, **kwargs)
