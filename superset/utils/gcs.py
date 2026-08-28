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
``ExportStorage`` implementation backed by Google Cloud Storage, for
deployments where the export bucket is a native GCS bucket rather than S3.

Set ``EXPORT_STORAGE["backend"] = GCSExportStorage()`` in
``superset_config.py`` (vs ``superset.utils.s3.S3ExportStorage`` for an S3
bucket). Authentication uses Application Default Credentials (a
service account key, workload identity, etc.) via the standard
``google-cloud-storage`` resolution chain -- there is no separate credential
config here, and no signing: downloads stream through Superset with the same
identity that uploaded, so identities with no signing key (workload identity
federation, GCE metadata, Cloud Run) need only bucket read/write access.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

DOWNLOAD_CHUNK_BYTES = 8 * 1024 * 1024


def _get_client() -> Any:
    """Build a GCS client using Application Default Credentials."""
    # Imported lazily, mirroring superset.utils.s3.S3ExportStorage: importing
    # this module (which happens at config-load time if EXPORT_STORAGE
    # is set) should not require google-cloud-storage unless an export
    # actually runs.
    try:
        from google.cloud import storage  # pylint: disable=import-outside-toplevel
    except ImportError as ex:
        raise ImportError(
            "google-cloud-storage is required for GCSExportStorage but is not "
            "installed. Install it with "
            "`pip install apache-superset[excel-export-gcs]`."
        ) from ex

    return storage.Client()


class GCSExportStorage:
    """``ExportStorage`` backed by Google Cloud Storage.

    See ``superset.utils.export_storage.ExportStorage`` for the interface this
    implements.
    """

    def upload_file(self, local_path: str, bucket: str, key: str) -> None:
        """
        Upload a local file to GCS.

        :param local_path: Path to the file on local disk
        :param bucket: Destination GCS bucket
        :param key: Destination GCS blob name
        """
        _get_client().bucket(bucket).blob(key).upload_from_filename(local_path)

    def download(self, bucket: str, key: str) -> Iterator[bytes]:
        """
        Stream a GCS object in chunks.

        :param bucket: The GCS bucket
        :param key: The GCS blob name
        :raises FileNotFoundError: when the blob does not exist
        """
        # pylint: disable=import-outside-toplevel
        from google.api_core import exceptions as gcs_exceptions

        blob = _get_client().bucket(bucket).blob(key)
        try:
            with blob.open("rb", chunk_size=DOWNLOAD_CHUNK_BYTES) as stream:
                while chunk := stream.read(DOWNLOAD_CHUNK_BYTES):
                    yield chunk
        except gcs_exceptions.NotFound as ex:
            raise FileNotFoundError(f"gs://{bucket}/{key}") from ex
