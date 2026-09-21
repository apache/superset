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

When the REQUIRE_DOWNLOAD_REASON feature flag is on, the frontend asks the
user for a reason before exporting data (CSV/XLSX from SQL Lab, Explore and
dashboards) and sends it as the download_reason request parameter. Export
endpoints reject requests without one and attach the reason to their event log
entry (logs.json), so downloads can be audited from Security → Action Log
without any new table.
"""

from __future__ import annotations

from typing import Callable

from flask import request
from flask_babel import gettext as _

from superset import is_feature_enabled
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException

DOWNLOAD_REASON_PARAM = "download_reason"
DOWNLOAD_REASON_FEATURE_FLAG = "REQUIRE_DOWNLOAD_REASON"


class DownloadReasonRequiredError(SupersetErrorException):
    """Raised when the flag is on and an export request carries no reason."""

    status = 400

    def __init__(self) -> None:
        super().__init__(
            SupersetError(
                message=_("A reason is required to download data."),
                error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
                level=ErrorLevel.ERROR,
            ),
            status=400,
        )


def get_download_reason() -> str | None:
    """Return the trimmed download_reason from the query string or form."""
    value = request.args.get(DOWNLOAD_REASON_PARAM) or request.form.get(
        DOWNLOAD_REASON_PARAM
    )
    value = value.strip() if value else ""
    return value or None


def check_download_reason(
    add_extra_log_payload: Callable[..., None] | None = None,
) -> str | None:
    """Enforce REQUIRE_DOWNLOAD_REASON and record the reason in the event log.

    Returns the reason (or None). Raises :class:`DownloadReasonRequiredError`
    when the flag is on and the request carries no reason.
    """
    reason = get_download_reason()
    if reason is None and is_feature_enabled(DOWNLOAD_REASON_FEATURE_FLAG):
        raise DownloadReasonRequiredError()
    if reason and add_extra_log_payload is not None:
        add_extra_log_payload(download_reason=reason)
    return reason
