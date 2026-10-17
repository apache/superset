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
"""Runtime Content Security Policy (CSP) allowlist.

This module merges operator-curated *runtime* CSP allowlist entries (the
``csp_allowlist`` table) into the response CSP header that flask-talisman sets at
request time. It is intentionally inert unless the ``CSP_RUNTIME_ALLOWLIST``
feature flag is enabled, so the static deploy-time policy remains the default and
operators opt in to runtime overrides explicitly.
"""

from __future__ import annotations

import time
from collections import OrderedDict
from urllib.parse import urlparse

from flask import current_app, Response

from superset.extensions import feature_flag_manager

#: CSP directives an allowlist entry is permitted to widen. Restricting the set
#: keeps an entry from, say, loosening ``script-src`` in a way that would defeat
#: the nonce/strict-dynamic protections.
ALLOWED_DIRECTIVES = frozenset(
    {
        "frame-src",
        "child-src",
        "img-src",
        "connect-src",
        "media-src",
        "font-src",
    }
)

CSP_HEADER = "Content-Security-Policy"
CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only"


def is_valid_csp_origin(origin: str) -> bool:
    """Return ``True`` if ``origin`` is a bare ``scheme://host[:port]`` source.

    The check is deliberately strict: it rejects wildcards, paths, query strings,
    fragments and embedded credentials so that an allowlist entry can only ever
    widen the policy to one specific, fully-qualified origin. This is the
    server-side enforcement point — the frontend performs the same check for UX,
    but must not be relied upon for security.
    """
    if not origin or any(ch.isspace() for ch in origin):
        return False
    if "*" in origin:
        return False
    try:
        parsed = urlparse(origin)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    if not parsed.hostname:
        return False
    if parsed.username or parsed.password:
        return False
    if parsed.path or parsed.query or parsed.fragment:
        return False
    return True


def is_valid_csp_directive(directive: str) -> bool:
    """Return ``True`` if ``directive`` is one an entry may widen."""
    return directive in ALLOWED_DIRECTIVES


def _parse_csp(value: str) -> "OrderedDict[str, list[str]]":
    """Parse a CSP header string into an ordered ``directive -> sources`` map."""
    directives: OrderedDict[str, list[str]] = OrderedDict()
    for part in value.split(";"):
        tokens = part.split()
        if not tokens:
            continue
        directives[tokens[0]] = tokens[1:]
    return directives


def _serialize_csp(directives: "OrderedDict[str, list[str]]") -> str:
    """Serialize a ``directive -> sources`` map back into a CSP header string."""
    return "; ".join(
        " ".join([name, *sources]).strip() for name, sources in directives.items()
    )


def merge_allowlist_into_csp(header_value: str, additions: dict[str, list[str]]) -> str:
    """Merge ``additions`` into an existing CSP header value.

    For a directive that already exists, missing origins are appended. For a
    directive that does not exist yet (e.g. ``frame-src`` when the base policy
    only declares ``default-src``), the directive is seeded with ``'self'`` so the
    addition widens rather than unexpectedly narrows the effective policy.
    """
    directives = _parse_csp(header_value)
    for directive, domains in additions.items():
        sources = directives.get(directive)
        if sources is None:
            directives[directive] = ["'self'", *domains]
        else:
            for domain in domains:
                if domain not in sources:
                    sources.append(domain)
    return _serialize_csp(directives)


class _CSPAllowlistCache:
    """In-process, time-bounded cache of the runtime CSP allowlist.

    The metadata DB is the source of truth; this cache only exists to avoid a
    query on every response. A write through the REST API invalidates the cache
    in the worker that handled it; other workers converge once their copy
    expires (``CSP_RUNTIME_ALLOWLIST_CACHE_TTL`` seconds).
    """

    def __init__(self) -> None:
        self._directive_map: dict[str, list[str]] | None = None
        self._loaded_at: float = 0.0

    def get(self) -> dict[str, list[str]]:
        ttl = current_app.config.get("CSP_RUNTIME_ALLOWLIST_CACHE_TTL", 30)
        now = time.monotonic()
        if self._directive_map is None or (now - self._loaded_at) > ttl:
            self._directive_map = self._load()
            self._loaded_at = now
        return self._directive_map

    @staticmethod
    def _load() -> dict[str, list[str]]:
        # Imported lazily to avoid a circular import at module load time.
        from superset.daos.csp import CSPAllowlistDAO

        directive_map: dict[str, list[str]] = {}
        for entry in CSPAllowlistDAO.find_all():
            if not is_valid_csp_directive(entry.directive):
                # Defensive: never trust a stale/legacy row to widen an
                # unexpected directive.
                continue
            directive_map.setdefault(entry.directive, []).append(entry.domain)
        return directive_map

    def invalidate(self) -> None:
        self._directive_map = None
        self._loaded_at = 0.0


csp_allowlist_cache = _CSPAllowlistCache()


def invalidate_csp_allowlist_cache() -> None:
    """Drop this worker's cached copy of the allowlist (call after a write)."""
    csp_allowlist_cache.invalidate()


def apply_runtime_csp_allowlist(response: Response) -> Response:
    """Merge runtime allowlist entries into the response CSP header(s).

    Registered as an ``after_request`` handler *before* flask-talisman so that it
    runs *after* Talisman has set the header (Flask invokes ``after_request``
    callbacks in reverse registration order). A no-op unless the
    ``CSP_RUNTIME_ALLOWLIST`` feature flag is enabled and the allowlist is
    non-empty.
    """
    if not feature_flag_manager.is_feature_enabled("CSP_RUNTIME_ALLOWLIST"):
        return response
    additions = csp_allowlist_cache.get()
    if not additions:
        return response
    for header in (CSP_HEADER, CSP_REPORT_ONLY_HEADER):
        value = response.headers.get(header)
        if value:
            response.headers[header] = merge_allowlist_into_csp(value, additions)
    return response
