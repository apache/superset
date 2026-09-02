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
from superset.utils.export_storage import ExportStorage
from superset.utils.s3 import S3ExportStorage


@patch("boto3.client")
def test_upload_file(mock_client_fn: MagicMock) -> None:
    client = mock_client_fn.return_value

    S3ExportStorage().upload_file("exports/out.xlsx", "my-bucket", "exports/1/abc.xlsx")

    mock_client_fn.assert_called_once_with("s3")
    client.upload_file.assert_called_once_with(
        "exports/out.xlsx", "my-bucket", "exports/1/abc.xlsx"
    )


@patch("boto3.client")
def test_client_kwargs_passthrough(mock_client_fn: MagicMock) -> None:
    storage = S3ExportStorage(
        client_kwargs={
            "endpoint_url": "http://minio:9000",
            "region_name": "us-east-1",
        }
    )

    storage.upload_file("exports/out.xlsx", "my-bucket", "k")

    mock_client_fn.assert_called_once_with(
        "s3", endpoint_url="http://minio:9000", region_name="us-east-1"
    )


def test_implements_export_storage_protocol() -> None:
    assert isinstance(S3ExportStorage(), ExportStorage)


def test_importing_module_does_not_require_boto3() -> None:
    # Regression: importing this module (which happens at config-load time when
    # superset_config.py references S3ExportStorage) must not require boto3,
    # since it is only an optional install.
    import importlib

    with patch.dict(sys.modules, {"boto3": None}):
        importlib.reload(s3)
    # Reload again with boto3 available so later tests see the normal module.
    importlib.reload(s3)


def test_missing_boto3_raises_actionable_error() -> None:
    # Simulate a production install without boto3: the lazy import fails and we
    # surface an install hint instead of a bare ModuleNotFoundError.
    with (
        patch.dict(sys.modules, {"boto3": None}),
        pytest.raises(ImportError, match="excel-export"),
    ):
        S3ExportStorage().upload_file("exports/out.xlsx", "my-bucket", "k")


@patch("boto3.client")
def test_download_streams_chunks(mock_client_fn: MagicMock) -> None:
    client = mock_client_fn.return_value
    client.get_object.return_value = {
        "ContentLength": 4,
        "Body": MagicMock(iter_chunks=lambda chunk_size: iter([b"aa", b"bb"])),
    }

    size, chunks = S3ExportStorage().download("my-bucket", "exports/1/abc.xlsx")

    assert size == 4
    assert list(chunks) == [b"aa", b"bb"]
    client.get_object.assert_called_once_with(
        Bucket="my-bucket", Key="exports/1/abc.xlsx"
    )


@patch("boto3.client")
def test_download_missing_object_raises_file_not_found(
    mock_client_fn: MagicMock,
) -> None:
    import botocore.exceptions

    client = mock_client_fn.return_value
    client.get_object.side_effect = botocore.exceptions.ClientError(
        {"Error": {"Code": "NoSuchKey"}}, "GetObject"
    )

    with pytest.raises(FileNotFoundError):
        S3ExportStorage().download("my-bucket", "gone.xlsx")


@patch("boto3.client")
def test_download_unrelated_client_error_propagates(
    mock_client_fn: MagicMock,
) -> None:
    import botocore.exceptions

    client = mock_client_fn.return_value
    client.get_object.side_effect = botocore.exceptions.ClientError(
        {"Error": {"Code": "AccessDenied"}}, "GetObject"
    )

    with pytest.raises(botocore.exceptions.ClientError):
        S3ExportStorage().download("my-bucket", "exports/1/abc.xlsx")
