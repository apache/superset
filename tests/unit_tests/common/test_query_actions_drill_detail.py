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
from unittest.mock import MagicMock, patch

import pytest

from superset.common.query_actions import _get_drill_detail
from superset.exceptions import QueryObjectValidationError


def test_get_drill_detail_refuses_datasource_that_opts_out() -> None:
    """
    A datasource with ``supports_drill_to_detail = False`` (e.g. semantic
    views) must be hard-blocked on the server. Without this gate the request
    would fall through to ``_get_full`` and fail with an opaque error, and
    the flag would only be enforced by the frontend menu — leaving the
    chart-data API endpoint accepting drill-detail requests it shouldn't.
    """
    datasource = MagicMock()
    datasource.supports_drill_to_detail = False

    query_obj = MagicMock()
    query_obj.datasource = datasource

    query_context = MagicMock()

    with pytest.raises(
        QueryObjectValidationError,
        match="Drill to detail is not available",
    ):
        _get_drill_detail(query_context, query_obj)


def test_get_drill_detail_allows_datasource_without_flag() -> None:
    """
    Datasources that don't declare the flag (e.g. legacy ``SqlaTable``
    subclasses via ``getattr`` default) must continue to work — the gate
    only fires when the flag is explicitly ``False``.
    """
    datasource = MagicMock(spec=["columns"])
    column = MagicMock()
    column.column_name = "id"
    datasource.columns = [column]

    query_obj = MagicMock()
    query_obj.datasource = datasource
    query_obj.columns = []

    query_context = MagicMock()

    expected_payload: dict[str, list[dict[str, str]]] = {"data": []}
    with patch(
        "superset.common.query_actions._get_full", return_value=expected_payload
    ) as mock_get_full:
        assert _get_drill_detail(query_context, query_obj) is expected_payload
    mock_get_full.assert_called_once()
