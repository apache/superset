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
"""Per-tool-call SQLAlchemy session scoping for the MCP service.

``db.session`` is a flask-sqlalchemy 2.5.1 scoped session whose registry is
keyed by greenlet ident. Async MCP tool calls are asyncio tasks on one
event-loop greenlet, so concurrent calls resolve to the SAME ``Session``
even though each call pushes its own app context; the first call to finish
then removes that shared session at app-context teardown and detaches the
other calls' instances (DetachedInstanceError on the next attribute read).

Keying the registry on a per-call ContextVar token instead gives every tool
call its own ``Session`` while the app-context teardown removes exactly that
call's session. Outside MCP tool calls the scope falls back to the greenlet
ident, so web, CLI, and Celery behavior is unchanged.
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from typing import Any

logger = logging.getLogger(__name__)

try:
    from greenlet import getcurrent as _ident_func
except ImportError:  # pragma: no cover
    from threading import get_ident as _ident_func

# Set by _get_app_context_manager() for the duration of one MCP tool call.
_mcp_session_token: ContextVar[Any] = ContextVar(
    "superset_mcp_session_token", default=None
)


def mcp_session_scopefunc() -> Any:
    """Registry key: per-call token inside MCP tool calls, greenlet otherwise."""
    if (token := _mcp_session_token.get()) is not None:
        return ("mcp_tool_call", id(token))
    return _ident_func()


def install_mcp_session_scoping() -> None:
    """Point ``db.session``'s registry at the MCP-aware scopefunc (idempotent)."""
    from superset.extensions import db

    registry = getattr(db.session, "registry", None)
    if registry is not None and hasattr(registry, "scopefunc"):
        registry.scopefunc = mcp_session_scopefunc
    else:  # pragma: no cover
        logger.warning(
            "db.session has no scopefunc-based registry; "
            "MCP per-call session scoping not installed"
        )
