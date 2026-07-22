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


def test_get_drill_detail_rejects_unsupported_datasource_before_query() -> None:
    """Reject unsupported detail requests before executing the query."""
    datasource: MagicMock = MagicMock()
    datasource.supports_drill_to_detail = False

    with (
        patch(
            "superset.common.query_actions._get_datasource",
            return_value=datasource,
        ),
        patch("superset.common.query_actions._get_full") as get_full,
        pytest.raises(
            QueryObjectValidationError,
            match="^Drill to detail is not available for this datasource type$",
        ),
    ):
        _get_drill_detail(MagicMock(), MagicMock())

    get_full.assert_not_called()


def test_get_drill_detail_preserves_omitted_capability_behavior() -> None:
    """Preserve detail queries for datasource implementations without the field."""
    datasource: MagicMock = MagicMock(spec=["columns"])
    column: MagicMock = MagicMock()
    column.column_name = "id"
    datasource.columns = [column]
    query_object: MagicMock = MagicMock()
    expected: dict[str, list[object]] = {"data": []}

    with (
        patch(
            "superset.common.query_actions._get_datasource",
            return_value=datasource,
        ),
        patch(
            "superset.common.query_actions._get_full",
            return_value=expected,
        ) as get_full,
    ):
        assert _get_drill_detail(MagicMock(), query_object) is expected

    get_full.assert_called_once()
