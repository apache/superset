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
A SQLAlchemy dialect for dbt Metric Flow.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import sqlalchemy.types
from shillelagh.adapters.api.dbt_metricflow import DbtMetricFlowAPI
from shillelagh.backends.apsw.dialects.base import (
    APSWDialect,
    get_adapter_for_table_name,
)
from shillelagh.fields import Field
from sqlalchemy.engine.base import Connection
from sqlalchemy.engine.url import URL
from sqlalchemy.sql.visitors import VisitableType

from superset.extensions import cache_manager
from superset.utils.cache import memoized_func

TABLE_NAME = "metrics"


def get_sqla_type(field: Field) -> VisitableType:
    """
    Convert from Shillelagh to SQLAlchemy types.
    """
    type_map = {
        "BOOLEAN": sqlalchemy.types.BOOLEAN,
        "INTEGER": sqlalchemy.types.INT,
        "DECIMAL": sqlalchemy.types.DECIMAL,
        "TIMESTAMP": sqlalchemy.types.TIMESTAMP,
        "DATE": sqlalchemy.types.DATE,
        "TIME": sqlalchemy.types.TIME,
        "TEXT": sqlalchemy.types.TEXT,
    }

    return type_map.get(field.type, sqlalchemy.types.TEXT)


class SupersetMetricFlowAPI(DbtMetricFlowAPI):
    """
    Custom API adapter for dbt Metric Flow API.

    In the original adapter, the SQL queries a base dbt API URL, eg:

        SELECT * FROM "https://semantic-layer.cloud.getdbt.com/";
        SELECT * FROM "https://ab123.us1.dbt.com/";  -- custom user URL

    For this adapter, we want a leaner URI, mimicking a table:

        SELECT * FROM metrics;

    In order to do this, we override the ``supports`` method to only accept
    ``$TABLE_NAME`` instead of the URL, which is then passed to the adapter when it is
    instantiated.

    One problem with this change is that the adapter needs the base URL in order to
    determine the GraphQL endpoint. To solve this we pass the original URL via a new
    argument ``url``, and override the ``_get_endpoint`` method to use it instead of the
    table name.
    """

    @staticmethod
    def supports(uri: str, fast: bool = True, **kwargs: Any) -> bool:
        return uri == TABLE_NAME

    def __init__(
        self,
        table: str,
        service_token: str,
        environment_id: int,
        url: str,
    ) -> None:
        self.url = url
        super().__init__(table, service_token, environment_id)

    def _get_endpoint(self, url: str) -> str:
        """
        Compute the GraphQL endpoint.

        Instead of using ``url`` (which points to ``TABLE_NAME`` in this adapter), we
        should call the method using the actual dbt API base URL.
        """
        return super()._get_endpoint(self.url)

    def _build_column_from_dimension(self, name: str) -> Field:
        """
        Build a Shillelagh column from a dbt dimension.

        This method is terribly slow, since it needs to do a full data request for each
        dimension in order to determine their types. To improve UX we cache the results
        for one day.
        """
        return self._cached_build_column_from_dimension(
            name,
            cache_timeout=int(timedelta(days=1).total_seconds()),
        )

    @memoized_func(key="metricflow:dimension:{name}", cache=cache_manager.data_cache)
    def _cached_build_column_from_dimension(
        self,
        name: str,
        *args: Any,
        **kwargs: Any,
    ) -> Field:
        """
        Cached version of ``_build_column_from_dimension``.
        """
        return super()._build_column_from_dimension(name)


class MetricFlowDialect(APSWDialect):
    """
    A dbt Metric Flow dialect.

    URL should look like:

        metricflow:///<environment_id>?service_token=<service_token>

    Or when using a custom URL:

        metricflow://ab123.us1.dbt.com/<environment_id>?service_token=<service_token>

    """

    name = "metricflow"

    supports_statement_cache = True

    def create_connect_args(self, url: URL) -> tuple[tuple[()], dict[str, Any]]:
        baseurl = (
            f"https://{url.host}/"
            if url.host
            else "https://semantic-layer.cloud.getdbt.com/"
        )

        return (
            (),
            {
                "path": ":memory:",
                "adapters": ["supersetmetricflowapi"],
                "adapter_kwargs": {
                    "supersetmetricflowapi": {
                        "service_token": url.query["service_token"],
                        "environment_id": int(url.database),
                        "url": baseurl,
                    },
                },
                "safe": True,
                "isolation_level": self.isolation_level,
            },
        )

    def get_table_names(
        self,
        connection: Connection,
        schema: str | None = None,
        sqlite_include_internal: bool = False,
        **kwargs: Any,
    ) -> list[str]:
        return [TABLE_NAME]

    def has_table(
        self,
        connection: Connection,
        table_name: str,
        schema: str | None = None,
        **kwargs: Any,
    ) -> bool:
        return table_name == TABLE_NAME

    def get_columns(
        self,
        connection: Connection,
        table_name: str,
        schema: str | None = None,
        **kwargs: Any,
    ) -> list[tuple[str, str]]:
        adapter = get_adapter_for_table_name(connection, table_name)

        columns = {
            (
                adapter.grains[dimension][0]
                if dimension in adapter.grains
                else dimension
            ): adapter.columns[dimension]
            for dimension in adapter.dimensions
        }

        return [
            {
                "name": name,
                "type": get_sqla_type(field),
                "nullable": True,
                "default": None,
            }
            for name, field in columns.items()
        ]

    def get_schema_names(
        self,
        connection: Connection,
        **kwargs: Any,
    ) -> list[str]:
        return ["main"]

    def get_pk_constraint(
        self,
        connection: Connection,
        table_name: str,
        schema: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return {"constrained_columns": [], "name": None}

    def get_foreign_keys(
        self,
        connection: Connection,
        table_name: str,
        schema: str | None = None,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        return []

    get_check_constraints = get_foreign_keys
    get_indexes = get_foreign_keys
    get_unique_constraints = get_foreign_keys

    def get_table_comment(self, connection, table_name, schema=None, **kwargs):
        return {
            "text": "A virtual table that gives access to all dbt metrics & dimensions."
        }
