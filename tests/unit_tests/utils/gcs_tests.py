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

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest

from superset.utils.export_storage import ExportStorage
from superset.utils.gcs import GCSExportStorage


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
def test_generate_download_url(mock_get_client: MagicMock) -> None:
    blob = mock_get_client.return_value.bucket.return_value.blob.return_value
    blob.generate_signed_url.return_value = "https://storage.googleapis.com/signed"

    url = GCSExportStorage().generate_download_url(
        "my-bucket", "exports/1/abc.xlsx", 300
    )

    assert url == "https://storage.googleapis.com/signed"
    blob.generate_signed_url.assert_called_once_with(
        version="v4",
        expiration=timedelta(seconds=300),
        method="GET",
    )


def test_implements_export_storage_protocol() -> None:
    assert isinstance(GCSExportStorage(), ExportStorage)


def test_get_client_missing_dependency_raises_actionable_error() -> None:
    # Regression: without google-cloud-storage installed (it is only an
    # optional install), calling into GCSExportStorage must surface an
    # actionable hint rather than a bare ModuleNotFoundError. This is the
    # real behavior in this test environment, where the dependency isn't
    # installed -- no mocking needed to exercise it.
    from superset.utils import gcs

    with pytest.raises(ImportError, match="excel-export-gcs"):
        gcs._get_client()
