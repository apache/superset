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
"""The worker side of a full data export: file, upload, link, email, log."""

from __future__ import annotations

import os
import uuid
from typing import Any, Iterator
from unittest.mock import MagicMock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app
from pytest_mock import MockerFixture

from superset.data_export.sources import FullExportSource, KIND_CHART
from superset.exceptions import SupersetErrorException
from superset.tasks.export_full_data import export_full_data
from superset.utils.export_links import STATUS_READY

MODULE = "superset.tasks.export_full_data"
JOB_ID = "00000000-0000-0000-0000-0000000000ab"
LOCK_PARAMS = {"user_id": 7, "kind": KIND_CHART, "target": "slice:1"}
# The API's lock acquisition token, compared on release.
LOCK_TOKEN = "acquisition-1"  # noqa: S105


class FakeCommand:
    """A streaming command that yields fixed chunks and reports progress."""

    def __init__(
        self,
        chunks: list[str] | None = None,
        rows: int = 3,
        error: BaseException | None = None,
    ) -> None:
        self.chunks = chunks if chunks is not None else ["a,b\n", "1,2\n"]
        self.rows = rows
        self.error = error
        self.progress: Any = None
        self.validated = False

    def validate(self) -> None:
        self.validated = True

    def run(self) -> Any:
        def stream() -> Iterator[str]:
            if self.error is not None:
                raise self.error
            for chunk in self.chunks:
                yield chunk
            if self.progress:
                self.progress(self.rows, sum(len(c) for c in self.chunks))

        return stream


@pytest.fixture
def storage() -> Iterator[MagicMock]:
    backend = MagicMock()
    with patch.dict(
        current_app.config,
        {
            "EXPORT_STORAGE": {"bucket": "b", "backend": backend},
            "CELERY_CONFIG": {},
            "FULL_DATA_EXPORT_KEY_PREFIX": "data-exports/",
        },
    ):
        yield backend


@pytest.fixture
def worker(mocker: MockerFixture, storage: MagicMock) -> dict[str, Any]:
    """A worker with a resolvable user, a fake command and no real IO."""
    user = MagicMock(email="analyst@example.com")
    mocker.patch(f"{MODULE}.security_manager.get_user_by_id", return_value=user)
    command = FakeCommand()
    source = FullExportSource(
        kind=KIND_CHART,
        label="Sales by region",
        command=command,  # type: ignore[arg-type]
        audit={"slice_id": 1},
    )

    def resolve(
        kind: str, payload: dict[str, Any], chunk_size: int, progress: Any
    ) -> FullExportSource:
        command.progress = progress
        return source

    mocker.patch(f"{MODULE}.resolve_source", side_effect=resolve)
    return {
        "user": user,
        "command": command,
        "source": source,
        "storage": storage,
        "links": mocker.patch(f"{MODULE}.LINKS"),
        "email": mocker.patch(f"{MODULE}.email"),
        "event_logger": mocker.patch(f"{MODULE}.event_logger"),
        "release": mocker.patch(f"{MODULE}.release_lock"),
    }


def _run(payload: dict[str, Any] | None = None) -> None:
    export_full_data(
        kind=KIND_CHART,
        payload=payload if payload is not None else {"label": "Sales by region"},
        user_id=7,
        job_id=JOB_ID,
        lock_params=LOCK_PARAMS,
        lock_token=LOCK_TOKEN,
    )


def test_a_successful_export_uploads_the_file_it_wrote(
    worker: dict[str, Any],
) -> None:
    _run()

    local_path, bucket, key = worker["storage"].upload_file.call_args.args
    assert bucket == "b"
    assert key == f"data-exports/chart/{JOB_ID}.csv"
    # The temp file is removed once uploaded, so its content is asserted
    # through what the fake storage was handed.
    assert local_path.endswith(".csv")


def test_the_file_holds_every_chunk_the_query_streamed(
    worker: dict[str, Any],
) -> None:
    """The one thing the export exists to get right."""
    written: dict[str, bytes] = {}

    def capture(local_path: str, bucket: str, key: str) -> None:
        with open(local_path, "rb") as handle:
            written["body"] = handle.read()

    worker["storage"].upload_file.side_effect = capture
    worker["command"].chunks = ["col\n", "1\n", "2\n", "3\n"]

    with patch.dict(current_app.config, {"CSV_EXPORT": {"encoding": "utf-8"}}):
        _run()

    assert written["body"] == b"col\n1\n2\n3\n"


def test_the_file_is_encoded_with_the_configured_csv_encoding(
    worker: dict[str, Any],
) -> None:
    """A codec with a preamble must write its byte order mark once, not once
    per chunk."""
    written: dict[str, bytes] = {}

    def capture(local_path: str, bucket: str, key: str) -> None:
        with open(local_path, "rb") as handle:
            written["body"] = handle.read()

    worker["storage"].upload_file.side_effect = capture
    worker["command"].chunks = ["col\n", "1\n"]

    with patch.dict(current_app.config, {"CSV_EXPORT": {"encoding": "utf-8-sig"}}):
        _run()

    assert written["body"] == b"\xef\xbb\xbfcol\n1\n"


def test_the_temp_file_is_removed_after_the_upload(
    worker: dict[str, Any],
) -> None:
    """An uncapped export can be large; leaving it on the worker's disk would
    fill it up one export at a time."""
    paths: list[str] = []
    worker["storage"].upload_file.side_effect = lambda path, *_: paths.append(path)

    _run()

    assert len(paths) == 1
    assert not os.path.exists(paths[0])


def test_the_download_link_carries_the_name_and_type_to_serve_it_as(
    worker: dict[str, Any],
) -> None:
    _run()

    kwargs = worker["links"].create_download_link.call_args.kwargs
    assert kwargs["filename"] == "Sales_by_region.csv"
    assert kwargs["mimetype"].startswith("text/csv")
    assert kwargs["row_count"] == 3


def test_the_success_email_states_the_row_count(worker: dict[str, Any]) -> None:
    _run()

    worker["email"].send_export_email.assert_called_once()
    assert worker["email"].build_success_email.call_args.kwargs["row_count"] == 3


def test_a_user_without_an_email_still_gets_a_pollable_link(
    worker: dict[str, Any],
) -> None:
    worker["user"].email = None

    _run()

    worker["links"].create_download_link.assert_called_once()
    worker["email"].send_export_email.assert_not_called()


def test_a_failing_email_does_not_undo_a_finished_export(
    worker: dict[str, Any],
) -> None:
    """The file is uploaded and the link recorded; a send failure must not
    produce a misleading failure email or fail the task."""
    worker["email"].send_export_email.side_effect = RuntimeError("smtp down")

    _run()

    worker["links"].mark_export_failed.assert_not_called()


def test_the_export_is_recorded_in_the_audit_log_with_its_row_count(
    worker: dict[str, Any],
) -> None:
    _run()

    kwargs = worker["event_logger"].log_with_context.call_args.kwargs
    assert kwargs["action"] == "full_data_export"
    assert kwargs["status"] == "success"
    assert kwargs["row_count"] == 3
    assert kwargs["job_id"] == JOB_ID
    assert kwargs["export_kind"] == KIND_CHART
    assert kwargs["slice_id"] == 1
    # No request to read in a worker; asking for one would raise.
    assert kwargs["include_request_data"] is False


def test_a_failed_audit_write_does_not_fail_a_finished_export(
    worker: dict[str, Any],
) -> None:
    worker["event_logger"].log_with_context.side_effect = RuntimeError("db gone")

    _run()

    worker["links"].create_download_link.assert_called_once()


def test_access_is_rechecked_in_the_worker(worker: dict[str, Any]) -> None:
    """The job may have sat queued while the user's roles or the dataset's RLS
    changed."""
    _run()

    assert worker["command"].validated is True


def test_a_query_failure_is_reported_and_re_raised(
    worker: dict[str, Any],
) -> None:
    worker["command"].error = RuntimeError("the warehouse said no")

    with pytest.raises(RuntimeError):
        _run()

    worker["links"].create_download_link.assert_not_called()
    worker["links"].mark_export_failed.assert_called_once()
    worker["email"].build_failure_email.assert_called_once()
    assert worker["event_logger"].log_with_context.call_args.kwargs["status"] == "error"


def test_an_internal_error_is_not_quoted_back_to_the_requester(
    worker: dict[str, Any],
) -> None:
    worker["command"].error = RuntimeError("connection string: postgres://secret")

    with pytest.raises(RuntimeError):
        _run()

    assert worker["email"].build_failure_email.call_args.args[2] is None
    message = worker["links"].mark_export_failed.call_args.args[1]
    assert "postgres" not in message


def test_an_actionable_refusal_is_explained_to_the_requester(
    worker: dict[str, Any],
) -> None:
    """A query whose row cap cannot be removed is something the requester can
    do something about, so the reason is worth repeating back."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType

    worker["command"].error = SupersetErrorException(
        SupersetError(
            message="Its row limit cannot be removed.",
            error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
            level=ErrorLevel.ERROR,
        ),
        status=400,
    )

    with pytest.raises(SupersetErrorException):
        _run()

    assert (
        worker["email"].build_failure_email.call_args.args[2]
        == "Its row limit cannot be removed."
    )


def test_a_timeout_tells_the_requester_the_export_was_stopped(
    worker: dict[str, Any],
) -> None:
    worker["command"].error = SoftTimeLimitExceeded()

    with pytest.raises(SoftTimeLimitExceeded):
        _run()

    assert (
        worker["event_logger"].log_with_context.call_args.kwargs["status"] == "timeout"
    )
    message = worker["links"].mark_export_failed.call_args.args[1]
    assert "took too long" in message


def test_a_failure_landing_after_the_upload_keeps_the_download_link(
    worker: dict[str, Any],
) -> None:
    """A soft time limit is raised asynchronously, so it can land after the
    file was uploaded and its link recorded. The file is downloadable by then;
    replacing its record with a failure would strand it."""
    from datetime import datetime, timezone

    from superset.tasks.export_full_data import _handle_failure

    worker["links"].get_export_status.return_value = {"status": STATUS_READY}

    _handle_failure(
        job_id=JOB_ID,
        user=worker["user"],
        label="Sales by region",
        requested_at=datetime.now(tz=timezone.utc),
        message="stopped",
        reason=None,
    )

    worker["links"].mark_export_failed.assert_not_called()
    worker["email"].send_export_email.assert_not_called()


def test_an_export_queued_for_a_deleted_user_does_not_run(
    worker: dict[str, Any], mocker: MockerFixture
) -> None:
    """Running the query as nobody would run it unfiltered."""
    mocker.patch(f"{MODULE}.security_manager.get_user_by_id", return_value=None)

    with pytest.raises(Exception, match="no longer exists"):
        _run()

    worker["storage"].upload_file.assert_not_called()


def test_an_export_queued_before_storage_was_cleared_fails_clearly(
    worker: dict[str, Any],
) -> None:
    with patch.dict(current_app.config, {"EXPORT_STORAGE": {}}):
        with pytest.raises(Exception, match="EXPORT_STORAGE"):
            _run()

    worker["links"].mark_export_failed.assert_called_once()


@pytest.mark.parametrize("fails", [False, True])
def test_the_in_flight_lock_is_released_either_way(
    worker: dict[str, Any], fails: bool
) -> None:
    """A lock left behind would refuse the user's next export until its TTL."""
    if fails:
        worker["command"].error = RuntimeError("boom")
        with pytest.raises(RuntimeError):
            _run()
    else:
        _run()

    worker["release"].assert_called_once_with(LOCK_PARAMS, LOCK_TOKEN)


def test_pollers_learn_the_worker_started_before_it_finishes(
    worker: dict[str, Any],
) -> None:
    """Queue delay would otherwise eat the client's wait window."""
    _run()

    worker["links"].mark_export_running.assert_called_once()
    assert worker["links"].mark_export_running.call_args.args[0] == uuid.UUID(JOB_ID)


def test_a_partial_note_reaches_the_success_email(worker: dict[str, Any]) -> None:
    """A chart with more than one query exports its main result set only, and
    the email has to say so."""
    _run({"label": "Sales by region", "partial_note": "main result set only"})

    assert (
        worker["email"].build_success_email.call_args.kwargs["partial_note"]
        == "main result set only"
    )
