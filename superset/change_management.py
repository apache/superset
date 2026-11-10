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
"""Fail closed when review is promised but nothing is enforcing it.

``CHANGE_MANAGEMENT`` promises that a write to a governed asset reaches a
reviewer before it reaches a viewer. Nothing in core keeps that promise: the
gate that does lives in an extension, and an extension whose import fails is
logged and skipped (``init_extensions``). So the flag could be on with
nothing behind it -- every edit going straight live, no change request
created, and only a line in the log to say so. The feature failed open,
silently, in exactly the case it exists for.

Core cannot review anything, but it can refuse to pretend. A gate registers
itself here as it installs; while the flag is on and none has, every request
that could write is refused.

Two doors are covered, because there are two ways in that are not the same
code path:

* **Flask requests** -- the REST API and the legacy views. The
  ``before_request`` hook :func:`install_fail_closed_guard` installs refuses
  any request whose method can write.
* **MCP tool calls** -- :func:`refuse_unreviewed_tool_call`, which the MCP
  server calls before it dispatches a tool. MCP does not pass through Flask's
  request dispatch at all: FastMCP runs tools with an app context and no
  request, and under stdio there is no HTTP to hook. A ``before_request`` hook
  therefore never sees an MCP write, and an earlier version of this module
  claimed otherwise while every MCP write went live unreviewed.

Both ask the same question (:func:`review_promised_but_unenforced`) and give
the same refusal (:func:`unenforced_message`); they differ only in what
"could write" means for the kind of call.

It does not cover work started inside the process -- a CLI import, a Celery
task -- so those remain the gate's own problem.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

from flask import Flask, jsonify, request, Response

logger = logging.getLogger(__name__)

FEATURE_FLAG = "CHANGE_MANAGEMENT"

#: Methods that cannot change anything. A reader must still see the live
#: version while the deployment is broken -- and an operator must be able to
#: load the page that tells them it is.
READ_ONLY_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

#: Paths that stay open regardless, because refusing them locks out the
#: person who has to repair the deployment without protecting any asset.
ALWAYS_ALLOWED_PREFIXES = (
    "/login",
    "/logout",
    "/static/",
    "/health",
    "/healthz",
)

#: Reads that are POSTs, as patterns matched whole.
#:
#: The method is a poor test of whether something writes. Running a query is
#: a POST because the query goes in the body, and so is fetching the data
#: behind a chart, opening Explore, minting a permalink, and every piece of
#: per-viewer editor state SQL Lab keeps. None of them can change a
#: dashboard, a chart or a dataset.
#:
#: Refused with everything else, they took the whole product down rather
#: than its writes: no chart on any dashboard rendered for anybody, SQL Lab
#: could not open a tab, and nobody could authenticate through the API at
#: all. "Fail closed" is a statement about writes; applying it to reads
#: protects no asset and removes read-only analytics from everyone, which is
#: a bigger outage than the one it guards against. The tool half of this
#: module has always known the difference -- see
#: ``refuse_unreviewed_tool_call``'s ``read_only``.
#:
#: Matched with ``fullmatch`` rather than ``startswith``. Prefix matching
#: could not express the routes carrying an id in the middle
#: (``/api/v1/dashboard/<pk>/permalink``, which an earlier prefix entry
#: missed entirely while appearing to cover it), and it silently opened
#: anything sharing a prefix -- a future ``/api/v1/security/login_as``
#: would have been admitted by the entry for ``/api/v1/security/login``.
#: Each pattern is anchored, so a route is allowed only if it was written
#: down here.
_READ_ONLY_POST_PATTERNS = tuple(
    re.compile(pattern + r"/?")
    for pattern in (
        # Authenticating. Not a write, and the precondition for every other
        # allowance here: the browser form at `/login` was already exempt,
        # so a person at a keyboard could get in while every API client,
        # every embedded dashboard and the MCP service were refused at the
        # door. A guest token is how an embed authenticates a viewer.
        r"/api/v1/security/(login|refresh|guest_token)",
        # The data behind a chart.
        r"/api/v1/chart/data",
        # SQL Lab: run, cost-estimate, format, export results, permalink.
        r"/api/v1/sqllab/(execute|estimate|format_sql|export_streaming|permalink)",
        r"/api/v1/database/\d+/validate_sql",
        # SQL Lab's per-viewer editor state. Tabs, their contents and the
        # tables expanded in them are this user's workspace, not a governed
        # asset. With these refused SQL Lab cannot open or switch a tab, so
        # letting the query run and not the tab exist restored nothing.
        r"/tabstateview(/\d+)?(/(activate|migrate_query))?",
        r"/tabstateview/\d+/query/[^/]+",
        r"/tableschemaview(/\d+)?(/expanded)?",
        r"/sqllab",
        # Explore's own entry points, and the panes it draws from.
        r"/explore",
        r"/explore/[^/]+/\d+",
        r"/datasource/samples",
        r"/api/v1/datasource/[^/]+/\d+/(query|validate_expression|compatible)",
        # Transient per-viewer state a dashboard and Explore need in order
        # to draw: form data keys, filter state, permalinks. These write
        # only their own short-lived rows.
        r"/api/v1/explore/form_data(/[^/]+)?",
        r"/api/v1/explore/permalink",
        r"/api/v1/dashboard/\d+/filter_state(/[^/]+)?",
        # `<pk>` here, not `<int:pk>`: a dashboard is addressable by slug
        # and by uuid as well as by id, so this segment cannot be digits.
        # It still cannot reach the dashboard itself -- the `/permalink`
        # suffix is required.
        r"/api/v1/dashboard/[^/]+/permalink",
        # Stopping a query, and the frontend's own event log.
        r"/api/v1/query/stop",
        r"/api/v1/log",
        r"/log",
    )
)


def _is_a_read(path: str) -> bool:
    """Whether a non-GET path only answers a question."""
    return any(p.fullmatch(path) for p in _READ_ONLY_POST_PATTERNS)


_gate: Optional[str] = None


def register_write_gate(name: str) -> None:
    """Record that something is enforcing review.

    Called by the gate as it installs. The name is for the log line; what
    matters is that the call happened at all.
    """
    global _gate  # pylint: disable=global-statement
    _gate = name
    logger.info("change management: write gate registered by %s", name)


def is_write_gate_installed() -> bool:
    return _gate is not None


def _feature_on() -> bool:
    from superset.extensions import feature_flag_manager

    try:
        return feature_flag_manager.is_feature_enabled(FEATURE_FLAG)
    except Exception:  # pylint: disable=broad-except
        # Asked before the flags are configured. Nothing is being served
        # yet, so there is nothing to protect.
        return False


def review_promised_but_unenforced() -> bool:
    """Whether the flag claims review and no gate is there to do it."""
    return _feature_on() and not is_write_gate_installed()


def unenforced_message() -> dict[str, Any]:
    return {
        "errors": [
            {
                "message": (
                    "Change management is enabled but no review gate is "
                    "installed, so this write cannot be reviewed and has "
                    "been refused. Restore the extension that provides "
                    "the review gate, or turn the CHANGE_MANAGEMENT "
                    "feature flag off."
                ),
                "error_type": "CHANGE_MANAGEMENT_UNENFORCED",
                "level": "error",
            }
        ]
    }


def is_review_signal(error: BaseException) -> bool:
    """Whether an exception is "this write was captured", not "this failed".

    The gate lives in an extension, so core cannot name its exception type.
    It can recognise the shape: a capture carries ``review_required`` and a
    2xx ``status``, because the write was accepted and is waiting on a
    second person rather than having gone wrong.

    Callers that classify by status alone read the capture as a server
    fault -- which is how a held MCP write came back as "Internal error"
    and paged whoever owns ``MCP_ERROR_HOOK`` (QA-13).
    """
    if getattr(error, "review_required", False) is not True:
        return False
    status = getattr(error, "status", None)
    return isinstance(status, int) and 200 <= status < 300


def review_signal_details(error: BaseException) -> dict[str, Any]:
    """What a capture carries, read off the signal in one place.

    The gate lives in an extension, so this duck-types it the same way
    :func:`is_review_signal` does. The HTTP 202 body and the MCP tool
    result are both built from this, so the two cannot end up describing
    the same capture differently.
    """
    return {
        "id": getattr(error, "change_request_id", None),
        "ids": getattr(error, "change_request_ids", None),
        "count": getattr(error, "count", 1),
        "asset_type": getattr(error, "asset_type", None),
        "asset_id": getattr(error, "asset_id", None),
        "operation": getattr(error, "operation", None),
        "updated_existing": getattr(error, "updated_existing", False),
        "replaced_edit": getattr(error, "replaced_edit", False),
        "review_required": True,
    }


def install_fail_closed_guard(app: Flask) -> None:
    """Refuse writes while review is promised and unenforced."""

    @app.before_request
    def _refuse_unreviewed_writes() -> Optional[Response]:  # type: ignore[return-value]  # noqa: E501
        if request.method in READ_ONLY_METHODS:
            return None
        path = request.path or ""
        if path.startswith(ALWAYS_ALLOWED_PREFIXES):
            return None
        if _is_a_read(path):
            return None
        if not review_promised_but_unenforced():
            return None
        logger.error(
            "change management: refusing %s %s -- the feature flag is on but "
            "no review gate is installed",
            request.method,
            request.path,
        )
        return jsonify(unenforced_message()), 503  # type: ignore[return-value]


def refuse_unreviewed_tool_call(
    tool_name: str, *, read_only: bool
) -> Optional[dict[str, Any]]:
    """The MCP counterpart of the Flask hook: refuse a write, let a read by.

    Returns the refusal body when the call must be refused, else ``None``.
    ``read_only`` is the tool's own declaration (``readOnlyHint``) and the
    caller must pass ``False`` for a tool it could not resolve, so an unknown
    tool is treated as a writer -- the same way the Flask hook lets only
    ``GET``/``HEAD``/``OPTIONS`` by and refuses every other method.

    There is no tool equivalent of ``ALWAYS_ALLOWED_PREFIXES``. Those paths
    exist so an operator can still sign in and see that the deployment is
    broken; over MCP the only such tool is ``health_check``, and it is
    read-only already.
    """
    if read_only:
        return None
    if not review_promised_but_unenforced():
        return None
    logger.error(
        "change management: refusing MCP tool %s -- the feature flag is on but "
        "no review gate is installed",
        tool_name,
    )
    return unenforced_message()
