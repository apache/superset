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


@patch("superset.reports.filters.security_manager", new_callable=MagicMock)
def test_report_schedule_filter_admin_sees_all(mock_sm: MagicMock) -> None:
    from superset.reports.filters import ReportScheduleFilter

    mock_sm.can_access_all_datasources.return_value = True
    query = MagicMock()
    f = ReportScheduleFilter("id", MagicMock())
    result = f.apply(query, None)
    assert result is query
    query.filter.assert_not_called()


@patch("superset.reports.filters.security_manager", new_callable=MagicMock)
@patch("superset.reports.filters.db")
def test_report_schedule_filter_non_admin_filtered(
    mock_db: MagicMock, mock_sm: MagicMock
) -> None:
    from superset.reports.filters import ReportScheduleFilter

    mock_sm.can_access_all_datasources.return_value = False
    mock_sm.user_model.get_user_id.return_value = 1
    mock_sm.user_model.id = 1
    query = MagicMock()
    f = ReportScheduleFilter("id", MagicMock())
    f.apply(query, None)
    query.filter.assert_called_once()


def test_report_schedule_all_text_filter_empty_noop() -> None:
    from superset.reports.filters import ReportScheduleAllTextFilter

    query = MagicMock()
    f = ReportScheduleAllTextFilter("name", MagicMock())
    result = f.apply(query, "")
    assert result is query
    query.filter.assert_not_called()


def test_report_schedule_all_text_filter_applies_ilike() -> None:
    from superset.reports.filters import ReportScheduleAllTextFilter

    query = MagicMock()
    f = ReportScheduleAllTextFilter("name", MagicMock())
    f.apply(query, "test")
    query.filter.assert_called_once()
