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
"""MongoDB engine spec for Superset.

Uses PyMongoSQL (https://github.com/passren/PyMongoSQL) as the SQLAlchemy dialect
to enable SQL queries on MongoDB collections.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

from sqlalchemy import types
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.engine.url import URL

from superset.constants import TimeGrain
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.sql.parse import Table

if TYPE_CHECKING:
    from superset.models.core import Database


class MongoDBEngineSpec(BaseEngineSpec):
    """Engine spec for MongoDB using PyMongoSQL dialect."""

    engine = "mongodb"
    engine_name = "MongoDB"
    force_column_alias_quotes = False

    # A MongoDB database is exposed as a SQLAlchemy schema. PyMongoSQL always runs a
    # query against the database in the connection URI and treats the whole FROM
    # reference as the collection name, so the schema is selected by swapping the
    # database in the URI rather than by qualifying the collection.
    supports_dynamic_schema = True

    metadata = {
        "description": ("MongoDB is a document-oriented, operational NoSQL database."),
        "logo": "mongodb.png",
        "homepage_url": "https://www.mongodb.com/",
        "categories": [
            DatabaseCategory.SEARCH_NOSQL,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["pymongosql"],
        "connection_string": (
            "mongodb://{username}:{password}@{host}:{port}/{database}?mode=superset"
        ),
        "parameters": {
            "username": "Username for MongoDB",
            "password": "Password for MongoDB",
            "host": "MongoDB host",
            "port": "MongoDB port",
            "database": "Database name",
        },
        "drivers": [
            {
                "name": "MongoDB Atlas Cloud",
                "pypi_package": "pymongosql",
                "connection_string": "mongodb+srv://{username}:{password}@{host}/{database}?mode=superset",
                "notes": "For MongoDB Atlas cloud service.",
                "is_recommended": True,
            },
            {
                "name": "MongoDB Cluster",
                "pypi_package": "pymongosql",
                "connection_string": "mongodb://{username}:{password}@{host}:{port}/{database}?mode=superset",
                "is_recommended": False,
                "notes": ("For self-hosted MongoDB instances."),
            },
        ],
        "notes": "Uses PartiQL for SQL queries. Requires mode=superset parameter.",
        "docs_url": "https://github.com/passren/PyMongoSQL",
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:%S', {col}))",
        TimeGrain.MINUTE: "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}))",
        TimeGrain.HOUR: "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}))",
        TimeGrain.DAY: "DATETIME({col}, 'start of day')",
        TimeGrain.WEEK: (
            "DATETIME({col}, 'start of day', -strftime('%w', {col}) || ' days')"
        ),
        TimeGrain.MONTH: "DATETIME({col}, 'start of month')",
        TimeGrain.QUARTER: (
            "DATETIME({col}, 'start of month', "
            "printf('-%d month', (strftime('%m', {col}) - 1) % 3))"
        ),
        TimeGrain.YEAR: "DATETIME({col}, 'start of year')",
        TimeGrain.WEEK_ENDING_SATURDAY: "DATETIME({col}, 'start of day', 'weekday 6')",
        TimeGrain.WEEK_ENDING_SUNDAY: "DATETIME({col}, 'start of day', 'weekday 0')",
        TimeGrain.WEEK_STARTING_SUNDAY: (
            "DATETIME({col}, 'start of day', 'weekday 0', '-7 days')"
        ),
        TimeGrain.WEEK_STARTING_MONDAY: (
            "DATETIME({col}, 'start of day', 'weekday 1', '-7 days')"
        ),
    }

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> tuple[URL, dict[str, Any]]:
        uri, new_connect_args = super().adjust_engine_params(
            uri,
            connect_args,
            catalog,
            schema,
        )

        if schema:
            uri = uri.set(database=schema)

        return uri, new_connect_args

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> Optional[str]:
        return sqlalchemy_uri.database or None

    @classmethod
    def get_default_schema(
        cls,
        database: Database,
        catalog: Optional[str],
    ) -> Optional[str]:
        return cls.get_schema_from_engine_params(
            make_url_safe(database.sqlalchemy_uri), {}
        )

    @classmethod
    def quote_table(cls, table: Table, dialect: Dialect) -> str:
        return dialect.identifier_preparer.quote(table.table)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def convert_dttm(
        cls,
        target_type: str,
        dttm: datetime,
        db_extra: Optional[dict[str, Any]] = None,
    ) -> Optional[str]:
        """Convert Python datetime to MongoDB/SQL datetime string."""
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(
            sqla_type, (types.String, types.DateTime, types.Date, types.TIMESTAMP)
        ):
            # Return ISO format datetime string for MongoDB compatibility
            return f"""{dttm.isoformat(sep=" ", timespec="seconds")!r}"""

        return None
