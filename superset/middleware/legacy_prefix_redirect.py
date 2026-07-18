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
"""Outermost WSGI shim that 308-redirects legacy ``/superset/<canonical>``
paths to ``/<canonical>``.

After ``Superset.route_base = ""`` collapsed the historical ``/superset``
prefix off every view, bookmarks/email links/external integrations to the
legacy paths would 404. This middleware closes that gap for one release
cycle (removed at EOL ``5.0.0``, matching the ``@deprecated`` gate on
``Superset.explore`` and ``Superset.explore_json``).

Layering invariant
------------------
This shim must wrap **outside** every other WSGI middleware so it sees the
raw inbound ``PATH_INFO``. ``superset/app.py`` installs it unconditionally
*after* ``init_app()`` returns (and therefore after
``configure_middlewares()`` has applied ``AppRootMiddleware`` /
``ProxyFix`` / ``ChunkedEncodingFix`` / ``ADDITIONAL_MIDDLEWARE``).

The ``Location`` header is built from the ``app_root`` captured at
construction + the canonical path. It **never** consults
``environ["SCRIPT_NAME"]`` (set only at request time by
``AppRootMiddleware``, which wraps inside this shim) or any
``X-Forwarded-*`` header. Proxies that strip the legacy prefix externally
are out of scope — the proxy must forward the raw client path for the
shim to see it.

Disposition rules
-----------------
* GET against any enumerated row → 308 Permanent Redirect.
* HEAD is folded to GET before the method check, so it tracks GET exactly:
  it 308s wherever GET does, and 410s against a POST-only canonical.
* POST against a POST-capable canonical → 308 (body-preserving).
* POST against a GET-only canonical → 410 Gone (308 would 405 on retry).
* Anything not in :data:`LEGACY_REDIRECT_MAP` → pass through unchanged.

``/superset/sql/<database_id>/`` has no 1:1 path mapping — ``Database.sql_url``
changed shape to ``/sqllab/?dbid=<id>`` (query string, not a path). It is
therefore handled by a dedicated special case (:data:`_LEGACY_SQL_RE`) rather
than the closed-set map: a numeric ``<database_id>`` 308-redirects to
``/sqllab/?dbid=<id>`` (merging any inbound query string with ``&``); a
non-numeric tail falls through to the closed-set map (→ 404), preserving
closed-set discipline.
"""

from __future__ import annotations

import re
import sys
from typing import Iterable, Optional
from urllib.parse import quote

from werkzeug.wrappers import Response

if sys.version_info >= (3, 11):
    from wsgiref.types import StartResponse, WSGIApplication, WSGIEnvironment
else:
    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from _typeshed.wsgi import StartResponse, WSGIApplication, WSGIEnvironment

#: The legacy URL token the shim recognises. Hard-coded — not configurable.
_LEGACY_PREFIX: str = "/superset"

#: Special case for the legacy SQL Lab deep link. Matches the ``/superset``-
#: stripped tail ``/sql/<database_id>/`` where ``<database_id>`` is numeric
#: (the historical ``@expose("/sql/<int:database_id>/")`` GET route). Redirected
#: to the migrated query-string shape ``/sqllab/?dbid=<id>`` rather than via the
#: closed-set map, since it is a path→query-string transform, not a 1:1 path map.
#: A non-numeric tail does not match and falls through to the map (→ 404).
_LEGACY_SQL_RE: re.Pattern[str] = re.compile(r"^/sql/(\d+)/?$")

#: Closed table mapping legacy canonical paths (the part *after*
#: ``_LEGACY_PREFIX``) to ``(allowed_methods, canonical_path)``.
#:
#: Keys ending in ``/`` are **prefix** rules — they match any inbound path
#: that starts with the key, and the tail is appended to the canonical
#: path verbatim. Keys without a trailing ``/`` are **exact** rules.
#:
#: Each method tuple is verified against the canonical endpoint's actual
#: ``@expose`` decorator at HEAD ``1bc20f2206``; any change to a canonical
#: endpoint's allowed methods MUST update the corresponding row (and the
#: closed-set regression test in
#: ``tests/unit_tests/middleware/test_legacy_prefix_redirect.py``).
LEGACY_REDIRECT_MAP: dict[str, tuple[frozenset[str], str]] = {
    # views/core.py — Superset (route_base = "")
    "/welcome/": (frozenset({"GET"}), "/welcome/"),
    "/dashboard/": (frozenset({"GET"}), "/dashboard/"),
    "/dashboard/p/": (frozenset({"GET"}), "/dashboard/p/"),
    "/slice/": (frozenset({"GET"}), "/slice/"),
    "/warm_up_cache/": (frozenset({"GET"}), "/warm_up_cache/"),
    "/fetch_datasource_metadata": (
        frozenset({"GET"}),
        "/fetch_datasource_metadata",
    ),
    "/language_pack/": (frozenset({"GET"}), "/language_pack/"),
    "/file-handler": (frozenset({"GET"}), "/file-handler"),
    "/log/": (frozenset({"POST"}), "/log/"),
    "/sqllab/history/": (frozenset({"GET"}), "/sqllab/history/"),
    # NOTE: the /explore_json[/data] canonicals below (Superset.explore_json /
    # explore_json_data) are themselves @deprecated. When those endpoints are
    # deleted these rows become redirects-to-404 — prune them (and their
    # closed-set snapshot entries) in the same PR that removes the endpoints.
    "/explore_json/": (frozenset({"GET", "POST"}), "/explore_json/"),
    "/explore_json/data/": (frozenset({"GET"}), "/explore_json/data/"),
    # views/explore.py — ExploreView (route_base = "/explore") owns the
    # bare /explore/ rule; Superset.explore (deprecated) provides the
    # POST handler. ExplorePermalinkView.permalink (route_base = "")
    # owns /explore/p/<key>/.
    "/explore/": (frozenset({"GET", "POST"}), "/explore/"),
    "/explore/p/": (frozenset({"GET"}), "/explore/p/"),
    # views/tags.py — TagModelView.list (route_base = "/tags", @expose("/"))
    "/tags/": (frozenset({"GET"}), "/tags/"),
    # views/all_entities.py — TaggedObjectsModelView.list (route_base = "/all_entities")
    "/all_entities/": (frozenset({"GET"}), "/all_entities/"),
}

# Precompute prefix keys ordered longest-first so /dashboard/p/ wins over
# /dashboard/ etc. Static — computed at module import, no per-request cost.
_PREFIX_KEYS: tuple[str, ...] = tuple(
    sorted(
        (k for k in LEGACY_REDIRECT_MAP if k.endswith("/")),
        key=len,
        reverse=True,
    )
)


def _match(
    canonical_after_strip: str,
) -> Optional[tuple[frozenset[str], str]]:
    """Find the matching row for a path that has had ``_LEGACY_PREFIX``
    already stripped.

    Returns ``(allowed_methods, canonical_target)`` or ``None`` if the
    path is not in the closed set.
    """
    # 1. Exact match on a non-prefix key (e.g. "/file-handler").
    if canonical_after_strip in LEGACY_REDIRECT_MAP:
        methods, target = LEGACY_REDIRECT_MAP[canonical_after_strip]
        if not canonical_after_strip.endswith("/"):
            return methods, target
        # Trailing-slash keys (e.g. "/dashboard/") deliberately fall through to
        # step 2 instead of early-returning. A trailing-slash key is also a
        # prefix key, so the same key handles both the bare path ("/dashboard/",
        # tail == "") and any sub-path ("/dashboard/5/", tail == "5/") through a
        # single code path. Early-returning here would special-case the bare
        # path for no gain — step 2 yields the identical (methods, target) row.
    # 2. Longest-prefix match across keys ending in "/".
    for key in _PREFIX_KEYS:
        if canonical_after_strip.startswith(key):
            methods, target_root = LEGACY_REDIRECT_MAP[key]
            tail = canonical_after_strip[len(key) :]
            return methods, target_root + tail
    return None


class LegacyPrefixRedirectMiddleware:
    """308-redirects legacy ``/superset/<canonical>`` paths to ``/<canonical>``.

    Mirrors the construction-time capture pattern used by
    :class:`superset.app.AppRootMiddleware`. ``app_root`` is captured here
    and never re-read from ``environ`` — see the module docstring for why.
    """

    def __init__(
        self,
        wsgi_app: "WSGIApplication",
        app_root: str,
    ):
        self.wsgi_app = wsgi_app
        # Strip a single trailing slash so "/" and "/superset/" both
        # produce the same Location prefix at build time. Empty string is
        # correct for app_root == "/".
        self.app_root_prefix: str = app_root.rstrip("/")

    def __call__(
        self,
        environ: "WSGIEnvironment",
        start_response: "StartResponse",
    ) -> Iterable[bytes]:
        path_info: str = environ.get("PATH_INFO", "")
        method: str = environ.get("REQUEST_METHOD", "GET").upper()
        # HEAD is GET-without-a-body (RFC 9110 §9.3.2) and Werkzeug registers
        # it implicitly on every GET rule, so LEGACY_REDIRECT_MAP spells only
        # the methods the canonical @expose decorators name explicitly — never
        # HEAD. Fold it to GET for the method checks below; otherwise every
        # legacy HEAD probe (link-checkers, uptime monitors, `curl -I`) falls
        # into the wrong-method branch and gets a spurious 410 Gone.
        method_for_match: str = "GET" if method == "HEAD" else method

        # Under a subdirectory deployment, legacy bookmarks carry the app
        # root too (`/myapp/superset/dashboard/1/`) — this shim sits outside
        # AppRootMiddleware, so the raw PATH_INFO still has the app-root
        # prefix. Strip it (segment-boundary aware) before the legacy-prefix
        # check so both `/superset/...` and `{app_root}/superset/...` forms
        # are recognised. The Location below is built from the captured
        # app_root either way, so both forms 308 to the same canonical URL.
        #
        # This strip is also what makes APPLICATION_ROOT == "/superset" safe,
        # the one deployment where the app-root and legacy prefixes are the
        # same token. A legacy bookmark there carries it twice
        # (`/superset/superset/dashboard/1/`) and 308s to
        # `/superset/dashboard/1/`; that target strips to `/dashboard/1/`,
        # which is not a legacy path, so it passes through on the next hop.
        # Because the strip runs *before* the legacy check, a canonical URL
        # can never re-enter the redirect branch — there is no self-loop.
        candidate = path_info
        if self.app_root_prefix and candidate.startswith(self.app_root_prefix + "/"):
            candidate = candidate[len(self.app_root_prefix) :]

        # Cheap exit: not a /superset path at all.
        if not (
            candidate == _LEGACY_PREFIX or candidate.startswith(_LEGACY_PREFIX + "/")
        ):
            return self.wsgi_app(environ, start_response)

        canonical_after_strip = candidate[len(_LEGACY_PREFIX) :] or "/"

        # Special case: /superset/sql/<database_id>/ has no 1:1 path mapping —
        # Database.sql_url migrated to the query-string shape /sqllab/?dbid=<id>.
        # Redirect it explicitly (numeric id only) so legacy SQL Lab deep links
        # survive one release cycle instead of hard-404ing.
        if sql_match := _LEGACY_SQL_RE.match(canonical_after_strip):
            if method_for_match != "GET":
                # The old /superset/sql/<id>/ route was GET-only; a 308 would
                # have the client retry-POST against /sqllab/ → 405. Emit 410.
                return _response_with_location(410, None)(environ, start_response)
            location = f"{self.app_root_prefix}/sqllab/?dbid={sql_match.group(1)}"
            if query_string := environ.get("QUERY_STRING", ""):
                # location already carries ?dbid=<id>; merge with & not ?.
                location = f"{location}&{query_string}"
            return _response_with_location(308, location)(environ, start_response)

        match = _match(canonical_after_strip)
        if match is None:
            # Unenumerated /superset path — closed-set discipline: pass
            # through to inner app (typically 404 from AppRootMiddleware /
            # Flask routing). The shim is a closed-set redirector, not an
            # open-prefix rewriter.
            return self.wsgi_app(environ, start_response)

        allowed_methods, canonical_target = match
        if method_for_match not in allowed_methods:
            # POST against GET-only canonical (308 would have the client
            # retry-POST against the canonical → 405). Emit 410 explicitly
            # so the operator-facing signal is unambiguous.
            return _response_with_location(410, None)(environ, start_response)

        # Location is intentionally built from captured app_root + canonical
        # path. Never from environ["SCRIPT_NAME"] (AppRootMiddleware wraps
        # inside this shim and sets SCRIPT_NAME at request time, but it is
        # unset at this outer layer) and never from X-Forwarded-*. See
        # module docstring for the proxy-strips-prefix operator caveat.
        location = self.app_root_prefix + canonical_target

        # Belt-and-braces: a 308 whose target is the inbound path would never
        # converge. No enumerated row can produce one (no canonical target
        # begins with the legacy prefix, so the rewrite always shortens the
        # path), but a future map edit could — pass through rather than emit a
        # redirect that loops. Compared before the query string is appended:
        # the query is carried over verbatim and cannot break a tie.
        if location == path_info:
            return self.wsgi_app(environ, start_response)

        if query_string := environ.get("QUERY_STRING", ""):
            location = f"{location}?{query_string}"

        return _response_with_location(308, location)(environ, start_response)


def _response_with_location(status: int, location: Optional[str]) -> Response:
    """Build an empty WSGI ``Response`` with the given status + optional
    ``Location`` header.

    ``Location`` is added only for 308 (308 requires it; 410 does not).
    The body is empty in both cases — clients follow 308 by re-requesting
    the new URL and surface 410 to the user as a hard break.
    """
    headers: list[tuple[str, str]] = []
    if location is not None:
        # quote() with safe="/?&=#%:" keeps already-encoded query bytes
        # intact while ensuring any raw control bytes that snuck in from
        # PATH_INFO are header-safe. Most realistic inputs round-trip
        # untouched (PATH_INFO is already %-encoded by the server).
        headers.append(("Location", quote(location, safe="/?&=#%:+,;@!$'()*-_.~")))
    return Response(status=status, headers=headers)
