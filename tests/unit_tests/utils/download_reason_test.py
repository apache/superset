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
from unittest.mock import patch

import pytest
from flask import Flask

from superset.utils.download_reason import (
    check_download_reason,
    DOWNLOAD_REASON_MAX_LENGTH,
    DownloadReasonRequiredError,
    get_download_reason,
)
from superset.utils.log import collect_request_payload

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


def test_reason_is_capped(app: Flask) -> None:
    long = "x" * (DOWNLOAD_REASON_MAX_LENGTH + 50)
    with app.test_request_context(f"/api/v1/chart/data?download_reason={long}"):
        assert get_download_reason() == "x" * DOWNLOAD_REASON_MAX_LENGTH


def test_blank_query_value_falls_back_to_form_body(app: Flask) -> None:
    with app.test_request_context(
        "/api/v1/chart/data?download_reason=%20%20",
        method="POST",
        data={"download_reason": "from form"},
    ):
        assert get_download_reason() == "from form"


def test_flag_off_missing_reason_passes(app: Flask) -> None:
    with (
        app.test_request_context("/api/v1/chart/data"),
        patch(FLAG, return_value=False),
    ):
        assert check_download_reason() is None


def test_flag_on_missing_reason_raises_400(app: Flask) -> None:
    with (
        app.test_request_context("/api/v1/chart/data"),
        patch(FLAG, return_value=True),
    ):
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


def test_reason_is_part_of_the_event_log_payload(app: Flask) -> None:
    """No extra wiring: the event logger merges request params into logs.json."""
    with app.test_request_context("/api/v1/chart/data?download_reason=WP-1"):
        assert check_download_reason() == "WP-1"
        assert collect_request_payload()["download_reason"] == "WP-1"
