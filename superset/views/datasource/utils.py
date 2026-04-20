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
from typing import Any, Iterable, Optional

from flask import current_app as app

from superset.commands.dataset.exceptions import DatasetSamplesFailedError
from superset.common.chart_data import ChartDataResultType
from superset.common.query_context_factory import QueryContextFactory
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.constants import CacheRegion
from superset.daos.datasource import DatasourceDAO
from superset.utils.core import QueryStatus
from superset.views.datasource.schemas import SamplesPayloadSchema

logger = logging.getLogger(__name__)


def get_limit_clause(page: Optional[int], per_page: Optional[int]) -> dict[str, int]:
    samples_row_limit = app.config.get("SAMPLES_ROW_LIMIT", 1000)
    limit = samples_row_limit
    offset = 0

    if isinstance(page, int) and isinstance(per_page, int):
        limit = int(per_page)
        if limit < 0 or limit > samples_row_limit:
            # reset limit value if input is invalid
            limit = samples_row_limit

        offset = max((int(page) - 1) * limit, 0)

    return {"row_offset": offset, "row_limit": limit}


def replace_verbose_with_column(
    filters: list[dict[str, Any]],
    columns: Iterable[Any],
    verbose_attr: str = "verbose_name",
    column_attr: str = "column_name",
) -> None:
    """
    Replace filter 'col' values that match column verbose_name with the column_name.
    Operates in-place on the filters list

    Args:
        filters: List of filter dicts, each must have 'col' key.
        columns: Iterable of column objects with verbose_name and column_name.
        verbose_attr: Attribute name for verbose/label.
        column_attr: Attribute name for actual column name.
    """
    for f in filters:
        col_value = f.get("col")
        if col_value is None:
            logger.warning("Filter missing 'col' key: %s", f)
            continue

        match = None
        for col in columns:
            if not hasattr(col, verbose_attr) or not hasattr(col, column_attr):
                logger.warning(
                    "Column object %s missing expected attributes '%s' or '%s'",
                    col,
                    verbose_attr,
                    column_attr,
                )
                continue

            if getattr(col, verbose_attr) == col_value:
                match = getattr(col, column_attr)
                break

        if match:
            f["col"] = match


def get_samples(  # pylint: disable=too-many-arguments
    datasource_type: str,
    datasource_id: int,
    force: bool = False,
    page: int = 1,
    per_page: int = 1000,
    payload: SamplesPayloadSchema | None = None,
    dashboard_id: int | None = None,
) -> dict[str, Any]:
    datasource = DatasourceDAO.get_datasource(
        datasource_type=datasource_type,
        database_id_or_uuid=str(datasource_id),
    )

    form_data = {"dashboardId": dashboard_id} if dashboard_id else None
    limit_clause = get_limit_clause(page, per_page)

    # todo(yongjie): Constructing count(*) and samples in the same query_context,
    if payload is None:
        # constructing samples query
        samples_instance = QueryContextFactory().create(
            datasource={
                "type": datasource.type,
                "id": datasource.id,
            },
            queries=[limit_clause],
            form_data=form_data,
            result_type=ChartDataResultType.SAMPLES,
            force=force,
        )
    else:
        # Use column names replacing verbose column names(Label)
        replace_verbose_with_column(payload.get("filters", []), datasource.columns)

        # constructing drill detail query
        # When query_type == 'samples' the `time filter` will be removed,
        # so it is not applicable drill detail query
        samples_instance = QueryContextFactory().create(
            datasource={
                "type": datasource.type,
                "id": datasource.id,
            },
            queries=[{**payload, **limit_clause}],
            form_data=form_data,
            result_type=ChartDataResultType.DRILL_DETAIL,
            force=force,
        )

    # constructing count(*) query
    count_star_metric = {
        "metrics": [
            {
                "expressionType": "SQL",
                "sqlExpression": "COUNT(*)",
                "label": "COUNT(*)",
            }
        ]
    }
    count_star_instance = QueryContextFactory().create(
        datasource={
            "type": datasource.type,
            "id": datasource.id,
        },
        queries=[{**payload, **count_star_metric} if payload else count_star_metric],
        form_data=form_data,
        result_type=ChartDataResultType.FULL,
        force=force,
    )

    try:
        # Enforce access control before fetching data.
        # This prevents users with "can samples on Datasource" permission from
        # reading samples from datasets they don't have access to.
        samples_instance.raise_for_access()
        count_star_instance.raise_for_access()

        count_star_data = count_star_instance.get_payload()["queries"][0]

        if count_star_data.get("status") == QueryStatus.FAILED:
            raise DatasetSamplesFailedError(count_star_data.get("error"))

        engine_spec = datasource.database.db_engine_spec
        row_offset = limit_clause["row_offset"]
        row_limit = limit_clause["row_limit"]

        if not engine_spec.allows_offset_fetch and row_offset > 0:
            try:
                sample_data = _fetch_samples_via_cursor(
                    datasource=datasource,
                    samples_instance=samples_instance,
                    count_star_data=count_star_data,
                    page_index=row_offset // row_limit,
                    page_size=row_limit,
                )
            except DatasetSamplesFailedError:
                raise
            except Exception as exc:
                QueryCacheManager.delete(
                    count_star_data.get("cache_key"), CacheRegion.DATA
                )
                raise DatasetSamplesFailedError(str(exc)) from exc
        else:
            sample_data = samples_instance.get_payload()["queries"][0]
            if sample_data.get("status") == QueryStatus.FAILED:
                QueryCacheManager.delete(
                    count_star_data.get("cache_key"), CacheRegion.DATA
                )
                raise DatasetSamplesFailedError(sample_data.get("error") or "")

        sample_data["page"] = page
        sample_data["per_page"] = per_page
        sample_data["total_count"] = count_star_data["data"][0]["COUNT(*)"]
        return sample_data
    except (IndexError, KeyError) as exc:
        raise DatasetSamplesFailedError from exc


def _fetch_samples_via_cursor(
    datasource: Any,
    samples_instance: Any,
    count_star_data: dict[str, Any],
    page_index: int,
    page_size: int,
) -> dict[str, Any]:
    """
    Fetch a single page of samples via engine-spec cursor pagination.

    Used when ``datasource.database.db_engine_spec.allows_offset_fetch`` is
    False and a non-first page is requested. Reuses the SQL that Superset
    already compiled for the normal samples payload, delegates cursor
    iteration to the engine spec, and assembles a response dict compatible
    with the normal samples path.

    The samples payload is also executed (its SQL is OFFSET-stripped by the
    models/helpers.py guard) to obtain the authoritative ``colnames`` and
    ``coltypes`` that the frontend grid needs for type-based cell renderers
    — ensuring page 2+ renders identically to page 1. The engine spec is
    responsible for stripping any trailing ``LIMIT`` from the SQL so the
    cursor is not capped to a single page.
    """
    # Run the normal samples payload once to source authoritative colnames
    # and coltypes for the paginated result set. The helpers.py OFFSET guard
    # keeps this to a single cheap page-1 query for the cursor-path engine.
    sample_payload = samples_instance.get_payload()["queries"][0]
    if sample_payload.get("status") == QueryStatus.FAILED:
        QueryCacheManager.delete(count_star_data.get("cache_key"), CacheRegion.DATA)
        raise DatasetSamplesFailedError(sample_payload.get("error") or "")

    sql = sample_payload.get("query")
    if not sql:
        QueryCacheManager.delete(count_star_data.get("cache_key"), CacheRegion.DATA)
        raise DatasetSamplesFailedError("Empty samples query")

    engine_spec = datasource.database.db_engine_spec
    rows, cursor_colnames, _ = engine_spec.fetch_data_with_cursor(
        database=datasource.database,
        sql=sql,
        page_index=page_index,
        page_size=page_size,
    )

    colnames = sample_payload.get("colnames") or cursor_colnames
    coltypes = sample_payload.get("coltypes") or []

    return {
        "data": [dict(zip(colnames, row, strict=False)) for row in rows],
        "colnames": colnames,
        "coltypes": coltypes,
        "status": QueryStatus.SUCCESS,
    }
