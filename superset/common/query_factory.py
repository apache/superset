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

import json
import logging
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from superset.common.query_context import QueryContext
from superset.common.query_object_factory import (
    QueryObjectFactory,
    QueryObjectFactoryImpl,
)
from superset.utils.core import (
    ChartDataResultFormat,
    ChartDataResultType,
    DatasourceDict,
)

if TYPE_CHECKING:
    from superset import ConnectorRegistry
    from superset.common.query_object import QueryObject

logger = logging.getLogger(__name__)


class QueryContextFactory:
    query_object_factory: QueryObjectFactory
    session_factory: Any
    connector_registry: ConnectorRegistry

    def __init__(
        self,
        app_config: Dict[str, Any],
        connector_registry: ConnectorRegistry,
        session_factory: Any,
    ):
        self.connector_registry = connector_registry
        self.session_factory = session_factory
        self.query_object_factory = QueryObjectFactoryImpl(
            app_config, connector_registry, session_factory
        )

    def create(  # pylint: disable=too-many-arguments
        self,
        datasource_dict: DatasourceDict,
        queries_dicts: List[Dict[str, Any]],
        force: bool = False,
        custom_cache_timeout: Optional[int] = None,
        result_type: ChartDataResultType = ChartDataResultType.FULL,
        result_format: Optional[ChartDataResultFormat] = None,
    ) -> QueryContext:
        datasource = self.connector_registry.get_datasource(
            str(datasource_dict["type"]),
            int(datasource_dict["id"]),
            self.session_factory(),
        )
        queries = self.create_queries_object(queries_dicts, result_type)
        return QueryContext(
            datasource,
            queries,
            force,
            custom_cache_timeout,
            result_type,
            result_format,
            raw_datasource=datasource_dict,  # type: ignore
            raw_queries=queries_dicts,
        )

    def create_from_dict(self, raw_query_context: Dict[str, Any]) -> QueryContext:
        if "datasource" in raw_query_context:
            raw_query_context["datasource_dict"] = raw_query_context.pop(
                "datasource", {}
            )
        if "queries" in raw_query_context:
            raw_query_context["queries_dicts"] = raw_query_context.pop("queries", [])
        return self.create(**raw_query_context)

    def create_from_json(self, raw_query_context: str) -> QueryContext:
        raw_data = json.loads(raw_query_context)
        return self.create_from_dict(raw_data)

    def create_queries_object(
        self, queries_dicts: List[Dict[str, Any]], result_type: ChartDataResultType
    ) -> List[QueryObject]:
        for qd in queries_dicts:
            qd.setdefault("result_type", result_type)
        queries = [
            self.query_object_factory.create(**query_obj) for query_obj in queries_dicts
        ]
        return queries
