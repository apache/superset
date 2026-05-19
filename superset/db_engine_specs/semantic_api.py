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
"""
An interface to any server implementing the Semantic Layer REST API.
"""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from superset.db_engine_specs.base import MetricType
from superset.db_engine_specs.shillelagh import ShillelaghEngineSpec
from superset.utils import json

if TYPE_CHECKING:
    from sqlalchemy.engine.reflection import Inspector
    from sqlalchemy.engine.url import URL

    from superset.models.core import Database
    from superset.sql.parse import Table
    from superset.superset_typing import ResultSetColumnType


SELECT_STAR_MESSAGE = (
    "The Semantic Layer API does not support data preview, since the view is a "
    "virtual table that is not materialized. An administrator should configure "
    'the database in Apache Superset so that the "Disable SQL Lab data preview '
    'queries" option under "Advanced" → "SQL Lab" is enabled.'
)


class SemanticAPIEngineSpec(ShillelaghEngineSpec):
    """
    Engine for the Semantic Layer REST API.

    A single Superset database maps to a single semantic view; the SQLAlchemy
    URL identifies the server and the view name::

        semanticapi://<host>[:port]/<view_name>
            [?secure=true&additional_configuration=<urlencoded JSON>]
    """

    engine = "semanticapi"
    engine_name = "Semantic Layer API"
    sqlalchemy_uri_placeholder = (
        "semanticapi://<host>[:port]/<view_name>?secure=<true|false>"
    )

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: str | None = None,
        schema: str | None = None,
    ) -> tuple[URL, dict[str, Any]]:
        """
        Fold ``additional_configuration`` from the database's ``extra`` field
        (placed by the user under ``engine_params.connect_args``) into the URL
        query string, so the dialect can pick it up.
        """
        uri, connect_args = super().adjust_engine_params(
            uri, connect_args, catalog, schema
        )
        if (config := connect_args.pop("additional_configuration", None)) is not None:
            query = dict(uri.query)
            query["additional_configuration"] = (
                config if isinstance(config, str) else json.dumps(config)
            )
            uri = uri.set(query=query)
        return uri, connect_args

    @classmethod
    def select_star(cls, *args: Any, **kwargs: Any) -> str:
        """
        Return a stand-in ``SELECT *`` that explains why preview is disabled.
        """
        message = SELECT_STAR_MESSAGE.replace("'", "''")
        return f"SELECT '{message}' AS warning"

    @classmethod
    def get_columns(
        cls,
        inspector: Inspector,
        table: Table,
        options: dict[str, Any] | None = None,
    ) -> list[ResultSetColumnType]:
        """
        Return only the view's dimensions; metrics are surfaced by ``get_metrics``.
        """
        columns: list[ResultSetColumnType] = []
        for column in inspector.get_columns(table.table, table.schema):
            if "computed" in column:
                continue
            column["column_name"] = column["name"]
            columns.append(column)
        return columns

    @classmethod
    def get_metrics(
        cls,
        database: Database,
        inspector: Inspector,
        table: Table,
    ) -> list[MetricType]:
        """
        Translate the view's metric columns into Superset metric definitions.
        """
        return [
            {
                "metric_name": column["name"],
                "expression": column["computed"]["sqltext"],
                "description": column["comment"],
            }
            for column in inspector.get_columns(table.table, table.schema)
            if "computed" in column
        ]
