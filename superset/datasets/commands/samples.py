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
from typing import Any, cast, Dict, Optional

from superset import app, security_manager
from superset.commands.base import BaseCommand
from superset.common.chart_data import ChartDataResultType
from superset.common.query_context_factory import QueryContextFactory
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.connectors.sqla.models import SqlaTable
from superset.constants import CacheRegion
from superset.datasets.commands.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
    DatasetSamplesFailedError,
)
from superset.datasets.dao import DatasetDAO
from superset.datasets.schemas import DatasetSamplesQuerySchema
from superset.exceptions import SupersetSecurityException
from superset.utils.core import DatasourceDict, QueryStatus


class SamplesDatasetCommand(BaseCommand):
    def __init__(
        self,
        model_id: int,
        force: bool,
        *,
        payload: Optional[DatasetSamplesQuerySchema] = None,
        page: Optional[int] = None,
        per_page: Optional[int] = None,
    ):
        self._model_id = model_id
        self._force = force
        self._model: Optional[SqlaTable] = None
        self._payload = payload
        self._page = page
        self._per_page = per_page

    def run(self) -> Dict[str, Any]:
        self.validate()
        limit_clause = self.get_limit_clause(self._page, self._per_page)
        self._model = cast(SqlaTable, self._model)
        datasource: DatasourceDict = {
            "type": self._model.type,
            "id": self._model.id,
        }

        # constructing samples query
        samples_instance = QueryContextFactory().create(
            datasource=datasource,
            queries=[
                {**self._payload, **limit_clause} if self._payload else limit_clause
            ],
            result_type=ChartDataResultType.SAMPLES,
            force=self._force,
        )

        # constructing count(*) query
        count_star_payload = {
            "metrics": [
                {
                    "expressionType": "SQL",
                    "sqlExpression": "COUNT(*)",
                    "label": "COUNT(*)",
                }
            ]
        }
        count_star_instance = QueryContextFactory().create(
            datasource=datasource,
            queries=[count_star_payload],
            result_type=ChartDataResultType.FULL,
            force=self._force,
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
            sample_data["dataset_count_star"] = count_star_data["data"][0]["COUNT(*)"]
            return sample_data
        except (IndexError, KeyError) as exc:
            raise DatasetSamplesFailedError from exc

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatasetDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetNotFoundError()
        # Check ownership
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise DatasetForbiddenError() from ex

    @staticmethod
    def get_limit_clause(
        page: Optional[int], per_page: Optional[int]
    ) -> Dict[str, int]:
        samples_row_limit = app.config.get("SAMPLES_ROW_LIMIT", 1000)
        limit = samples_row_limit
        offset = 0

        if isinstance(page, int) and isinstance(per_page, int):
            limit = int(per_page)
            if limit < 0 or limit > samples_row_limit:
                # reset limit value if input is invalid
                limit = samples_row_limit

            offset = (int(page) - 1) * limit
            if offset < 0:
                # reset offset value if input is invalid
                offset = 0

        return {"row_offset": offset, "row_limit": limit}
