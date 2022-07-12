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

from marshmallow import ValidationError

from superset import security_manager
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
from superset.exceptions import (
    QueryClauseValidationException,
    SupersetSecurityException,
)
from superset.utils.core import QueryStatus


class SamplesDatasetCommand(BaseCommand):
    def __init__(
        self,
        model_id: int,
        force: bool,
        *,
        payload: Optional[DatasetSamplesQuerySchema] = None,
    ):
        self._model_id = model_id
        self._force = force
        self._model: Optional[SqlaTable] = None
        self._payload = payload

    def run(self) -> Dict[str, Any]:
        self.validate()
        self._model = cast(SqlaTable, self._model)

        qc_instance = QueryContextFactory().create(
            datasource={
                "type": self._model.type,
                "id": self._model.id,
            },
            queries=[self._payload] if self._payload else [{}],
            result_type=ChartDataResultType.SAMPLES,
            force=self._force,
        )
        results = qc_instance.get_payload()
        try:
            sample_data = results["queries"][0]
            error_msg = sample_data.get("error")
            if sample_data.get("status") == QueryStatus.FAILED and error_msg:
                cache_key = sample_data.get("cache_key")
                QueryCacheManager.delete(cache_key, region=CacheRegion.DATA)
                raise DatasetSamplesFailedError(error_msg)
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

        try:
            self._payload = DatasetSamplesQuerySchema().load(self._payload)
        except ValidationError as ex:
            raise QueryClauseValidationException() from ex
