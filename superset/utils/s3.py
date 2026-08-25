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
The AWS S3 dashboard-Excel-export storage backend.

Set ``EXCEL_EXPORT_STORAGE["backend"] = S3ExportStorage()`` in
``superset_config.py`` when the export bucket is an S3 (or S3-compatible)
bucket. Credentials and region come from the standard boto3 resolution chain
(env vars, shared config, instance role); client construction can be overridden
via the constructor (e.g. ``region_name``, or an ``endpoint_url`` for
S3-compatible stores such as MinIO/LocalStack):

    EXCEL_EXPORT_STORAGE["backend"] = S3ExportStorage(
        client_kwargs={"endpoint_url": "http://minio:9000"}
    )
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class S3ExportStorage:
    """Store dashboard Excel exports in AWS S3 via boto3.

    Implements ``superset.utils.export_storage.ExportStorage``.

    :param client_kwargs: Extra kwargs passed to ``boto3.client("s3", ...)``
    """

    def __init__(self, client_kwargs: dict[str, Any] | None = None) -> None:
        self._client_kwargs = client_kwargs or {}

    def _client(self) -> Any:
        # boto3 is imported lazily so that importing this module (which happens
        # at config-load time if EXCEL_EXPORT_STORAGE references this class)
        # does not require boto3 to be installed. The dependency is only needed
        # when an export actually runs; if it is missing, surface an actionable
        # install hint rather than a bare ImportError.
        try:
            import boto3  # pylint: disable=import-outside-toplevel
        except ImportError as ex:
            raise ImportError(
                "boto3 is required for S3ExportStorage but is not installed. "
                "Install it with `pip install apache-superset[excel-export]`."
            ) from ex
        return boto3.client("s3", **self._client_kwargs)

    def upload_file(self, local_path: str, bucket: str, key: str) -> None:
        """
        Upload a local file to S3.

        ``boto3``'s ``upload_file`` automatically uses a managed multipart
        transfer for large files, so no manual chunking is required.

        :param local_path: Path to the file on local disk
        :param bucket: Destination S3 bucket
        :param key: Destination S3 object key
        """
        self._client().upload_file(local_path, bucket, key)

    def generate_download_url(self, bucket: str, key: str, expires_in: int) -> str:
        """
        Generate a time-limited pre-signed URL for downloading an S3 object.

        :param bucket: The S3 bucket
        :param key: The S3 object key
        :param expires_in: URL lifetime in seconds
        :returns: A pre-signed ``get_object`` URL
        """
        return self._client().generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires_in,
        )
