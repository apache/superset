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

"""The Extensions menu entry and the extensions API agree on availability."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest

from superset.extensions import appbuilder


def _extensions_menu_visible() -> bool:
    """Evaluate the Extensions menu entry's condition as a request would."""
    for category in appbuilder.menu.get_list():
        for child in category.childs or []:
            if child.name == "Extensions":
                return bool(child.cond is None or child.cond())
    return False


@pytest.mark.parametrize(
    "app",
    [{"FEATURE_FLAGS": {"ENABLE_EXTENSIONS": False}}],
    indirect=True,
)
def test_flag_enabled_after_boot_serves_info_with_visible_menu(
    client: Any, full_api_access: None
) -> None:
    """A flag turned on after app creation shows the menu and serves the API."""
    with patch(
        "superset.feature_flag_manager.is_feature_enabled",
        side_effect=lambda feature: feature == "ENABLE_EXTENSIONS",
    ):
        assert _extensions_menu_visible()
        response = client.get("/api/v1/extensions/_info")
    assert response.status_code == 200
