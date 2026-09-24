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
from re import Pattern
from typing import Any, TYPE_CHECKING

from flask_babel import gettext as __

from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.errors import SupersetErrorType
from superset.utils import json

if TYPE_CHECKING:
    from superset.models.core import Database

# Whitespace and SQL comments ahead of the first keyword of a statement
LEADING_COMMENTS_REGEX = re.compile(
    r"^(?:\s+|--[^\n]*(?:\n|$)|/\*.*?\*/)+",
    re.DOTALL,
)

# D1 adds the offset and the SQLite result code after the column name
COLUMN_DOES_NOT_EXIST_REGEX = re.compile(
    r"no such column: (?P<column_name>.+?)(?: at offset \d+)?(?:: SQLITE_\w+)?$"
)


class CloudflareD1EngineSpec(SqliteEngineSpec):
    """Engine spec for Cloudflare D1 serverless SQLite database."""

    engine = "d1"
    engine_name = "Cloudflare D1"
    default_driver = "httpx"

    # The driver sends the API token to the host named by ``base_url``
    disallow_uri_query_params = {"httpx": {"base_url"}}

    # D1 has no transactions, so a failed upload would leave a half-written table
    supports_file_upload = False

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('We can\'t seem to resolve the column "%(column_name)s"'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }

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

    @classmethod
    def _extract_error_message(cls, ex: Exception) -> str:
        """
        Keep only D1's own message when the driver passes on the whole reply.

        On an HTTP error the DBAPI puts the JSON body of the D1 API reply in the
        exception, for example ``Execute failed: HTTP error 400: {"errors":
        [{"code": 7500, "message": "no such table: nope: SQLITE_ERROR"}], ...}``.
        """
        message = super()._extract_error_message(ex)
        start = message.find("{")
        if start == -1:
            return message

        try:
            reply = json.loads(message[start:])
        except json.JSONDecodeError:
            return message

        errors = reply.get("errors") if isinstance(reply, dict) else None
        if isinstance(errors, list) and errors and isinstance(errors[0], dict):
            return str(errors[0].get("message") or message)

        return message
