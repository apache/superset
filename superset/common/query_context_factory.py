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

from typing import Any, Dict, List, Optional, TYPE_CHECKING

from superset import app, db
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object_factory import QueryObjectFactory
from superset.connectors.connector_registry import ConnectorRegistry
from superset.utils.core import DatasourceDict

if TYPE_CHECKING:
    from superset.connectors.base.models import BaseDatasource

config = app.config


def create_query_object_factory() -> QueryObjectFactory:
    return QueryObjectFactory(config, ConnectorRegistry(), db.session)


class QueryContextFactory:  # pylint: disable=too-few-public-methods
    _query_object_factory: QueryObjectFactory

    def __init__(self) -> None:
        self._query_object_factory = create_query_object_factory()

    def create(
        self,
        *,
        datasource: DatasourceDict,
        queries: List[Dict[str, Any]],
        form_data: Optional[Dict[str, Any]] = None,
        result_type: Optional[ChartDataResultType] = None,
        result_format: Optional[ChartDataResultFormat] = None,
        force: bool = False,
        custom_cache_timeout: Optional[int] = None,
    ) -> QueryContext:
        datasource_model_instance = None
        if datasource:
            datasource_model_instance = self._convert_to_model(datasource)
        result_type = result_type or ChartDataResultType.FULL
        result_format = result_format or ChartDataResultFormat.JSON
        queries_ = [
            self._query_object_factory.create(
                result_type, datasource=datasource, **query_obj
            )
            for query_obj in queries
        ]
        cache_values = {
            "datasource": datasource,
            "queries": queries,
            "result_type": result_type,
            "result_format": result_format,
        }
        return QueryContext(
            datasource=datasource_model_instance,
            queries=queries_,
            form_data=form_data,
            result_type=result_type,
            result_format=result_format,
            force=force,
            custom_cache_timeout=custom_cache_timeout,
            cache_values=cache_values,
        )

    # pylint: disable=no-self-use
    def _convert_to_model(self, datasource: DatasourceDict) -> BaseDatasource:
        return ConnectorRegistry.get_datasource(
            str(datasource["type"]), int(datasource["id"]), db.session
        )
