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

from superset.common.chart_data import ChartDataResultType
from superset.common.query_actions import _get_drill_detail
from superset.common.query_object import QueryObject
from superset.utils.core import QueryObjectFilterClause


@patch("superset.common.query_actions._get_full")
def test_get_drill_detail_does_not_strip_filters(
    mock_get_full: MagicMock,
) -> None:
    """
    Characterization test for ``_get_drill_detail`` (superset/common/query_actions.py),
    the backend transform behind the "Drill to Detail by" samples query.

    ``_get_drill_detail`` shallow-copies the incoming ``QueryObject`` and rewrites
    ``is_timeseries``, ``metrics``, ``post_processing``, ``columns`` and ``orderby``;
    it never reads or reassigns ``QueryObject.filter``. This test pins that
    behavior down: filters present on the ``QueryObject`` handed to
    ``_get_drill_detail`` are still present, unmodified, on the object it hands off
    to ``_get_full``.

    This is deliberately narrow and does NOT reproduce or close #28562 ("Drill to
    Detail by" ignoring a dashboard's applied filters) -- that report describes
    filters missing from the query *before* it reaches this function, which points
    at the payload assembled upstream of ``_get_drill_detail`` (dashboard native
    filter propagation into the chart's form data / the drill payload built on the
    frontend), not at this transform. If that assembly is ever changed to drop
    filters before calling into this code path, this test would not catch it; it
    only guards against a regression introduced inside ``_get_drill_detail`` itself.
    """
    applied_filter: QueryObjectFilterClause = {
        "col": "region",
        "op": "==",
        "val": "USA",
    }

    query_obj: QueryObject = QueryObject(
        columns=["region", "sales"],
        metrics=["count"],
        filters=[applied_filter],
    )

    col_region: MagicMock = MagicMock()
    col_region.column_name = "region"
    col_sales: MagicMock = MagicMock()
    col_sales.column_name = "sales"

    datasource = MagicMock()
    datasource.columns = [col_region, col_sales]

    query_context: MagicMock = MagicMock()
    query_context.datasource = datasource
    query_context.result_type = ChartDataResultType.DRILL_DETAIL

    captured: dict[str, QueryObject] = {}

    def _capture(_ctx: MagicMock, obj: QueryObject, _force: bool) -> dict[str, Any]:
        captured["query_obj"] = obj
        return {}

    mock_get_full.side_effect = _capture

    _get_drill_detail(query_context, query_obj)

    executed: QueryObject = captured["query_obj"]
    assert applied_filter in executed.filter, (
        "_get_drill_detail unexpectedly stripped a filter it never touches; "
        "this guards against a regression introduced in that function, not #28562."
    )
