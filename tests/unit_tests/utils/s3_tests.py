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

import sys
from unittest.mock import MagicMock, patch

import pytest

from superset.utils import s3


@patch("boto3.client")
@patch("superset.utils.s3.current_app")
def test_upload_file_to_s3(mock_app: MagicMock, mock_client_fn: MagicMock) -> None:
    mock_app.config = {"EXCEL_EXPORT_S3_CLIENT_KWARGS": {}}
    client = mock_client_fn.return_value

    s3.upload_file_to_s3("exports/out.xlsx", "my-bucket", "exports/1/abc.xlsx")

    mock_client_fn.assert_called_once_with("s3")
    client.upload_file.assert_called_once_with(
        "exports/out.xlsx", "my-bucket", "exports/1/abc.xlsx"
    )


@patch("boto3.client")
@patch("superset.utils.s3.current_app")
def test_client_kwargs_passthrough(
    mock_app: MagicMock, mock_client_fn: MagicMock
) -> None:
    mock_app.config = {
        "EXCEL_EXPORT_S3_CLIENT_KWARGS": {
            "endpoint_url": "http://minio:9000",
            "region_name": "us-east-1",
        }
    }

    s3.upload_file_to_s3("exports/out.xlsx", "my-bucket", "k")

    mock_client_fn.assert_called_once_with(
        "s3", endpoint_url="http://minio:9000", region_name="us-east-1"
    )


def test_importing_module_does_not_require_boto3() -> None:
    # Regression: importing this module (which app startup does via the dashboard
    # API) must not require boto3, since it is only an optional install.
    import importlib

    with patch.dict(sys.modules, {"boto3": None}):
        importlib.reload(s3)
    # Reload again with boto3 available so later tests see the normal module.
    importlib.reload(s3)


def test_get_s3_client_missing_boto3_raises_actionable_error() -> None:
    # Simulate a production install without boto3: the lazy import fails and we
    # surface an install hint instead of a bare ModuleNotFoundError.
    with (
        patch.dict(sys.modules, {"boto3": None}),
        pytest.raises(ImportError, match="excel-export"),
    ):
        s3._get_s3_client()


@patch("boto3.client")
@patch("superset.utils.s3.current_app")
def test_generate_presigned_url(mock_app: MagicMock, mock_client_fn: MagicMock) -> None:
    mock_app.config = {"EXCEL_EXPORT_S3_CLIENT_KWARGS": {}}
    client = mock_client_fn.return_value
    client.generate_presigned_url.return_value = "https://signed.example/abc"

    url = s3.generate_presigned_url("my-bucket", "exports/1/abc.xlsx", 86400)

    assert url == "https://signed.example/abc"
    client.generate_presigned_url.assert_called_once_with(
        "get_object",
        Params={"Bucket": "my-bucket", "Key": "exports/1/abc.xlsx"},
        ExpiresIn=86400,
    )
