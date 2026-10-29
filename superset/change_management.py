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

This covers everything that arrives over HTTP, which is the REST API, the
legacy views and MCP. It does not cover work started inside the process --
a CLI import, a Celery task -- so those remain the gate's own problem.
"""

from __future__ import annotations

import logging
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
                    "been refused. Restore the asset-approval extension, "
                    "or turn the CHANGE_MANAGEMENT feature flag off."
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


def install_fail_closed_guard(app: Flask) -> None:
    """Refuse writes while review is promised and unenforced."""

    @app.before_request
    def _refuse_unreviewed_writes() -> Optional[Response]:  # type: ignore[return-value]  # noqa: E501
        if request.method in READ_ONLY_METHODS:
            return None
        if (request.path or "").startswith(ALWAYS_ALLOWED_PREFIXES):
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
