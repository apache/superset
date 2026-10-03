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
"""Tests that role/group audit events are also observable as StatsD metrics.

The group and role write endpoints record audit events through
``_log_audit_event``. Operators need the same activity as counters, so that
group management is visible on dashboards without parsing the event log.
"""

from unittest.mock import MagicMock

from pytest_mock import MockerFixture

from superset.security.manager import _log_audit_event


def test_audit_event_increments_a_statsd_counter(
    mocker: MockerFixture,
    app_context,
) -> None:
    stats = MagicMock()
    mocker.patch("superset.extensions.stats_logger_manager", stats)
    mocker.patch("superset.extensions.event_logger")

    _log_audit_event("GroupCreated", {"group_id": 1, "group_name": "tenant-a"})

    stats.instance.incr.assert_called_once_with("security.GroupCreated")


def test_audit_event_is_still_logged_when_statsd_fails(
    mocker: MockerFixture,
    app_context,
) -> None:
    stats = MagicMock()
    stats.instance.incr.side_effect = RuntimeError("statsd down")
    mocker.patch("superset.extensions.stats_logger_manager", stats)
    event_logger = mocker.patch("superset.extensions.event_logger")

    _log_audit_event("GroupDeleted", {"group_id": 1, "group_name": "tenant-a"})

    event_logger.log.assert_called_once()
