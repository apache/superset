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
import logging
from typing import Any

from flask_babel import gettext as _
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.commands.chart.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
    ChartDataQueryValidationError,
)
from superset.common.chart_data import ChartDataResultType
from superset.common.chart_data_timing import ChartDataExecutionResult
from superset.common.query_context import QueryContext
from superset.exceptions import (
    CacheLoadError,
    QueryObjectValidationMessage,
)
from superset.semantic_layers.chart_types import validate_query_context_chart_type

logger = logging.getLogger(__name__)


class ChartDataCommand(BaseCommand):
    _query_context: QueryContext

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context

    @property
    def query_context(self) -> QueryContext:
        return self._query_context

    def _query_failed(self, ex: Exception) -> ChartDataQueryFailedError:
        """
        Report a database error raised while the query is being built, not run.

        A virtual dataset's default-schema lookup connects, so a rejected login
        lands here; it is a failed query like any other, not an unexpected
        server error.
        """
        database = getattr(self._query_context.datasource, "database", None)
        message = (
            database.db_engine_spec.extract_error_message(ex)
            if database is not None
            else str(ex)
        )
        return ChartDataQueryFailedError(_("Error: %(error)s", error=message))

    @staticmethod
    def _is_mssql_resource_governor_error(ex: Exception) -> bool:
        """
        Recognize SQL Server error 10928: the customer's own Azure SQL/Synapse
        resource governor rejected a connection because *their* database hit
        its configured request limit.

        This is raised by pymssql's C extension (``_mssql``/``pymssql``) while
        SQLAlchemy's connection pool performs a rollback-on-checkin
        (``Pool._reset`` -> ``Dialect.do_rollback``), which calls the DBAPI
        connection's ``rollback()`` directly rather than through
        ``Connection.execute()``. That path is never wrapped into a
        ``sqlalchemy.exc.SQLAlchemyError``/``DBAPIError``, so it would
        otherwise propagate past the ``SQLAlchemyError`` handling above as an
        unhandled 500. It's a customer-side capacity condition (their own
        resource-governor cap), not a Superset bug, so it's deliberately not
        matched via a hard ``import pymssql`` -- that driver is an optional
        extra -- and instead by class module + the well-known SQL Server
        error text, mirroring ``PrestoEngineSpec``'s driver-exception checks
        by ``type(ex).__name__``.
        """
        module_root = type(ex).__module__.split(".", 1)[0]
        if module_root not in ("pymssql", "_mssql"):
            return False
        message = str(ex)
        return "10928" in message or "request limit for the database" in message

    def run(self, **kwargs: Any) -> dict[str, Any]:
        # caching is handled in query_context.get_df_payload
        # (also evals `force` property)
        cache_query_context = kwargs.get("cache", False)
        force_cached = kwargs.get("force_cached", False)
        try:
            payload = self._query_context.get_payload(
                cache_query_context=cache_query_context, force_cached=force_cached
            )
        except CacheLoadError as ex:
            raise ChartDataCacheLoadError(ex.message) from ex
        except SQLAlchemyError as ex:
            raise self._query_failed(ex) from ex
        except Exception as ex:
            if not self._is_mssql_resource_governor_error(ex):
                raise
            logger.warning(
                "MSSQL resource governor rejected a connection (error 10928); "
                "this is a customer-side database capacity limit, not a "
                "Superset error: %s",
                ex,
            )
            raise self._query_failed(ex) from ex

        for query in payload["queries"]:
            self._raise_for_query_error(query)

        return_value = {
            "query_context": self._query_context,
            "queries": payload["queries"],
        }
        if cache_query_context:
            return_value.update(cache_key=payload["cache_key"])

        return return_value

    def execute(self, **kwargs: Any) -> ChartDataExecutionResult:
        """Execute and return timing as a typed sidecar."""
        cache_query_context = kwargs.get("cache", False)
        force_cached = kwargs.get("force_cached", False)
        try:
            result = self._query_context.get_payload_result(
                cache_query_context=cache_query_context,
                force_cached=force_cached,
            )
        except CacheLoadError as ex:
            raise ChartDataCacheLoadError(ex.message) from ex
        except SQLAlchemyError as ex:
            raise self._query_failed(ex) from ex
        except Exception as ex:
            if not self._is_mssql_resource_governor_error(ex):
                raise
            logger.warning(
                "MSSQL resource governor rejected a connection (error 10928); "
                "this is a customer-side database capacity limit, not a "
                "Superset error: %s",
                ex,
            )
            raise self._query_failed(ex) from ex

        for query in result.queries:
            self._raise_for_query_error(query.payload)

        return ChartDataExecutionResult(
            query_context=self._query_context,
            queries=result.queries,
            cache_key=result.cache_key,
        )

    def _raise_for_query_error(self, query: dict[str, Any]) -> None:
        """
        Raise a failed query's error, keeping validation failures typed.

        Query-only requests return errors in the payload instead, so the View
        Query modal can display validation errors. A validation failure arrives
        as a ``QueryObjectValidationMessage`` recorded by the query processor.
        """
        error = query.get("error")
        if not error or self._query_context.result_type == ChartDataResultType.QUERY:
            return
        message = _("Error: %(error)s", error=error)
        if isinstance(error, QueryObjectValidationMessage):
            raise ChartDataQueryValidationError(message) from error.cause
        raise ChartDataQueryFailedError(message)

    def validate(self) -> None:
        self._query_context.raise_for_access()
        validate_query_context_chart_type(self._query_context)
