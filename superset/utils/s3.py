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
"""
Minimal S3 helpers for uploading export artifacts and minting pre-signed URLs.

Credentials and region come from the standard boto3 resolution chain (env vars,
shared config, instance role). Operators can override client construction via
the ``EXCEL_EXPORT_S3_CLIENT_KWARGS`` config (e.g. ``region_name`` or an
``endpoint_url`` for S3-compatible stores such as MinIO/LocalStack).
"""

from __future__ import annotations

import logging
from typing import Any

from flask import current_app

logger = logging.getLogger(__name__)


def _get_s3_client() -> Any:
    """Build an S3 client using operator-provided client kwargs (if any)."""
    # boto3 is imported lazily so that importing this module (which happens at
    # app startup via the dashboard API) does not require boto3 to be installed.
    # The dependency is only needed when an export actually runs; if it is
    # missing, surface an actionable install hint rather than a bare ImportError.
    try:
        import boto3  # pylint: disable=import-outside-toplevel
    except ImportError as ex:
        raise ImportError(
            "boto3 is required for dashboard Excel export but is not installed. "
            "Install it with `pip install apache-superset[excel-export]`."
        ) from ex

    client_kwargs: dict[str, Any] = current_app.config.get(
        "EXCEL_EXPORT_S3_CLIENT_KWARGS", {}
    )
    return boto3.client("s3", **client_kwargs)


def upload_file_to_s3(local_path: str, bucket: str, key: str) -> None:
    """
    Upload a local file to S3.

    ``boto3``'s ``upload_file`` automatically uses a managed multipart transfer
    for large files, so no manual chunking is required.

    :param local_path: Path to the file on local disk
    :param bucket: Destination S3 bucket
    :param key: Destination S3 object key
    """
    _get_s3_client().upload_file(local_path, bucket, key)


def generate_presigned_url(bucket: str, key: str, expires_in: int) -> str:
    """
    Generate a time-limited pre-signed URL for downloading an S3 object.

    :param bucket: The S3 bucket
    :param key: The S3 object key
    :param expires_in: URL lifetime in seconds
    :returns: A pre-signed ``get_object`` URL
    """
    return _get_s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )
