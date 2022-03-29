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

from datetime import datetime
from typing import Any, Dict, Optional, Tuple, TYPE_CHECKING

from superset.common.chart_data import ChartDataResultType
from superset.common.query_object import QueryObject
from superset.utils.core import apply_max_row_limit, DatasourceDict
from superset.utils.date_parser import get_since_until

if TYPE_CHECKING:
    from sqlalchemy.orm import sessionmaker

    from superset import ConnectorRegistry
    from superset.connectors.base.models import BaseDatasource


class QueryObjectFactory:  # pylint: disable=too-few-public-methods
    _config: Dict[str, Any]
    _connector_registry: ConnectorRegistry
    _session_maker: sessionmaker

    def __init__(
        self,
        app_configurations: Dict[str, Any],
        connector_registry: ConnectorRegistry,
        session_maker: sessionmaker,
    ):
        self._config = app_configurations
        self._connector_registry = connector_registry
        self._session_maker = session_maker

    def create(  # pylint: disable=too-many-arguments
        self,
        parent_result_type: ChartDataResultType,
        datasource: Optional[DatasourceDict] = None,
        extras: Optional[Dict[str, Any]] = None,
        row_limit: Optional[int] = None,
        time_range: Optional[str] = None,
        time_shift: Optional[str] = None,
        **kwargs: Any,
    ) -> QueryObject:
        datasource_model_instance = None
        if datasource:
            datasource_model_instance = self._convert_to_model(datasource)
        processed_extras = self._process_extras(extras)
        result_type = kwargs.setdefault("result_type", parent_result_type)
        row_limit = self._process_row_limit(row_limit, result_type)
        from_dttm, to_dttm = self._get_dttms(time_range, time_shift, processed_extras)
        kwargs["from_dttm"] = from_dttm
        kwargs["to_dttm"] = to_dttm
        return QueryObject(
            datasource=datasource_model_instance,
            extras=extras,
            row_limit=row_limit,
            time_range=time_range,
            time_shift=time_shift,
            **kwargs,
        )

    def _convert_to_model(self, datasource: DatasourceDict) -> BaseDatasource:
        return self._connector_registry.get_datasource(
            str(datasource["type"]), int(datasource["id"]), self._session_maker()
        )

    def _process_extras(  # pylint: disable=no-self-use
        self,
        extras: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        extras = extras or {}
        return extras

    def _process_row_limit(
        self, row_limit: Optional[int], result_type: ChartDataResultType
    ) -> int:
        default_row_limit = (
            self._config["SAMPLES_ROW_LIMIT"]
            if result_type == ChartDataResultType.SAMPLES
            else self._config["ROW_LIMIT"]
        )
        return apply_max_row_limit(row_limit or default_row_limit)

    def _get_dttms(
        self,
        time_range: Optional[str],
        time_shift: Optional[str],
        extras: Dict[str, Any],
    ) -> Tuple[Optional[datetime], Optional[datetime]]:
        return get_since_until(
            relative_start=extras.get(
                "relative_start", self._config["DEFAULT_RELATIVE_START_TIME"]
            ),
            relative_end=extras.get(
                "relative_end", self._config["DEFAULT_RELATIVE_END_TIME"]
            ),
            time_range=time_range,
            time_shift=time_shift,
        )

    # light version of the view.utils.core
    # import view.utils require application context
    # Todo: move it and the view.utils.core to utils package
