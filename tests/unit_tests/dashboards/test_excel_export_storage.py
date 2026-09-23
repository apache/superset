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
from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from superset.app import SupersetApp
from superset.dashboards.excel_export.storage import is_export_storage_configured


@pytest.mark.parametrize(
    ("storage", "configured"),
    [
        ({"bucket": "exports-bucket", "backend": MagicMock()}, True),
        ({"bucket": "exports-bucket"}, False),
        ({"bucket": "", "backend": MagicMock()}, False),
        ({"backend": MagicMock()}, False),
        ({}, False),
    ],
)
def test_storage_is_configured_only_with_a_bucket_and_backend(
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    storage: dict[str, Any],
    configured: bool,
) -> None:
    monkeypatch.setitem(app.config, "EXPORT_STORAGE", storage)
    assert is_export_storage_configured() is configured
