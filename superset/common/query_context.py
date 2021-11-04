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
from typing import Any, ClassVar, Dict, List, Optional, TYPE_CHECKING

from typing_extensions import TypedDict

from superset.utils.core import ChartDataResultFormat, ChartDataResultType

if TYPE_CHECKING:
    from pandas import DataFrame

    from superset.common.query_object import QueryObject
    from superset.connectors.base.models import BaseDatasource

logger = logging.getLogger(__name__)


class CachedTimeOffset(TypedDict):
    df: DataFrame
    queries: List[str]
    cache_keys: List[Optional[str]]


class QueryContext:  # pylint: disable=too-few-public-methods
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """

    cache_type: ClassVar[str] = "df"
    enforce_numerical_metrics: ClassVar[bool] = True

    datasource: BaseDatasource
    queries: List[QueryObject]
    force: bool
    custom_cache_timeout: Optional[int]
    result_type: ChartDataResultType
    result_format: ChartDataResultFormat

    # TODO: Type datasource and query_object dictionary with TypedDict when it becomes
    #  a vanilla python type https://github.com/python/mypy/issues/5288
    # pylint: disable=too-many-arguments
    def __init__(
        self,
        datasource: BaseDatasource,
        queries: List[QueryObject],
        force: bool = False,
        custom_cache_timeout: Optional[int] = None,
        result_type: Optional[ChartDataResultType] = None,
        result_format: Optional[ChartDataResultFormat] = None,
        raw_datasource: Optional[Dict[str, Any]] = None,
        raw_queries: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self.datasource = datasource
        self.force = force
        self.custom_cache_timeout = custom_cache_timeout
        self.result_type = result_type or ChartDataResultType.FULL
        self.result_format = result_format or ChartDataResultFormat.JSON
        self.queries = queries
        self.cache_values = {
            "datasource": datasource if raw_datasource is None else raw_datasource,
            "queries": queries if raw_queries is None else raw_queries,
            "result_type": self.result_type,
            "result_format": self.result_format,
        }

    def get_cache_timeout(self) -> Optional[int]:
        if self.custom_cache_timeout is not None:
            return self.custom_cache_timeout
        if self.datasource.cache_timeout is not None:
            return self.datasource.cache_timeout
        if hasattr(self.datasource, "database"):
            return self.datasource.database.cache_timeout
        return None
