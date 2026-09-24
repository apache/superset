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
"""Check whether dashboard Excel export storage is configured."""

from __future__ import annotations

import logging
from functools import cache

from flask import current_app

logger = logging.getLogger(__name__)


@cache
def _warn_partial_storage(missing_key: str) -> None:
    """Log a partial ``EXPORT_STORAGE`` once per process.

    The check runs on every page load, and one line is enough to explain why
    exports stopped being queued.
    """
    logger.warning(
        "EXPORT_STORAGE has no %s, so dashboard Excel exports are downloaded "
        "directly and image exports are unavailable. Set both a bucket and a "
        "backend to run them in the background.",
        missing_key,
    )


def is_export_storage_configured() -> bool:
    """Return whether exports can be uploaded and shared by link.

    Both a bucket and a backend are required; the task cannot upload without
    either, so a partial ``EXPORT_STORAGE`` falls back to direct downloads.
    """
    storage_config = current_app.config["EXPORT_STORAGE"]
    has_bucket = bool(storage_config.get("bucket"))
    has_backend = storage_config.get("backend") is not None
    if has_bucket != has_backend:
        _warn_partial_storage("backend" if has_bucket else "bucket")
    return has_bucket and has_backend
