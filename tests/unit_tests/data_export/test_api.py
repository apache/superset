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
"""Status polling and downloads for a full data export."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.utils import json

MODULE = "superset.data_export.api"
JOB_ID = "00000000-0000-0000-0000-0000000000ab"
STATUS_URL = f"/api/v1/data_export/status/{JOB_ID}/"
DOWNLOAD_URL = f"/api/v1/data_export/download/{JOB_ID}/"

READY = {
    "status": "ready",
    "bucket": "b",
    "key": "data-exports/chart/x.csv",
    "backend": "unittest.mock.MagicMock",
    "filename": "Sales.csv",
    "mimetype": "text/csv; charset=utf-8",
    "row_count": 1_250_000,
}


@pytest.fixture
def backend() -> Any:
    storage = MagicMock()
    storage.download.return_value = (3, iter([b"a\n1"]))
    return storage


def _status(client: Any, payload: dict[str, Any] | None, mocker: MockerFixture) -> Any:
    mocker.patch(f"{MODULE}.LINKS.get_export_status", return_value=payload)
    return client.get(STATUS_URL)


def test_an_unknown_job_reads_as_pending(
    session: Session, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """Still queued, already expired, or never existed: a poller tells them
    apart by its own timeout."""
    response = _status(client, None, mocker)

    assert response.status_code == 200
    assert json.loads(response.data)["status"] == "pending"


def test_a_started_job_reads_as_running(
    session: Session, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """The task's execution budget only starts when a worker picks it up, so a
    poller restarts its wait window here rather than racing broker backlog."""
    response = _status(client, {"status": "running"}, mocker)

    assert json.loads(response.data)["status"] == "running"


def test_a_ready_job_hands_back_a_path_and_the_row_count(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    backend: Any,
) -> None:
    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = _status(client, READY, mocker)

    body = json.loads(response.data)
    assert body["status"] == "ready"
    # Origin-relative: the poller resolves it against the one host the user is
    # provably reachable at.
    assert body["download_url"] == DOWNLOAD_URL
    assert body["row_count"] == 1_250_000


def test_a_failed_job_reads_as_an_error_with_its_message(
    session: Session, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """Without this a poller would retry a missing key until it timed out."""
    response = _status(
        client, {"status": "error", "message": "It took too long."}, mocker
    )

    body = json.loads(response.data)
    assert body["status"] == "error"
    assert body["message"] == "It took too long."


def test_a_ready_job_is_not_announced_when_storage_is_gone(
    session: Session, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """The download endpoint would refuse it, so reporting ready would send
    the poller to a dead link."""
    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": None}):
        response = _status(client, READY, mocker)

    assert json.loads(response.data)["status"] == "error"


def test_a_ready_job_is_not_announced_across_a_storage_migration(
    session: Session, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """Reading another provider's bucket would be worse than expiring."""
    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": MagicMock()}):
        response = _status(client, {**READY, "backend": "other.Backend"}, mocker)

    assert json.loads(response.data)["status"] == "error"


def test_the_status_is_never_cached(
    session: Session, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    # A cached "pending" would strand a poller on a stale answer.
    response = _status(client, None, mocker)

    assert "no-store" in response.headers["Cache-Control"]
    assert response.headers["Pragma"] == "no-cache"


def test_the_download_serves_the_file_under_its_own_name(
    session: Session, client: Any, mocker: MockerFixture, backend: Any
) -> None:
    """No login: the unguessable job id is the credential, and access to the
    chart or query was checked when the export was requested."""
    mocker.patch(f"{MODULE}.LINKS.resolve_download", return_value=READY)

    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.get(DOWNLOAD_URL)

    assert response.status_code == 200
    assert response.data == b"a\n1"
    assert 'filename="Sales.csv"' in response.headers["Content-Disposition"]
    assert response.headers["Content-Type"].startswith("text/csv")
    # A declared length makes a stream that dies midway a failed download in
    # the browser rather than a truncated file saved as complete.
    assert response.headers["Content-Length"] == "3"


def test_the_download_is_never_cached(
    session: Session, client: Any, mocker: MockerFixture, backend: Any
) -> None:
    """The URL is a bearer credential with a lifetime of its own; a shared
    cache must not outlive it."""
    mocker.patch(f"{MODULE}.LINKS.resolve_download", return_value=READY)

    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.get(DOWNLOAD_URL)

    assert "no-store" in response.headers["Cache-Control"]
    assert "private" in response.headers["Cache-Control"]


def test_the_download_answers_head_without_a_body(
    session: Session, client: Any, mocker: MockerFixture, backend: Any
) -> None:
    """The frontend confirms a link with HEAD before navigating to it, so an
    expired link becomes a toast rather than a navigation to an error page."""
    mocker.patch(f"{MODULE}.LINKS.resolve_download", return_value=READY)

    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.head(DOWNLOAD_URL)

    assert response.status_code == 200
    assert response.data == b""
    assert response.headers["Content-Length"] == "3"


def test_an_expired_link_is_gone_rather_than_not_found(
    session: Session, client: Any, mocker: MockerFixture
) -> None:
    mocker.patch(f"{MODULE}.LINKS.resolve_download", return_value=None)

    response = client.get(DOWNLOAD_URL)

    assert response.status_code == 410


def test_a_file_a_lifecycle_rule_deleted_expires_cleanly(
    session: Session, client: Any, mocker: MockerFixture, backend: Any
) -> None:
    """A bucket lifecycle rule can outrun the link's own TTL."""
    mocker.patch(f"{MODULE}.LINKS.resolve_download", return_value=READY)
    backend.download.side_effect = FileNotFoundError

    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.get(DOWNLOAD_URL)

    assert response.status_code == 410


def test_a_download_with_storage_unconfigured_says_so(
    session: Session, client: Any, mocker: MockerFixture
) -> None:
    """A link can only exist if a backend was configured when the export ran,
    so reaching this means the config was cleared since."""
    mocker.patch(f"{MODULE}.LINKS.resolve_download", return_value=READY)

    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": None}):
        response = client.get(DOWNLOAD_URL)

    assert response.status_code == 501


def test_a_download_across_a_storage_migration_expires(
    session: Session, client: Any, mocker: MockerFixture, backend: Any
) -> None:
    mocker.patch(
        f"{MODULE}.LINKS.resolve_download",
        return_value={**READY, "backend": "other.Backend"},
    )

    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.get(DOWNLOAD_URL)

    assert response.status_code == 410
    backend.download.assert_not_called()


def test_only_the_download_is_login_free() -> None:
    """The download has to work when clicked from a plain email link, possibly
    with no session at all; the status endpoint has no such constraint, so it
    stays behind a login. Mapping the download to no permission is also what
    keeps FAB from advertising a security requirement for it in the spec."""
    from superset.data_export.api import DataExportRestApi

    api = DataExportRestApi()

    assert api.get_method_permission("download") == ""
    assert api.get_method_permission("status") == "read"
