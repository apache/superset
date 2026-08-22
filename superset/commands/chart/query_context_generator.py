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
Faithful ``query_context`` synthesis by running the real frontend ``buildQuery``
on the backend (Apache Superset #33615, ADR-013 refinement).

The ``form_data -> query_context`` mapping is per-viz-plugin JavaScript
(``buildQuery.ts``); a generic Python derivation can only approximate it. This
module evaluates a pre-built JS bundle of those ``buildQuery`` functions inside
V8 (``py_mini_racer``) and calls ``generateQueryContext(viz_type, form_data)`` —
producing the exact context the UI would.

It is best-effort and NON-FATAL: if ``py_mini_racer`` is missing, the bundle has
not been built, or evaluation fails, :meth:`QueryContextGenerator.generate`
returns ``None`` and the caller falls back to the pure-Python generic derivation
(:func:`superset.commands.chart.query_context_builder.build_query_context_config`).

Build the bundle with ``npm run build:backend-querycontext`` (from
``superset-frontend/``); the artifact lands at
``superset/commands/chart/_bundles/query_context_bundle.js``.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Optional

from superset.utils import json

logger = logging.getLogger(__name__)

_BUNDLE_PATH = os.path.join(
    os.path.dirname(__file__), "_bundles", "query_context_bundle.js"
)

# Minimal globals a browser-targeted bundle may touch at load time. Kept as small
# as possible; expand only if a real load error demands it.
_BROWSER_SHIMS = """
var globalThis = (typeof globalThis !== 'undefined') ? globalThis : this;
var self = globalThis;
var window = globalThis;
var navigator = { userAgent: 'superset-backend' };
var document = undefined;
"""

# Sentinels the JS entry returns instead of a context; each means "fall back".
_FALLBACK_SENTINELS = ("__unsupported__", "__error__")


class QueryContextGenerator:
    """Lazy V8-backed generator. Thread-safe (a lock serializes V8 access)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._ctx: Any = None
        self._available: Optional[bool] = None  # None = not yet initialized
        self._logged_unavailable = False

    def _ensure_ctx(self) -> bool:
        """Initialize the V8 context once. Returns availability; never raises."""
        if self._available is not None:
            return self._available
        try:
            from py_mini_racer import (
                MiniRacer,  # pylint: disable=import-outside-toplevel
            )
        except Exception as ex:  # pylint: disable=broad-except
            self._available = False
            logger.info(
                "Backend query_context generator disabled: py_mini_racer "
                "unavailable (%s). Falling back to generic derivation.",
                ex,
            )
            return False

        if not os.path.exists(_BUNDLE_PATH):
            self._available = False
            logger.info(
                "Backend query_context generator disabled: bundle not built at "
                "%s (run `npm run build:backend-querycontext`). Falling back to "
                "generic derivation.",
                _BUNDLE_PATH,
            )
            return False

        try:
            with open(_BUNDLE_PATH, encoding="utf-8") as fh:
                bundle_src = fh.read()
            ctx = MiniRacer()
            ctx.eval(_BROWSER_SHIMS)
            ctx.eval(bundle_src)
            # Smoke-test that the callable is present.
            ctx.eval("typeof generateQueryContext === 'function'")
            self._ctx = ctx
            self._available = True
            logger.info("Backend query_context generator ready (V8 buildQuery).")
            return True
        except Exception as ex:  # pylint: disable=broad-except
            self._available = False
            logger.warning(
                "Backend query_context generator failed to initialize (%s). "
                "Falling back to generic derivation.",
                ex,
            )
            return False

    def generate(
        self, viz_type: str, params: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        """
        Run the real frontend ``buildQuery`` for ``viz_type`` over ``params``.

        Returns the ``query_context`` dict, or ``None`` when the generator is
        unavailable, the viz type is not in the bundle, or generation errors —
        in every ``None`` case the caller falls back. Never raises.
        """
        with self._lock:
            if not self._ensure_ctx():
                return None
            try:
                raw = self._ctx.call(
                    "generateQueryContext", viz_type, json.dumps(params)
                )
            except Exception as ex:  # pylint: disable=broad-except
                if not self._logged_unavailable:
                    logger.warning(
                        "Backend query_context generation raised for viz_type "
                        "%s (%s); falling back.",
                        viz_type,
                        ex,
                    )
                    self._logged_unavailable = True
                return None

        if not raw:
            return None
        try:
            result = json.loads(raw) if isinstance(raw, str) else raw
        except (ValueError, TypeError):
            return None
        if not isinstance(result, dict):
            return None
        if any(sentinel in result for sentinel in _FALLBACK_SENTINELS):
            logger.debug(
                "Backend generator returned sentinel for viz_type %s (%s); "
                "falling back to generic derivation.",
                viz_type,
                {k: result[k] for k in _FALLBACK_SENTINELS if k in result},
            )
            return None
        return result


_GENERATOR: Optional[QueryContextGenerator] = None
_GENERATOR_LOCK = threading.Lock()


def get_query_context_generator() -> QueryContextGenerator:
    """Return the process-wide generator singleton (lazy)."""
    global _GENERATOR  # pylint: disable=global-statement
    if _GENERATOR is None:
        with _GENERATOR_LOCK:
            if _GENERATOR is None:
                _GENERATOR = QueryContextGenerator()
    return _GENERATOR
