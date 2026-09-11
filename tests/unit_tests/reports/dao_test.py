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


@patch("superset.daos.report.get_user_id", return_value=1)
@patch("superset.daos.report.db")
def test_validate_unique_creation_method_duplicate_returns_false(
    mock_db: MagicMock,
    mock_uid: MagicMock,
) -> None:
    from superset.daos.report import ReportScheduleDAO

    # Simulate that a matching report already exists
    mock_db.session.query.return_value.filter_by.return_value.filter.return_value = (
        MagicMock()
    )
    mock_db.session.query.return_value.scalar.return_value = True
    assert ReportScheduleDAO.validate_unique_creation_method(dashboard_id=1) is False


@patch("superset.daos.report.get_user_id", return_value=1)
@patch("superset.daos.report.db")
def test_validate_unique_creation_method_no_duplicate_returns_true(
    mock_db: MagicMock,
    mock_uid: MagicMock,
) -> None:
    from superset.daos.report import ReportScheduleDAO

    mock_db.session.query.return_value.filter_by.return_value.filter.return_value = (
        MagicMock()
    )
    mock_db.session.query.return_value.scalar.return_value = False
    assert ReportScheduleDAO.validate_unique_creation_method(dashboard_id=1) is True


@patch("superset.daos.report.db")
def test_find_last_error_notification_returns_none_after_success(
    mock_db: MagicMock,
) -> None:
    from superset.daos.report import ReportScheduleDAO

    schedule = MagicMock()
    error_log = MagicMock()
    success_log = MagicMock()

    # Build the query chain so each .query().filter().order_by().first() call
    # returns a different result. The DAO calls db.session.query() twice:
    # 1st call finds the error marker log
    # 2nd call finds a non-error log after it (success happened since last error email)
    query_mock = MagicMock()
    mock_db.session.query.return_value = query_mock
    chain = query_mock.filter.return_value.order_by.return_value
    chain.first.side_effect = [error_log, success_log]

    result = ReportScheduleDAO.find_last_error_notification(schedule)
    # Success log exists after error → should return None (no re-notification needed)
    assert result is None


@patch("superset.daos.report.db")
def test_find_last_error_notification_returns_log_when_only_errors(
    mock_db: MagicMock,
) -> None:
    from superset.daos.report import ReportScheduleDAO

    schedule = MagicMock()
    error_log = MagicMock()

    query_mock = MagicMock()
    mock_db.session.query.return_value = query_mock
    chain = query_mock.filter.return_value.order_by.return_value
    # 1st call: error marker log found; 2nd call: no success log after it
    chain.first.side_effect = [error_log, None]

    result = ReportScheduleDAO.find_last_error_notification(schedule)
    assert result is error_log
