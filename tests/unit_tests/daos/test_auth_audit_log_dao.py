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

from pytest_mock import MockerFixture

from superset.daos.auth_audit_log import AuthAuditLogDAO


def test_auth_audit_log_dao_create(mocker: MockerFixture) -> None:
    mocker.patch("superset.daos.auth_audit_log.db.session.add", MagicMock())
    flush = mocker.patch("superset.daos.auth_audit_log.db.session.flush", MagicMock())

    row = AuthAuditLogDAO.create(
        event_type="password_change",
        user_id=42,
        ip_address="203.0.113.1",
        user_agent="Mozilla/5.0",
        metadata={"initiated_by": "self"},
    )

    assert row.event_type == "password_change"
    assert row.user_id == 42
    assert row.ip_address == "203.0.113.1"
    assert row.user_agent == "Mozilla/5.0"
    assert row.event_metadata == {"initiated_by": "self"}
    flush.assert_called_once()
