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
"""Rebuilding a queued export from the JSON that crossed the broker."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.sql_lab.streaming_export_command import (
    FullStreamingSqlResultExportCommand,
)
from superset.data_export.sources import (
    FullExportSource,
    KIND_CHART,
    KIND_QUERY,
    resolve_source,
)
from superset.exceptions import SupersetException

MODULE = "superset.data_export.sources"


def _noop(rows: int, written: int) -> None:
    pass


def _chart_payload(row_limit: Any = None) -> dict[str, Any]:
    return {
        "label": "Sales by region",
        "slice_id": 12,
        "query_context": {
            "datasource": {"type": "table", "id": 3},
            "query": {"row_limit": row_limit},
        },
    }


def test_a_chart_export_is_rebuilt_with_no_row_limit(
    mocker: MockerFixture,
) -> None:
    query_context = MagicMock()
    query_context.queries = [MagicMock(row_limit=None)]
    load = mocker.patch(f"{MODULE}.load_serialized_query", return_value=query_context)

    source = resolve_source(KIND_CHART, _chart_payload(), 1000, _noop)

    load.assert_called_once()
    assert source.kind == KIND_CHART
    assert source.label == "Sales by region"
    assert source.audit == {
        "slice_id": 12,
        "datasource_type": "table",
        "datasource_id": 3,
    }


def test_a_chart_export_that_kept_its_row_limit_is_refused(
    mocker: MockerFixture,
) -> None:
    """The whole point of the export. A limit surviving the broker would make
    the file stop at that many rows and report success."""
    query_context = MagicMock()
    query_context.queries = [MagicMock(row_limit=50_000)]
    mocker.patch(f"{MODULE}.load_serialized_query", return_value=query_context)

    with pytest.raises(SupersetException, match="row limit still applied"):
        resolve_source(KIND_CHART, _chart_payload(), 1000, _noop)


def test_a_chart_export_command_fails_loudly_rather_than_truncating(
    mocker: MockerFixture,
) -> None:
    """A consumer that writes the chunks to a file must not keep a truncated
    export as a complete one, so it asks for the exception instead of the
    stream's error marker."""
    query_context = MagicMock()
    query_context.queries = [MagicMock(row_limit=None)]
    mocker.patch(f"{MODULE}.load_serialized_query", return_value=query_context)

    source = resolve_source(KIND_CHART, _chart_payload(), 1000, _noop)

    assert source.command._raise_on_error is True  # noqa: SLF001
    assert source.command._progress_callback is _noop  # noqa: SLF001


def test_a_query_export_is_rebuilt_from_its_client_id() -> None:
    source = resolve_source(
        KIND_QUERY, {"client_id": "abc123", "label": "Tab 1"}, 500, _noop
    )

    assert isinstance(source.command, FullStreamingSqlResultExportCommand)
    assert source.audit == {"client_id": "abc123"}
    assert source.label == "Tab 1"


def test_a_job_from_another_release_fails_loudly() -> None:
    """A kind this version does not know must not be silently skipped."""
    with pytest.raises(SupersetException, match="Unknown full export kind"):
        resolve_source("dashboard", {}, 1000, _noop)


@pytest.mark.parametrize(
    "label, expected",
    [
        ("Sales by region", "Sales_by_region"),
        # Nothing filesystem-safe left: the kind is better than an empty name.
        ("///", "chart"),
    ],
)
def test_the_file_is_named_after_what_was_exported(label: str, expected: str) -> None:
    source = FullExportSource(kind=KIND_CHART, label=label, command=MagicMock())

    assert source.filename == expected
