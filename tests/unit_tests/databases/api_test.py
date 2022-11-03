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

# pylint: disable=unused-argument, import-outside-toplevel, line-too-long

from io import BytesIO
from typing import Any

import pytest


def test_non_zip_import(client: Any, full_api_access: None) -> None:
    """
    Test that non-ZIP imports are not allowed.
    """
    buf = BytesIO(b"definitely_not_a_zip_file")
    form_data = {
        "formData": (buf, "evil.pdf"),
    }
    response = client.post(
        "/api/v1/database/import/",
        data=form_data,
        content_type="multipart/form-data",
    )
    assert response.status_code == 422
    assert response.json == {
        "errors": [
            {
                "message": "Not a ZIP file",
                "error_type": "GENERIC_COMMAND_ERROR",
                "level": "warning",
                "extra": {
                    "issue_codes": [
                        {
                            "code": 1010,
                            "message": "Issue 1010 - Superset encountered an error while running a command.",
                        }
                    ]
                },
            }
        ]
    }
