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
"""``/api/v1/time_range/`` must honor the relative start/end config."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import pytest
import rison

from superset.app import SupersetApp


def _until(client: Any, time_range: str) -> datetime:
    response = client.get(f"/api/v1/time_range/?q={rison.dumps(time_range)}")
    assert response.status_code == 200
    return datetime.fromisoformat(response.json["result"][0]["until"])


@pytest.mark.usefixtures("full_api_access")
def test_time_range_defaults_to_today(app: SupersetApp, client: Any) -> None:
    app.config["DEFAULT_RELATIVE_END_TIME"] = "today"
    today = datetime.combine(datetime.now().date(), datetime.min.time())

    assert _until(client, "Last month") == today


@pytest.mark.usefixtures("full_api_access")
def test_time_range_honors_relative_end_config(app: SupersetApp, client: Any) -> None:
    app.config["DEFAULT_RELATIVE_END_TIME"] = "tomorrow"
    tomorrow = datetime.combine(datetime.now().date(), datetime.min.time()) + timedelta(
        days=1
    )

    assert _until(client, "Last month") == tomorrow
