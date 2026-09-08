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

from typing import Any, TYPE_CHECKING

import apsw
from sqlalchemy import event
from sqlalchemy.engine.base import Engine

from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.sqlite import SqliteEngineSpec

if TYPE_CHECKING:
    from superset.models.core import Database


class ShillelaghEngineSpec(SqliteEngineSpec):
    """Engine for shillelagh"""

    engine_name = "Shillelagh"
    engine = "shillelagh"
    drivers = {"apsw": "SQLite driver"}
    default_driver = "apsw"
    sqlalchemy_uri_placeholder = "shillelagh://"

    allows_joins = True
    allows_subqueries = True

    metadata = {
        "description": (
            "Shillelagh is a Python library that allows querying many data sources "
            "using SQL, including Google Sheets, CSV files, and APIs."
        ),
        "logo": "shillelagh.png",
        "homepage_url": "https://shillelagh.readthedocs.io/",
        "categories": [DatabaseCategory.OTHER, DatabaseCategory.OPEN_SOURCE],
        "pypi_packages": ["shillelagh[gsheetsapi]"],
        "connection_string": "shillelagh://",
        "notes": (
            "Shillelagh uses virtual tables to query external data sources. "
            "Google Sheets requires OAuth credentials configured."
        ),
    }

    @classmethod
    def get_function_names(
        cls,
        database: Database,
    ) -> list[str]:
        return super().get_function_names(database) + [
            "sleep",
            "version",
            "get_metadata",
        ]

    @classmethod
    def register_engine_events(cls, engine: Engine) -> None:
        super().register_engine_events(engine)
        event.listen(engine, "connect", cls._scope_connection_to_adapters)

    @staticmethod
    def _scope_connection_to_adapters(
        dbapi_connection: Any,
        connection_record: Any,  # pylint: disable=unused-argument
    ) -> None:
        """
        Keep a query scoped to the connection's configured data source.

        A shillelagh database targets external sources through its adapters (for
        example a Google Sheet); ``ATTACH DATABASE`` is not part of that surface,
        and the underlying driver is a full APSW/SQLite engine that would
        otherwise let a query open unrelated local SQLite files. Setting the
        attached-database limit to zero disables ``ATTACH`` on the connection,
        matching the ``check_sqlalchemy_uri`` guard in
        ``superset/security/analytics_db_safety.py`` that already excludes the
        bare ``sqlite``/``shillelagh``/``duckdb`` schemes at registration.
        """
        apsw_connection = getattr(dbapi_connection, "_connection", None)
        if isinstance(apsw_connection, apsw.Connection):
            apsw_connection.limit(apsw.SQLITE_LIMIT_ATTACHED, 0)
