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
"""Optional "download reason" capture for data exports.

When the ``REQUIRE_DOWNLOAD_REASON`` config setting is on, the frontend asks the
user for a reason before exporting data (CSV/XLSX from SQL Lab, Explore and
dashboards) and sends it as the ``download_reason`` request parameter. Export
endpoints reject requests without one. Nothing else is needed to persist it:
the event logger already merges the request's query string and form fields into
the ``logs.json`` payload (see ``collect_request_payload``), so the reason shows
up in Security → Action Log without any new table.
"""

from __future__ import annotations

from flask import current_app, request
from flask_babel import gettext as _

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException

DOWNLOAD_REASON_PARAM = "download_reason"
DOWNLOAD_REASON_CONFIG_KEY = "REQUIRE_DOWNLOAD_REASON"
# Keep audit payloads (and GET export URLs) bounded; the frontend enforces the
# same limit on input.
DOWNLOAD_REASON_MAX_LENGTH = 255


class DownloadReasonRequiredError(SupersetErrorException):
    """Raised when the setting is on and an export request carries no reason."""

    status = 400

    def __init__(self) -> None:
        super().__init__(
            SupersetError(
                message=_("A reason is required to download data."),
                error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                level=ErrorLevel.ERROR,
            )
        )


def get_download_reason() -> str | None:
    """Return the first non-blank ``download_reason`` from the query string or form."""
    for source in (request.args, request.form):
        value = (source.get(DOWNLOAD_REASON_PARAM) or "").strip()
        if value:
            return value[:DOWNLOAD_REASON_MAX_LENGTH]
    return None


def is_download_reason_required() -> bool:
    """Whether ``REQUIRE_DOWNLOAD_REASON`` is on for this deployment.

    A plain config setting (not a feature flag): it is a long-lived deployment
    policy, not a rollout toggle. Every consumer reads it through this helper.
    """
    return bool(current_app.config.get(DOWNLOAD_REASON_CONFIG_KEY, False))


def check_download_reason() -> str | None:
    """Enforce ``REQUIRE_DOWNLOAD_REASON``.

    Returns the reason (or ``None``). Raises :class:`DownloadReasonRequiredError`
    when the setting is on and the request carries no reason.
    """
    reason = get_download_reason()
    if reason is None and is_download_reason_required():
        raise DownloadReasonRequiredError()
    return reason
