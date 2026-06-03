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

import logging
import re
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

from packaging.version import Version
from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.db_engine_specs.exceptions import (
    SupersetDBAPIDatabaseError,
    SupersetDBAPIOperationalError,
    SupersetDBAPIProgrammingError,
)

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger()


def _fetch_page_via_cursor(
    database: Database,
    sql: str,
    page_index: int,
    page_size: int,
    sql_path: str,
    close_path: str,
) -> tuple[list[list[Any]], list[str]]:
    """
    Iterate Elasticsearch/OpenSearch SQL cursor pagination to return a single
    page of results.

    Executes ``sql`` with ``fetch_size = page_size``, then sends cursor
    follow-up requests ``page_index`` times to skip earlier pages. Closes the
    cursor when done to release server-side state. Returns
    ``(rows, columns)``.

    If the dataset is exhausted before reaching ``page_index``, returns an
    empty rows list with the column names from the initial request.

    Note: the Elasticsearch SQL cursor is forward-only, so cost is linear in
    ``page_index`` — reaching page N issues N round trips to the cluster.
    Deep pagination (hundreds of pages) will therefore be noticeably slower
    than on ``OFFSET``-capable engines. This is a protocol limitation, not
    an implementation choice.
    """
    # The Elasticsearch SQL API rejects trailing semicolons, and any LIMIT
    # in the submitted statement caps the result set before the cursor can
    # page through it. ``fetch_size`` drives pagination instead.
    # Assumption: Superset only appends a trailing ``LIMIT N`` for engines
    # with ``supports_offset=False``. If that ever changes (e.g.
    # ``FETCH FIRST N ROWS`` or ``TOP N``), extend this sanitizer to match.
    sanitized_sql = sql.strip().rstrip(";").strip()
    sanitized_sql = re.sub(
        r"\s+LIMIT\s+\d+\s*$", "", sanitized_sql, flags=re.IGNORECASE
    )

    # The raw transport does not auto-set Content-Type the way the Python
    # DB-API driver does; ES rejects POSTs without a JSON content type.
    json_headers = {"Content-Type": "application/json"}
    with database.get_raw_connection() as conn:
        transport = conn.es.transport
        response = transport.perform_request(
            "POST",
            sql_path,
            headers=json_headers,
            body={"query": sanitized_sql, "fetch_size": page_size},
        )
        columns = [col["name"] for col in response.get("columns", [])]
        rows = response.get("rows", [])
        cursor = response.get("cursor")

        try:
            for _ in range(page_index):
                if not cursor:
                    # Dataset exhausted before reaching the target page —
                    # no cursor to close (ES returns no cursor on the final
                    # page). Return immediately with empty rows.
                    return [], columns
                response = transport.perform_request(
                    "POST",
                    sql_path,
                    headers=json_headers,
                    body={"cursor": cursor},
                )
                rows = response.get("rows", [])
                cursor = response.get("cursor")

            return rows, columns
        finally:
            if cursor:
                # Best-effort cleanup. If close itself fails we don't want
                # to mask the original error (if any) — swallow and log.
                try:
                    transport.perform_request(
                        "POST",
                        close_path,
                        headers=json_headers,
                        body={"cursor": cursor},
                    )
                except Exception:  # pylint: disable=broad-except
                    logger.warning(
                        "Failed to close Elasticsearch SQL cursor at %s",
                        close_path,
                        exc_info=True,
                    )


class ElasticSearchEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    engine = "elasticsearch"
    engine_name = "Elasticsearch"
    time_groupby_inline = True
    allows_joins = False
    allows_subqueries = True
    allows_sql_comments = False
    supports_offset = False

    metadata = {
        "description": (
            "Elasticsearch is a distributed search and analytics engine. "
            "Query data using Elasticsearch SQL or OpenSearch SQL syntax."
        ),
        "logo": "elasticsearch.png",
        "homepage_url": "https://www.elastic.co/elasticsearch/",
        "categories": [DatabaseCategory.SEARCH_NOSQL, DatabaseCategory.OPEN_SOURCE],
        "pypi_packages": ["elasticsearch-dbapi"],
        "connection_string": "elasticsearch+https://{user}:{password}@{host}:9243/",
        "default_port": 9243,
        "parameters": {
            "user": "Elasticsearch username",
            "password": "Elasticsearch password",
            "host": "Elasticsearch host",
        },
        "drivers": [
            {
                "name": "Elasticsearch SQL API (Recommended)",
                "pypi_package": "elasticsearch-dbapi",
                "connection_string": "elasticsearch+https://{user}:{password}@{host}:9243/",
                "is_recommended": True,
                "notes": (
                    "For Elastic Cloud and self-hosted Elasticsearch with SQL enabled."
                ),
            },
            {
                "name": "OpenDistro / OpenSearch SQL",
                "pypi_package": "elasticsearch-dbapi",
                "connection_string": "odelasticsearch+https://{user}:{password}@{host}:9200/",
                "is_recommended": False,
                "notes": "For OpenDistro Elasticsearch or Amazon OpenSearch Service.",
            },
        ],
        "compatible_databases": [
            {
                "name": "Elastic Cloud",
                "description": (
                    "Elastic Cloud is the official managed Elasticsearch service "
                    "from Elastic. It includes Elasticsearch, Kibana, and "
                    "enterprise features with automatic scaling."
                ),
                "logo": "elasticsearch.png",
                "homepage_url": "https://www.elastic.co/cloud/",
                "categories": [
                    DatabaseCategory.SEARCH_NOSQL,
                    DatabaseCategory.HOSTED_OPEN_SOURCE,
                ],
                "pypi_packages": ["elasticsearch-dbapi"],
                "connection_string": (
                    "elasticsearch+https://{user}:{password}@{deployment}.{region}"
                    ".cloud.es.io:9243/"
                ),
                "docs_url": "https://www.elastic.co/guide/en/cloud/current/",
            },
            {
                "name": "Amazon OpenSearch Service",
                "description": (
                    "Amazon OpenSearch Service (successor to Amazon Elasticsearch "
                    "Service) is a managed search and analytics service on AWS."
                ),
                "logo": "elasticsearch.png",
                "homepage_url": "https://aws.amazon.com/opensearch-service/",
                "categories": [
                    DatabaseCategory.SEARCH_NOSQL,
                    DatabaseCategory.CLOUD_AWS,
                    DatabaseCategory.HOSTED_OPEN_SOURCE,
                ],
                "pypi_packages": ["elasticsearch-dbapi"],
                "connection_string": (
                    "odelasticsearch+https://{user}:{password}@{host}:443/"
                ),
                "docs_url": (
                    "https://docs.aws.amazon.com/opensearch-service/latest/developerguide/"
                ),
            },
        ],
    }

    _date_trunc_functions = {
        "DATETIME": "DATE_TRUNC",
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "{func}('second', {col})",
        TimeGrain.MINUTE: "{func}('minute', {col})",
        TimeGrain.HOUR: "{func}('hour', {col})",
        TimeGrain.DAY: "{func}('day', {col})",
        TimeGrain.WEEK: "{func}('week', {col})",
        TimeGrain.MONTH: "{func}('month', {col})",
        TimeGrain.YEAR: "{func}('year', {col})",
    }

    type_code_map: dict[int, str] = {}  # loaded from get_datatype only if needed

    SQL_ENDPOINT = "/_sql"
    SQL_CLOSE_ENDPOINT = "/_sql/close"

    @classmethod
    def fetch_data_with_cursor(
        cls,
        database: Database,
        sql: str,
        page_index: int,
        page_size: int,
    ) -> tuple[list[list[Any]], list[str]]:
        """
        Fetch a single page of results using Elasticsearch cursor pagination.
        See ``_fetch_page_via_cursor`` for the protocol.
        """
        return _fetch_page_via_cursor(
            database=database,
            sql=sql,
            page_index=page_index,
            page_size=page_size,
            sql_path=cls.SQL_ENDPOINT,
            close_path=cls.SQL_CLOSE_ENDPOINT,
        )

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        # pylint: disable=import-error,import-outside-toplevel
        import es.exceptions as es_exceptions

        return {
            es_exceptions.DatabaseError: SupersetDBAPIDatabaseError,
            es_exceptions.OperationalError: SupersetDBAPIOperationalError,
            es_exceptions.ProgrammingError: SupersetDBAPIProgrammingError,
        }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        db_extra = db_extra or {}

        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.DateTime):
            es_version = db_extra.get("version")
            # The elasticsearch CAST function does not take effect for the time zone
            # setting. In elasticsearch7.8 and above, we can use the DATETIME_PARSE
            # function to solve this problem.
            supports_dttm_parse = False
            try:
                if es_version:
                    supports_dttm_parse = Version(es_version) >= Version("7.8")
            except Exception as ex:  # pylint: disable=broad-except
                logger.error("Unexpected error while convert es_version", exc_info=True)
                logger.exception(ex)

            if supports_dttm_parse:
                datetime_formatted = dttm.isoformat(sep=" ", timespec="seconds")
                return (
                    f"""DATETIME_PARSE('{datetime_formatted}', 'yyyy-MM-dd HH:mm:ss')"""
                )

            return f"""CAST('{dttm.isoformat(timespec="seconds")}' AS DATETIME)"""

        return None


class OpenDistroEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """OpenDistro/OpenSearch SQL engine spec.

    Note: Documentation is consolidated in ElasticSearchEngineSpec.
    This spec exists for runtime support of the odelasticsearch driver.
    """

    time_groupby_inline = True
    allows_joins = False
    allows_subqueries = True
    allows_sql_comments = False
    supports_offset = False

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "date_format({col}, 'yyyy-MM-dd HH:mm:ss.000')",
        TimeGrain.MINUTE: "date_format({col}, 'yyyy-MM-dd HH:mm:00.000')",
        TimeGrain.HOUR: "date_format({col}, 'yyyy-MM-dd HH:00:00.000')",
        TimeGrain.DAY: "date_format({col}, 'yyyy-MM-dd 00:00:00.000')",
        TimeGrain.MONTH: "date_format({col}, 'yyyy-MM-01 00:00:00.000')",
        TimeGrain.YEAR: "date_format({col}, 'yyyy-01-01 00:00:00.000')",
    }

    engine = "odelasticsearch"
    engine_name = "OpenSearch (OpenDistro)"

    SQL_ENDPOINT = "/_opendistro/_sql"
    SQL_CLOSE_ENDPOINT = "/_opendistro/_sql/close"

    @classmethod
    def fetch_data_with_cursor(
        cls,
        database: Database,
        sql: str,
        page_index: int,
        page_size: int,
    ) -> tuple[list[list[Any]], list[str]]:
        """
        Fetch a single page of results using OpenDistro SQL cursor pagination.
        Same protocol as ElasticSearchEngineSpec, different endpoint paths.
        """
        return _fetch_page_via_cursor(
            database=database,
            sql=sql,
            page_index=page_index,
            page_size=page_size,
            sql_path=cls.SQL_ENDPOINT,
            close_path=cls.SQL_CLOSE_ENDPOINT,
        )

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.DateTime):
            return f"""'{dttm.isoformat(timespec="seconds")}'"""
        return None

    @staticmethod
    def _mutate_label(label: str) -> str:
        return label.replace(".", "_")
