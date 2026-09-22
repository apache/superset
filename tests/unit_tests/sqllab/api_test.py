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

import re
from typing import Any
from unittest.mock import MagicMock, patch

from flask import Flask
from pytest_mock import MockerFixture

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from tests.unit_tests.conftest import with_feature_flags


def _disposition_filename(form_filename: str | None) -> str:
    """Return the filename rendered into a streaming CSV Content-Disposition."""
    from superset.sqllab.api import SqlLabRestApi

    app = Flask(__name__)
    app.config["CSV_EXPORT"] = {"encoding": "utf-8"}
    with (
        app.app_context(),
        patch("superset.sqllab.api.StreamingSqlResultExportCommand") as command_cls,
    ):
        command = command_cls.return_value
        command.run.return_value = lambda: iter([b""])
        response = SqlLabRestApi._create_streaming_csv_response(
            MagicMock(), client_id="abc123", filename=form_filename
        )
    disposition = response.headers["Content-Disposition"]
    match = re.search(r'filename="([^"]*)"', disposition)
    assert match is not None, disposition
    return match.group(1)


def test_streaming_csv_sanitizes_user_filename() -> None:
    """A path-y / header-injecting filename is sanitized before the header."""
    filename = _disposition_filename('../../etc/pa"ss\r\nSet-Cookie: x.csv')

    for bad in ("/", "\\", '"', "\r", "\n", ".."):
        assert bad not in filename


def test_streaming_csv_preserves_normal_filename() -> None:
    """A normal filename passes through unchanged."""
    assert _disposition_filename("my_results.csv") == "my_results.csv"


def test_streaming_csv_falls_back_when_filename_empty() -> None:
    """An all-unsafe filename collapses to the generated default, not empty."""
    filename = _disposition_filename("///")

    assert filename.startswith("sqllab_abc123_")
    assert filename.endswith(".csv")


def test_format_sql_checks_access_before_rendering(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Access must be checked before Jinja rendering, as some Jinja macros
    execute statements against the database upon rendering.
    """
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "presto"
    mocker.patch(
        "superset.sqllab.api.DatabaseDAO.find_by_id",
        return_value=database,
    )
    get_template_processor = mocker.patch("superset.sqllab.api.get_template_processor")
    raise_for_access = mocker.patch(
        "superset.sqllab.api.security_manager.raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                message="You need access to the following tables: `s.t`",
                level=ErrorLevel.ERROR,
            )
        ),
    )

    response = client.post(
        "/api/v1/sqllab/format_sql/",
        json={
            "sql": "SELECT '{{ presto.latest_partition('s.t') }}'",
            "database_id": 1,
            "template_params": '{"foo": "bar"}',
        },
    )

    assert response.status_code == 403
    raise_for_access.assert_called_once()
    get_template_processor.assert_not_called()


REASON_REQUIRED = "A reason is required to download data."


def _export_result() -> dict[str, Any]:
    query = MagicMock()
    query.name = "my query"
    return {"query": query, "data": "a,b\n1,2\n", "count": 1}


@with_feature_flags(REQUIRE_DOWNLOAD_REASON=True)
def test_export_csv_requires_download_reason(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """With the flag on the GET export is refused (400) until a reason is sent."""
    command_cls = mocker.patch("superset.sqllab.api.SqlResultExportCommand")
    command_cls.return_value.run.return_value = _export_result()

    response = client.get("/api/v1/sqllab/export/abc/")
    assert response.status_code == 400
    assert response.json["errors"][0]["message"] == REASON_REQUIRED
    command_cls.assert_not_called()

    response = client.get("/api/v1/sqllab/export/abc/?download_reason=WP-1")
    assert response.status_code == 200
    command_cls.assert_called_once_with(client_id="abc")


@with_feature_flags(REQUIRE_DOWNLOAD_REASON=False)
def test_export_csv_without_reason_when_flag_off(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    command_cls = mocker.patch("superset.sqllab.api.SqlResultExportCommand")
    command_cls.return_value.run.return_value = _export_result()

    response = client.get("/api/v1/sqllab/export/abc/")
    assert response.status_code == 200
    command_cls.assert_called_once_with(client_id="abc")


@with_feature_flags(REQUIRE_DOWNLOAD_REASON=True)
def test_export_streaming_requires_download_reason(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """The POST streaming export accepts the reason as a form field."""
    command_cls = mocker.patch("superset.sqllab.api.StreamingSqlResultExportCommand")
    command_cls.return_value.run.return_value = lambda: iter([b"a,b\n"])

    response = client.post(
        "/api/v1/sqllab/export_streaming/", data={"client_id": "abc"}
    )
    assert response.status_code == 400
    assert response.json["errors"][0]["message"] == REASON_REQUIRED
    command_cls.assert_not_called()

    response = client.post(
        "/api/v1/sqllab/export_streaming/",
        data={"client_id": "abc", "download_reason": "WP-1"},
    )
    assert response.status_code == 200
    command_cls.assert_called_once()
