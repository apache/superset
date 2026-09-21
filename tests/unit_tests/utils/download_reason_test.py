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
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from superset.utils.download_reason import (
    check_download_reason,
    DownloadReasonRequiredError,
    get_download_reason,
)

FLAG = "superset.utils.download_reason.is_feature_enabled"


def test_reason_from_query_string_is_trimmed(app: Flask) -> None:
    with app.test_request_context(
        "/api/v1/sqllab/export/abc/?download_reason=%20WP-1%20"
    ):
        assert get_download_reason() == "WP-1"


def test_reason_from_form_body(app: Flask) -> None:
    with app.test_request_context(
        "/api/v1/chart/data", method="POST", data={"download_reason": "audit"}
    ):
        assert get_download_reason() == "audit"


def test_flag_off_missing_reason_passes_and_logs_nothing(app: Flask) -> None:
    payload = MagicMock()
    with (
        app.test_request_context("/api/v1/chart/data"),
        patch(FLAG, return_value=False),
    ):
        assert check_download_reason(payload) is None
    payload.assert_not_called()


def test_flag_on_missing_reason_raises_400(app: Flask) -> None:
    with app.test_request_context("/api/v1/chart/data"), patch(FLAG, return_value=True):
        with pytest.raises(DownloadReasonRequiredError) as excinfo:
            check_download_reason()
    assert excinfo.value.status == 400


def test_flag_on_blank_reason_raises(app: Flask) -> None:
    with (
        app.test_request_context("/api/v1/chart/data?download_reason=%20%20"),
        patch(FLAG, return_value=True),
    ):
        with pytest.raises(DownloadReasonRequiredError):
            check_download_reason()


def test_reason_is_recorded_in_event_log_payload(app: Flask) -> None:
    payload = MagicMock()
    with (
        app.test_request_context("/api/v1/chart/data?download_reason=WP-1"),
        patch(FLAG, return_value=True),
    ):
        assert check_download_reason(payload) == "WP-1"
    payload.assert_called_once_with(download_reason="WP-1")


def test_reason_is_recorded_even_when_flag_off(app: Flask) -> None:
    payload = MagicMock()
    with (
        app.test_request_context("/api/v1/chart/data?download_reason=optional"),
        patch(FLAG, return_value=False),
    ):
        assert check_download_reason(payload) == "optional"
    payload.assert_called_once_with(download_reason="optional")
