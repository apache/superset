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

import io
import sys
from types import ModuleType
from unittest.mock import MagicMock, patch

import pytest

from superset.utils.export_storage import ExportStorage
from superset.utils.gcs import GCSExportStorage


class _NotFound(Exception):  # noqa: N818 (mirrors google.api_core.exceptions.NotFound)
    """Stands in for google.api_core.exceptions.NotFound."""


def _api_core_modules() -> dict[str, ModuleType]:
    """Fake google.api_core so the lazy import in download() resolves without
    google-cloud-storage installed."""
    api_core = ModuleType("google.api_core")
    exceptions = ModuleType("google.api_core.exceptions")
    exceptions.NotFound = _NotFound  # type: ignore[attr-defined]
    api_core.exceptions = exceptions  # type: ignore[attr-defined]
    google = sys.modules.get("google") or ModuleType("google")
    google.api_core = api_core  # type: ignore[attr-defined]
    return {
        "google": google,
        "google.api_core": api_core,
        "google.api_core.exceptions": exceptions,
    }


@patch("superset.utils.gcs._get_client")
def test_upload_file(mock_get_client: MagicMock) -> None:
    blob = mock_get_client.return_value.bucket.return_value.blob.return_value

    GCSExportStorage().upload_file(
        "exports/out.xlsx", "my-bucket", "exports/1/abc.xlsx"
    )

    mock_get_client.return_value.bucket.assert_called_once_with("my-bucket")
    mock_get_client.return_value.bucket.return_value.blob.assert_called_once_with(
        "exports/1/abc.xlsx"
    )
    blob.upload_from_filename.assert_called_once_with("exports/out.xlsx")


@patch("superset.utils.gcs._get_client")
def test_download_streams_chunks(mock_get_client: MagicMock) -> None:
    blob = mock_get_client.return_value.bucket.return_value.blob.return_value
    blob.open.return_value.__enter__ = lambda self: io.BytesIO(b"abcdef")
    blob.open.return_value.__exit__ = MagicMock(return_value=False)

    with patch.dict(sys.modules, _api_core_modules()):
        chunks = list(GCSExportStorage().download("my-bucket", "exports/1/abc.xlsx"))

    assert b"".join(chunks) == b"abcdef"


@patch("superset.utils.gcs._get_client")
def test_download_missing_blob_raises_file_not_found(
    mock_get_client: MagicMock,
) -> None:
    blob = mock_get_client.return_value.bucket.return_value.blob.return_value
    blob.open.side_effect = _NotFound("gone")

    with (
        patch.dict(sys.modules, _api_core_modules()),
        pytest.raises(FileNotFoundError),
    ):
        list(GCSExportStorage().download("my-bucket", "gone.xlsx"))


def test_implements_export_storage_protocol() -> None:
    assert isinstance(GCSExportStorage(), ExportStorage)


def test_missing_sdk_raises_actionable_error() -> None:
    # Simulate a production install without google-cloud-storage: the lazy
    # import fails with an install hint instead of a bare ModuleNotFoundError.
    with (
        patch.dict(sys.modules, {"google.cloud": None, "google.cloud.storage": None}),
        pytest.raises(ImportError, match="excel-export-gcs"),
    ):
        GCSExportStorage().upload_file("exports/out.xlsx", "my-bucket", "k")
