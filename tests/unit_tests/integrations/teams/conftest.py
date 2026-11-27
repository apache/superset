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
"""Shared deployment and isolated installation database for Teams tests."""

from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from superset.integrations.teams.models import TeamsInstallation

TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
APPLICATION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


@pytest.fixture
def teams_config() -> dict[str, Any]:
    """Configure one tenant, application and explicitly approved destination."""
    return {
        "tenant_id": TENANT,
        "application_id": APPLICATION,
        "credential": "deployment-secret",
        "destinations": [
            {
                "key": "ops",
                "label": "Operations",
                "team_id": "team-1",
                "channel_id": "channel-1",
            }
        ],
    }


@pytest.fixture
def teams_engine() -> Iterator[Engine]:
    """Create only the installation model's real database table."""
    engine = create_engine("sqlite://")
    TeamsInstallation.__table__.create(engine)
    yield engine
    engine.dispose()
