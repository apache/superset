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
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.security.manager import SupersetSecurityManager
from superset.superset_typing import AdhocMetric
from tests.unit_tests.security.manager_test import (
    _base_axis_physical_column,
    _guest_query,
    stored_metrics as stored_metrics,
)


def _grained_sunburst_guest_context(
    mocker: MockerFixture, stored_metrics: list[AdhocMetric]
) -> tuple[MagicMock, list[dict[str, Any]]]:
    """
    A guest request for a Sunburst saved from Explore with a monthly grain on its
    temporal level, with the query built by the shared Sunburst query builder.
    """
    from superset.common.form_data_query_context import (
        build_query_objects_from_form_data,
    )

    params: dict[str, Any] = {
        "viz_type": "sunburst_v2",
        "columns": ["order_date", "region"],
        "metric": stored_metrics[0],
        "time_grain_sqla": "P1M",
        "temporal_columns_lookup": {"order_date": True},
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = params
    query_context.form_data = {"slice_id": 42, **params}
    queries = build_query_objects_from_form_data(params)
    return query_context, queries


def test_raise_for_access_guest_user_ok_grained_sunburst(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    An embedded guest loading a Sunburst whose temporal level carries a time grain
    passes the anti-tamper check: the grained level is sent as a BASE_AXIS column
    reference that collapses back to the saved hierarchy column. Grained
    references to columns outside the hierarchy are still rejected.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context, queries = _grained_sunburst_guest_context(mocker, stored_metrics)
    assert queries[0]["columns"][0] == _base_axis_physical_column(
        "order_date", time_grain="P1M"
    )
    query_context.queries = [_guest_query(queries[0]["columns"], queries[0]["metrics"])]
    sm.raise_for_access(query_context=query_context)

    # A grained reference to a column outside the saved hierarchy is rejected.
    query_context.queries = [
        _guest_query(
            [_base_axis_physical_column("secret_col", time_grain="P1M"), "region"],
            queries[0]["metrics"],
        )
    ]
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)
