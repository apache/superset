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
from unittest.mock import MagicMock

from superset.common.chart_data import ChartDataResultType
from superset.common.query_actions import acquire_query_data
from superset.common.query_object import QueryObject
from superset.utils.core import QueryObjectFilterClause


def test_get_drill_detail_does_not_strip_filters() -> None:
    """
    Characterize filter preservation in the DRILL_DETAIL acquisition path.

    ``acquire_query_data`` prepares a shallow copy of the incoming ``QueryObject``
    and rewrites its projection and ordering before dataframe acquisition. Filters
    present on the original object must remain on the prepared query handed to the
    cache-aware acquisition boundary.

    This is deliberately narrow and does NOT reproduce or close #28562 ("Drill to
    Detail by" ignoring a dashboard's applied filters) -- that report describes
    filters missing from the query *before* it reaches this function, which points
    at the payload assembled upstream of this path (dashboard native
    filter propagation into the chart's form data / the drill payload built on the
    frontend), not at this transform. If that assembly drops filters before calling
    this code path, this test does not catch it; it guards the backend preparation
    and acquisition boundary.
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
    query_context.form_data = {}
    query_context.result_type = ChartDataResultType.DRILL_DETAIL
    query_context.get_df_payload_result.return_value = MagicMock()

    acquired = acquire_query_data(
        ChartDataResultType.DRILL_DETAIL,
        query_context,
        query_obj,
        force_cached=False,
    )

    assert acquired is not None
    assert acquired.query_obj is not query_obj
    assert applied_filter in acquired.query_obj.filter, (
        "DRILL_DETAIL preparation unexpectedly stripped a filter it never touches; "
        "this guards the backend acquisition path, not #28562."
    )
    query_context.get_df_payload_result.assert_called_once_with(
        acquired.query_obj,
        force_cached=False,
        cache_key_extra=None,
    )
