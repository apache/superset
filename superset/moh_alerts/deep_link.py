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
"""Deep-link builder (Section 10.3 of the design spec).

Builds a dashboard URL pre-filtered to a recipient's org unit by persisting
a native-filter state through the same filter_state API the browser uses,
then returning ``?native_filters=<key>``.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import requests
from flask import current_app
from flask_login import current_user

from superset.utils import json

if TYPE_CHECKING:
    from superset.models.moh_alert import MohAlert

logger = logging.getLogger(__name__)


def _build_data_mask(
    filter_id: str,
    org_unit_id: str,
    org_unit_col: str = "org_unit_id",
) -> dict:
    """Construct the native-filter data mask for the org-unit tree filter.

    Mirrors the payload the frontend FilterBar posts via
    ``/api/v1/dashboard/<id>/filter_state`` when a user selects an org unit.
    """
    return {
        filter_id: {
            "currentState": {},
            "filterState": {
                "value": [org_unit_id],
            },
            "extraFormData": {
                "filters": [
                    {
                        "col": org_unit_col,
                        "op": "IN",
                        "val": [org_unit_id],
                    }
                ]
            },
        }
    }


def _filter_state_url(alert: MohAlert) -> str:
    base = current_app.config["MOH_ALERTS_WEB_HOST"].rstrip("/")
    dashboard_id = (
        alert.dashboard_id or current_app.config["MOH_ALERTS_TRACE_DASHBOARD_ID"]
    )
    return f"{base}/api/v1/dashboard/{dashboard_id}/filter_state"


def _web_base() -> str:
    return current_app.config["MOH_ALERTS_WEB_HOST"].rstrip("/")


def build_deep_link(
    alert: MohAlert,
    org_unit_id: str,
    org_unit_col: str = "org_unit_id",
) -> str | None:
    """Persist a filter state for ``org_unit_id`` and return the dashboard URL.

    Uses the authenticated session of the current request when available;
    otherwise falls back to the MOH_ALERTS_SYSTEM_USER service account.  The
    dashboard must be visible to the acting user, otherwise the API responds
    401/403 and ``None`` is returned.
    """
    filter_id = current_app.config["MOH_ALERTS_ORG_UNIT_FILTER_ID"]
    payload = _build_data_mask(filter_id, org_unit_id, org_unit_col)
    body = json.dumps(payload)

    session = requests.Session()
    cookies = getattr(current_user, "_cookies", None) or {}
    session.cookies.update(cookies)

    try:
        resp = session.post(
            _filter_state_url(alert),
            json={"value": body, "tab_id": 1},
            timeout=30,
        )
        if resp.status_code != 201:
            logger.warning(
                "deep link failed (%s): %s", resp.status_code, resp.text[:200]
            )
            return None
        key = resp.json().get("key")
        if not key:
            return None
    except requests.RequestException as ex:  # pragma: no cover
        logger.warning("deep link request error: %s", ex)
        return None

    dashboard_id = (
        alert.dashboard_id or current_app.config["MOH_ALERTS_TRACE_DASHBOARD_ID"]
    )
    return f"{_web_base()}/superset/dashboard/{dashboard_id}/?native_filters={key}"
