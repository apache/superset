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

"""Shared fixtures for dashboard tool tests."""

from collections.abc import Iterator
from unittest.mock import Mock, patch

import pytest

from superset.mcp_service.app import mcp


@pytest.fixture
def mcp_server() -> object:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Mock authentication for all tests in this directory."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        with patch("superset.security_manager.raise_for_editorship"):
            mock_user = Mock()
            mock_user.id = 1
            mock_user.username = "admin"
            mock_get_user.return_value = mock_user
            yield mock_get_user
