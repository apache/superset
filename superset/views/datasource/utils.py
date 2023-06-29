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
from typing import Any, Optional

from superset import app, db
from superset.common.chart_data import ChartDataResultType
from superset.common.query_context_factory import QueryContextFactory
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.constants import CacheRegion
from superset.daos.datasource import DatasourceDAO
from superset.datasets.commands.exceptions import DatasetSamplesFailedError
from superset.utils.core import QueryStatus
from superset.views.datasource.schemas import SamplesPayloadSchema


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


def get_samples(  # pylint: disable=too-many-arguments,too-many-locals
    datasource_type: str,
    datasource_id: int,
    force: bool = False,
    page: int = 1,
    per_page: int = 1000,
    payload: Optional[SamplesPayloadSchema] = None,
) -> dict[str, Any]:
    datasource = DatasourceDAO.get_datasource(
        session=db.session,
        datasource_type=datasource_type,
        datasource_id=datasource_id,
    )

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
            result_type=ChartDataResultType.SAMPLES,
            force=force,
        )
    else:
        # constructing drill detail query
        # When query_type == 'samples' the `time filter` will be removed,
        # so it is not applicable drill detail query
        samples_instance = QueryContextFactory().create(
            datasource={
                "type": datasource.type,
                "id": datasource.id,
            },
            queries=[{**payload, **limit_clause}],
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
        result_type=ChartDataResultType.FULL,
        force=force,
    )
    samples_results = samples_instance.get_payload()
    count_star_results = count_star_instance.get_payload()

    try:
        sample_data = samples_results["queries"][0]
        count_star_data = count_star_results["queries"][0]
        failed_status = (
            sample_data.get("status") == QueryStatus.FAILED
            or count_star_data.get("status") == QueryStatus.FAILED
        )
        error_msg = sample_data.get("error") or count_star_data.get("error")
        if failed_status and error_msg:
            cache_key = sample_data.get("cache_key")
            QueryCacheManager.delete(cache_key, region=CacheRegion.DATA)
            raise DatasetSamplesFailedError(error_msg)

        sample_data["page"] = page
        sample_data["per_page"] = per_page
        sample_data["total_count"] = count_star_data["data"][0]["COUNT(*)"]
        return sample_data
    except (IndexError, KeyError) as exc:
        raise DatasetSamplesFailedError from exc
