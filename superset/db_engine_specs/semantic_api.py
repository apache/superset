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

from flask import g
from shillelagh.exceptions import UnauthenticatedError

from superset.db_engine_specs.base import MetricType
from superset.db_engine_specs.shillelagh import ShillelaghEngineSpec
from superset.exceptions import OAuth2TokenRefreshError
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

    Connection URL::

        semanticapi://<host>[:port]/[?secure=true]

    OAuth2 is supported. The database's ``encrypted_extra`` should look like::

        {
          "oauth2_client_info": {
            "id": "demo-client",
            "secret": "demo-secret",
            "scope": "",
            "authorization_request_uri": "http://<host>:<port>/authorize",
            "token_request_uri":         "http://<host>:<port>/token"
          }
        }

    Per-tenant ``additional_configuration`` is forwarded through
    ``extra.engine_params.connect_args.additional_configuration``.
    """

    engine = "semanticapi"
    engine_name = "Semantic Layer API"
    sqlalchemy_uri_placeholder = "semanticapi://<host>[:port]/?secure=<true|false>"

    # OAuth 2.0 — the authorisation and token URIs live on each database's
    # ``encrypted_extra.oauth2_client_info`` since they're derived from that
    # database's server.
    supports_oauth2 = True
    oauth2_exception = (UnauthenticatedError, OAuth2TokenRefreshError)
    oauth2_token_request_type = "data"  # noqa: S105

    # pylint: disable=invalid-name
    encrypted_extra_sensitive_fields = {
        "$.oauth2_client_info.secret": "OAuth2 Client Secret",
    }

    @classmethod
    def needs_oauth2(cls, ex: Exception) -> bool:
        """
        ``UnauthenticatedError`` from the adapter signals an expired/missing
        bearer token — i.e. we need to run the OAuth2 dance.
        """
        return bool(g) and hasattr(g, "user") and isinstance(ex, cls.oauth2_exception)

    @classmethod
    def impersonate_user(
        cls,
        database: Database,  # noqa: ARG003
        username: str | None,  # noqa: ARG003
        user_token: str | None,
        url: URL,
        engine_kwargs: dict[str, Any],
    ) -> tuple[URL, dict[str, Any]]:
        """
        Inject the user's OAuth2 access token into the URL query string so
        that the dialect (and therefore the adapter) sends it as a Bearer.
        """
        if user_token:
            url = url.update_query_dict({"access_token": user_token})
        return url, engine_kwargs

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
        database: Database,  # noqa: ARG003
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
