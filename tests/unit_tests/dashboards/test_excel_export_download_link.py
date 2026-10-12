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

from unittest.mock import patch
from uuid import UUID

import pytest
from flask import current_app

from superset.dashboards.excel_export.download_link import (
    build_download_url,
    download_path,
)

JOB_ID = UUID("00000000-0000-0000-0000-0000000000ab")
BARE_PATH = f"/api/v1/dashboard/export_xlsx/download/{JOB_ID}/"


@pytest.mark.parametrize(
    "app_root, expected",
    [
        ("/", BARE_PATH),
        ("", BARE_PATH),
        ("/superset", f"/superset{BARE_PATH}"),
        # Trailing slash must not double up on the path's leading slash.
        ("/superset/", f"/superset{BARE_PATH}"),
        # A root that merely prefixes the API path still has to be prepended.
        ("/api", f"/api{BARE_PATH}"),
        ("/a", f"/a{BARE_PATH}"),
    ],
)
def test_download_path_applies_application_root(
    app_context: None, app_root: str, expected: str
) -> None:
    with patch.dict(current_app.config, {"APPLICATION_ROOT": app_root}):
        assert download_path(JOB_ID) == expected


def test_build_download_url_keeps_application_root(app_context: None) -> None:
    # The emailed link is absolute, so the prefix has to survive into it too.
    with patch.dict(
        current_app.config,
        {
            "APPLICATION_ROOT": "/api",
            "WEBDRIVER_BASEURL_USER_FRIENDLY": "https://superset.example.com/",
        },
    ):
        assert (
            build_download_url(JOB_ID) == f"https://superset.example.com/api{BARE_PATH}"
        )
