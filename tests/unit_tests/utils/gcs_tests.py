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
from contextlib import contextmanager
from datetime import timedelta
from types import ModuleType
from typing import Any, Iterator
from unittest.mock import MagicMock, patch

import pytest

from superset.utils.export_storage import ExportStorage
from superset.utils.gcs import GCSExportStorage


class _Signing:  # stands in for google.auth.credentials.Signing
    pass


class _SigningCredentials(_Signing):
    """Key-file style ADC: can sign locally."""


class _TokenOnlyCredentials:
    """Workload-identity style ADC: no private key, token only."""

    service_account_email = "superset@example.iam.gserviceaccount.com"
    token = "ya29.token"  # noqa: S105

    def refresh(self, request: Any) -> None:
        self.refreshed_with = request


@contextmanager
def _google_auth_modules(credentials: Any) -> Iterator[None]:
    """Inject fake google.auth modules so the lazy imports in
    generate_download_url resolve without google-cloud-storage installed."""
    auth = ModuleType("google.auth")
    auth.default = lambda scopes=None: (  # type: ignore[attr-defined]
        credentials,
        "example-project",
    )
    creds_mod = ModuleType("google.auth.credentials")
    creds_mod.Signing = _Signing  # type: ignore[attr-defined]
    transport = ModuleType("google.auth.transport")
    requests_mod = ModuleType("google.auth.transport.requests")
    requests_mod.Request = MagicMock  # type: ignore[attr-defined]
    auth.credentials = creds_mod  # type: ignore[attr-defined]
    auth.transport = transport  # type: ignore[attr-defined]
    transport.requests = requests_mod  # type: ignore[attr-defined]
    google = sys.modules.get("google") or ModuleType("google")
    google.auth = auth  # type: ignore[attr-defined]
    with patch.dict(
        sys.modules,
        {
            "google": google,
            "google.auth": auth,
            "google.auth.credentials": creds_mod,
            "google.auth.transport": transport,
            "google.auth.transport.requests": requests_mod,
        },
    ):
        yield


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
def test_generate_download_url_with_signing_credentials(
    mock_get_client: MagicMock,
) -> None:
    # Key-file ADC can sign locally: no signBlob kwargs are passed.
    blob = mock_get_client.return_value.bucket.return_value.blob.return_value
    blob.generate_signed_url.return_value = "https://storage.googleapis.com/signed"

    with _google_auth_modules(_SigningCredentials()):
        url = GCSExportStorage().generate_download_url(
            "my-bucket", "exports/1/abc.xlsx", 300
        )

    assert url == "https://storage.googleapis.com/signed"
    blob.generate_signed_url.assert_called_once_with(
        version="v4",
        expiration=timedelta(seconds=300),
        method="GET",
    )


@patch("superset.utils.gcs._get_client")
def test_generate_download_url_token_only_credentials_use_iam_signing(
    mock_get_client: MagicMock,
) -> None:
    # Token-only ADC (workload identity, GCE, Cloud Run) has no private key;
    # V4 signing must be routed through the IAM signBlob API by passing the
    # service account email and a fresh access token. Regression for the
    # AttributeError every download click hit on those setups.
    blob = mock_get_client.return_value.bucket.return_value.blob.return_value
    blob.generate_signed_url.return_value = "https://storage.googleapis.com/signed"
    credentials = _TokenOnlyCredentials()

    with _google_auth_modules(credentials):
        url = GCSExportStorage().generate_download_url(
            "my-bucket", "exports/1/abc.xlsx", 300
        )

    assert url == "https://storage.googleapis.com/signed"
    assert hasattr(credentials, "refreshed_with")
    blob.generate_signed_url.assert_called_once_with(
        version="v4",
        expiration=timedelta(seconds=300),
        method="GET",
        service_account_email="superset@example.iam.gserviceaccount.com",
        access_token="ya29.token",  # noqa: S106
    )


def test_implements_export_storage_protocol() -> None:
    assert isinstance(GCSExportStorage(), ExportStorage)


def test_get_client_missing_dependency_raises_actionable_error() -> None:
    # Regression: without google-cloud-storage installed (it is only an
    # optional install), calling into GCSExportStorage must surface an
    # actionable hint rather than a bare ModuleNotFoundError. Force the
    # import to fail so the test is deterministic whether or not the
    # package happens to be present in the environment.
    from superset.utils import gcs

    with (
        patch.dict(sys.modules, {"google.cloud": None}),
        pytest.raises(ImportError, match="excel-export-gcs"),
    ):
        gcs._get_client()
