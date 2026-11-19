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

from io import BytesIO

from superset.app import SupersetApp
from superset.utils.core import send_export_zip

ARCHIVE_NAME = "dashboard_export_20260101T000000.zip"


def _buf() -> BytesIO:
    return BytesIO(b"PK\x05\x06" + b"\x00" * 18)


def test_export_zip_is_not_cacheable(app: SupersetApp) -> None:
    """
    Export bundles are generated per request, so they must never be cached.

    Flask stamps SEND_FILE_MAX_AGE_DEFAULT -- one year in Superset's config -- on
    every send_file response that does not opt out, which left browsers and proxies
    serving stale archives (#41687).
    """
    with app.test_request_context("/api/v1/dashboard/export/"):
        response = send_export_zip(_buf(), ARCHIVE_NAME)

    assert response.cache_control.no_store
    assert response.cache_control.no_cache
    assert response.cache_control.must_revalidate
    assert response.cache_control.max_age == 0
    assert "max-age=31536000" not in response.headers["Cache-Control"]


def test_export_zip_is_a_named_attachment(app: SupersetApp) -> None:
    with app.test_request_context("/api/v1/dashboard/export/"):
        response = send_export_zip(_buf(), ARCHIVE_NAME)

    assert response.mimetype == "application/zip"
    assert ARCHIVE_NAME in response.headers["Content-Disposition"]
    assert response.headers["Content-Disposition"].startswith("attachment")


def test_export_zip_echoes_the_download_token(app: SupersetApp) -> None:
    with app.test_request_context("/api/v1/dashboard/export/?token=done_token"):
        response = send_export_zip(_buf(), ARCHIVE_NAME)

    cookies = response.headers.getlist("Set-Cookie")
    assert any("done_token=done" in cookie for cookie in cookies)


def test_export_zip_ignores_an_unsafe_download_token(app: SupersetApp) -> None:
    with app.test_request_context("/api/v1/dashboard/export/?token=bad%0d%0atoken"):
        response = send_export_zip(_buf(), ARCHIVE_NAME)

    assert not response.headers.getlist("Set-Cookie")
