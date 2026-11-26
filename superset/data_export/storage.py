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
"""Whether this deployment can run full data exports, and where they land.

Unlike the dashboard Excel export, a full export has no direct-download
fallback: a response-bound download is bounded by the request timeout, which
is the limit the feature exists to remove. Without storage and a worker the
endpoints refuse the request and say what is missing, rather than quietly
handing back a capped file.
"""

from __future__ import annotations

import logging
from functools import cache

from flask import current_app

logger = logging.getLogger(__name__)


@cache
def _warn_unavailable(reason: str) -> None:
    """Log once per process why full exports cannot run.

    The check runs on every page load and on every request, so one line is
    enough to explain why the option is missing or refused.
    """
    logger.warning(
        "Full data exports are unavailable: %s. They need EXPORT_STORAGE with "
        "both a 'bucket' and a 'backend' (e.g. "
        "superset.utils.s3.S3ExportStorage()) and a configured CELERY_CONFIG, "
        "because an uncapped export is written by a worker and delivered by "
        "link.",
        reason,
    )
    return None


def is_full_export_available() -> bool:
    """Whether a full export can be queued, uploaded and shared by link."""
    storage_config = current_app.config["EXPORT_STORAGE"]
    if not storage_config.get("bucket"):
        _warn_unavailable("EXPORT_STORAGE has no bucket")
        return False
    if storage_config.get("backend") is None:
        _warn_unavailable("EXPORT_STORAGE has no backend")
        return False
    if current_app.config.get("CELERY_CONFIG") is None:
        _warn_unavailable("CELERY_CONFIG is None")
        return False
    return True


def resolve_object_key(kind: str, job_id: str) -> str:
    """The storage object key this export's file is uploaded under."""
    key_prefix = current_app.config["FULL_DATA_EXPORT_KEY_PREFIX"]
    if callable(key_prefix):
        # Resolved per export, inside the worker, for deployments where it is
        # only known in task context (e.g. a multi-tenant installation
        # scoping a shared bucket per tenant).
        key_prefix = key_prefix()
    return f"{key_prefix}{kind}/{job_id}.csv"
