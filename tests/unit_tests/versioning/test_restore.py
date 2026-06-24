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
"""Unit-level coverage for the version-restore engine control flow.

The happy path and out-of-range cases are exercised end-to-end in the
per-entity integration suites (``version_restore_tests.py``); here we pin
the cheap, DB-free guard branches with mocks.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID

from superset.daos.version import VersionDAO


@patch("superset.versioning.restore.find_active_by_uuid", return_value=None)
def test_restore_version_returns_none_for_unknown_entity(mock_find):
    """Unknown entity UUID → engine returns None (caller raises 404)."""
    result = VersionDAO.restore_version(
        MagicMock(__name__="Dashboard"),
        UUID("00000000-0000-0000-0000-000000000000"),
        0,
    )
    assert result is None
    mock_find.assert_called_once()
