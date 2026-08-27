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
from typing import Any
from unittest.mock import MagicMock, patch

from superset.charts.schemas import ChartDataQueryContextSchema


def test_query_context_schema_accepts_empty_queries(app_context: Any) -> None:
    """
    Charts that compose other charts (deck.gl Multiple Layers) issue no
    query of their own: their buildQuery produces an empty ``queries``
    list and every layer is fetched client-side. The schema must accept
    that shape so the container chart can flow through /api/v1/chart/data,
    and the processor must return an empty result list for it.
    """
    with patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=MagicMock(),
    ):
        query_context = ChartDataQueryContextSchema().load(
            {
                "datasource": {"id": 1, "type": "table"},
                "queries": [],
                "result_format": "json",
                "result_type": "full",
            }
        )
    assert query_context.queries == []
