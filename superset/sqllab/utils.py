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
from typing import Any, TYPE_CHECKING

import pyarrow as pa

from superset import db, is_feature_enabled
from superset.common.db_query_status import QueryStatus
from superset.daos.database import DatabaseDAO
from superset.models.sql_lab import Query, TabState
from superset.sqllab.limiting_factor import LimitingFactor
from superset.utils.core import apply_max_row_limit

if TYPE_CHECKING:
    from superset.db_engine_specs.base import BaseEngineSpec

logger = logging.getLogger(__name__)


DATABASE_KEYS = [
    "allow_file_upload",
    "allow_ctas",
    "allow_cvas",
    "allow_dml",
    "allow_run_async",
    "allows_cost_estimate",
    "query_cost_warning",
    "allows_subquery",
    "backend",
    "database_name",
    "expose_in_sqllab",
    "force_ctas_schema",
    "id",
    "disable_data_preview",
    "disable_drill_to_detail",
    "allow_multi_catalog",
    "engine_information",
]


def get_query_limit(query_limit: int | None) -> int:
    """Normalize the SQL Lab dropdown limit using the execution row cap."""
    limit = apply_max_row_limit(query_limit or 0)
    if limit < 0:
        logger.warning("Invalid limit of %i specified. Defaulting to max limit.", limit)
        limit = 0
    return limit


def set_query_limit(
    query: Query,
    rendered_query: str,
    limit: int,
    db_engine_spec: type[BaseEngineSpec],
) -> None:
    """Choose the execution limit and record whether SQL or the dropdown sets it."""
    sql_limit = db_engine_spec.get_limit_from_sql(rendered_query)
    if sql_limit is None or sql_limit > limit:
        query.limiting_factor = LimitingFactor.DROPDOWN
    elif limit > sql_limit:
        query.limiting_factor = LimitingFactor.QUERY
    else:
        query.limiting_factor = LimitingFactor.QUERY_AND_DROPDOWN
    query.limit = min(lim for lim in (sql_limit, limit) if lim is not None)


def apply_display_max_row_configuration_if_require(  # pylint: disable=invalid-name
    sql_results: dict[str, Any], max_rows_in_result: int
) -> dict[str, Any]:
    """
    Given a `sql_results` nested structure, applies a limit to the number of rows

    `sql_results` here is the nested structure coming out of sql_lab.get_sql_results, it
    contains metadata about the query, as well as the data set returned by the query.
    This method limits the number of rows adds a `displayLimitReached: True` flag to the
    metadata.

    :param max_rows_in_result:
    :param sql_results: The results of a sql query from sql_lab.get_sql_results
    :returns: The mutated sql_results structure
    """

    def is_require_to_apply() -> bool:
        return (
            sql_results["status"] == QueryStatus.SUCCESS
            and sql_results["query"]["rows"] > max_rows_in_result
        )

    if is_require_to_apply():
        sql_results["data"] = sql_results["data"][:max_rows_in_result]
        sql_results["displayLimitReached"] = True
    return sql_results


def write_ipc_buffer(table: pa.Table) -> pa.Buffer:
    sink = pa.BufferOutputStream()

    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)

    return sink.getvalue()


def bootstrap_sqllab_data(user_id: int | None) -> dict[str, Any]:
    tabs_state: list[Any] = []
    active_tab: Any = None
    databases: dict[int, Any] = {}
    for database in DatabaseDAO.find_all():
        json_data = database.to_json()
        databases[database.id] = {
            k: json_data[k] if k in json_data else getattr(database, k, None)
            for k in DATABASE_KEYS
        }
        databases[database.id]["allows_virtual_table_explore"] = (
            database.allows_virtual_table_explore
        )

    # These are unnecessary if sqllab backend persistence is disabled
    if is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"):
        # send list of tab state ids
        tabs_state = (
            db.session.query(TabState.id, TabState.label)
            .filter_by(user_id=user_id)
            .all()
        )
        # return first active tab, or fallback to another one if no tab is active
        active_tab = (
            db.session.query(TabState)
            .filter_by(user_id=user_id)
            .order_by(TabState.active.desc())
            .first()
        )

    return {
        "tab_state_ids": tabs_state,
        "active_tab": active_tab.to_dict() if active_tab else None,
        "databases": databases,
    }
