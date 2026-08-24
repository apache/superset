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
Pluggable storage backend interface for dashboard Excel export artifacts.

Defining ``EXCEL_EXPORT_STORAGE`` in ``superset_config.py`` (an instance of a
class implementing this protocol, the same pattern as ``RESULTS_BACKEND`` or
``CUSTOM_SECURITY_MANAGER``) swaps out where the export task uploads the
generated ``.xlsx`` and how the download redirect mints a fresh, time-limited
URL for it. When unset, ``superset.utils.s3`` (boto3/AWS S3) is used.

This module has no dependency on any storage SDK: it is safe to import (e.g.
from ``superset/config.py``) regardless of which storage extras, if any, are
installed. A concrete implementation -- such as a hypothetical
``GCSExportStorage`` for deployments where the export bucket is a native
Google Cloud Storage bucket rather than S3 -- imports its own SDK lazily, the
same way ``superset.utils.s3`` only imports ``boto3`` inside the functions
that need it.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class ExportStorage(Protocol):
    """Where the export task uploads a file, and how a download link resolves
    it back to a fresh, time-limited URL at click time.

    The two operations run at very different times against the same object:
    ``upload_file`` once, when the export finishes; ``generate_download_url``
    every time the (possibly long-lived) download link is clicked, so its
    credentials never need to outlive the link itself. See
    ``superset.dashboards.excel_export.download_link`` for why the link is a
    Superset redirect rather than a raw storage URL.
    """

    def upload_file(self, local_path: str, bucket: str, key: str) -> None:
        """Upload a local file to ``bucket``/``key``."""

    def generate_download_url(self, bucket: str, key: str, expires_in: int) -> str:
        """A time-limited URL for downloading ``bucket``/``key``, valid for
        ``expires_in`` seconds from now."""
