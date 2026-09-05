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
"""Tests for dashboard folder list filtering."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy.orm.query import Query

from superset.dashboards.filters import DashboardFolderFilter
from superset.models.dashboard import Dashboard


@pytest.mark.parametrize("value", [None, ""])
def test_folder_filter_ignores_empty_values(value: str | None) -> None:
    query = MagicMock(spec=Query)

    result = DashboardFolderFilter("folder_id", MagicMock()).apply(query, value)

    assert result is query
    query.filter.assert_not_called()


def test_folder_filter_selects_uncategorized_dashboards() -> None:
    query = MagicMock(spec=Query)

    DashboardFolderFilter("folder_id", MagicMock()).apply(query, "uncategorized")

    condition = query.filter.call_args.args[0]
    assert condition.compare(Dashboard.folder_id.is_(None))


def test_folder_filter_selects_a_folder_by_uuid() -> None:
    query = MagicMock(spec=Query)
    folder_id = uuid4()

    DashboardFolderFilter("folder_id", MagicMock()).apply(query, folder_id)

    condition = query.filter.call_args.args[0]
    assert condition.compare(Dashboard.folder_id == folder_id)
