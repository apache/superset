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
Pluggable storage backend interface for generated export artifacts
(dashboard Excel exports, and potentially other export file types).

``EXPORT_STORAGE["backend"]`` in ``superset_config.py`` must be set to
an instance of a class implementing this protocol (the same "instance in
config" pattern as ``RESULTS_BACKEND`` or ``CUSTOM_SECURITY_MANAGER``): it is
where an export task uploads its generated file and how the download
endpoint streams it back at click time. There is no implicit
default -- pick the backend matching the bucket's provider:
``superset.utils.s3.S3ExportStorage`` (boto3/AWS S3) or
``superset.utils.gcs.GCSExportStorage`` (Google Cloud Storage), or supply a
custom implementation.

This module has no dependency on any storage SDK: it is safe to import (e.g.
from ``superset/config.py``) regardless of which storage extras, if any, are
installed. The concrete implementations import their own SDKs lazily, so a
backend's dependency is only required once an export actually runs.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import NamedTuple, Protocol, runtime_checkable


class ExportDownload(NamedTuple):
    """A downloadable object: its total size in bytes and its content chunks.

    The size lets the download endpoint set ``Content-Length``, so a stream
    that dies midway is detected by the browser as a failed download instead
    of being saved as a silently truncated file."""

    size: int
    chunks: Iterator[bytes]


@runtime_checkable
class ExportStorage(Protocol):
    """Where the export task uploads a file, and how the download endpoint
    reads it back at click time.

    Downloads stream through Superset with the deployment's own storage
    credentials rather than redirecting to a signed storage URL: signing is
    impossible for some ambient identities (e.g. direct workload identity
    federation, which has no service account to sign as), and a signed URL is
    a transferable bearer credential Superset can neither observe nor revoke
    once issued. See ``superset.dashboards.excel_export.download_link`` for
    the link's own lifetime model.
    """

    def upload_file(self, local_path: str, bucket: str, key: str) -> None:
        """Upload a local file to ``bucket``/``key``."""

    def download(self, bucket: str, key: str) -> ExportDownload:
        """The object at ``bucket``/``key`` as ``(size, chunks)``.

        Existence is checked eagerly: raises ``FileNotFoundError`` at call
        time when the object does not exist (e.g. removed by a bucket
        lifecycle rule before the link expired)."""
