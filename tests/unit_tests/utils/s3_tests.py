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

from unittest.mock import MagicMock, patch

from superset.utils import s3


@patch("superset.utils.s3.boto3.client")
@patch("superset.utils.s3.current_app")
def test_upload_file_to_s3(mock_app: MagicMock, mock_client_fn: MagicMock) -> None:
    mock_app.config = {"EXCEL_EXPORT_S3_CLIENT_KWARGS": {}}
    client = mock_client_fn.return_value

    s3.upload_file_to_s3("exports/out.xlsx", "my-bucket", "exports/1/abc.xlsx")

    mock_client_fn.assert_called_once_with("s3")
    client.upload_file.assert_called_once_with(
        "exports/out.xlsx", "my-bucket", "exports/1/abc.xlsx"
    )


@patch("superset.utils.s3.boto3.client")
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


@patch("superset.utils.s3.boto3.client")
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
