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
config here. Signed download URLs from token-only credentials (workload
identity, GCE metadata, Cloud Run) are routed through the IAM signBlob API,
which requires ``roles/iam.serviceAccountTokenCreator`` on the service
account itself.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any


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

    def generate_download_url(self, bucket: str, key: str, expires_in: int) -> str:
        """
        Generate a time-limited signed URL for downloading a GCS object.

        Token-only Application Default Credentials (GKE workload identity, GCE
        metadata, Cloud Run) carry no private key, so local V4 signing raises.
        For those, route the signature through the IAM signBlob API by passing
        ``service_account_email`` and ``access_token``; the service account
        needs ``roles/iam.serviceAccountTokenCreator`` on itself.

        :param bucket: The GCS bucket
        :param key: The GCS blob name
        :param expires_in: URL lifetime in seconds
        :returns: A v4 signed URL
        """
        # pylint: disable=import-outside-toplevel
        import google.auth
        from google.auth import credentials as auth_credentials
        from google.auth.transport import requests as auth_requests

        blob = _get_client().bucket(bucket).blob(key)
        signing_kwargs: dict[str, Any] = {}
        credentials, _ = google.auth.default()
        if not isinstance(credentials, auth_credentials.Signing):
            credentials.refresh(auth_requests.Request())
            signing_kwargs = {
                "service_account_email": credentials.service_account_email,
                "access_token": credentials.token,
            }
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=expires_in),
            method="GET",
            **signing_kwargs,
        )
