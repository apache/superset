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
"""Regression tests for the legacy `/superset/*` → 308 WSGI shim.

Five concern groups:

A. Path-rewriter behavior (synthetic inner WSGI app, no Flask routing).
B. Wrap-order pins through `create_app()` — the shim is the final wrap,
   regardless of what `init_app()` does inside.
C. Live-route shadow pins (shim does not intercept canonical routes).
D. `SqlaTable.sql_url` query-encoding regression.
E. Closed-set discipline — the redirect map is frozen as a snapshot.

These run as unit tests (no DB / login required) so they execute under the
same constraints as ``tests/unit_tests/test_subdirectory_url_for.py``. The
``app_context`` autouse fixture from ``tests/unit_tests/conftest.py``
applies; tests that need their own ``create_app()`` instance opt out via
``@pytest.mark.usefixtures()`` only as required.
"""

from __future__ import annotations

import os
from unittest.mock import patch
from urllib.parse import parse_qsl, urlsplit

import pytest
from werkzeug.test import Client
from werkzeug.wrappers import Response

from superset.app import create_app
from superset.middleware.legacy_prefix_redirect import (
    LEGACY_REDIRECT_MAP,
    LegacyPrefixRedirectMiddleware,
)

# ---------------------------------------------------------------------------
# Section A — synthetic inner app fixture
# ---------------------------------------------------------------------------


_SENTINEL_BODY = b"INNER_APP_REACHED"


def _sentinel_inner_app(environ, start_response):
    """Inner WSGI app that returns a sentinel body so tests can assert
    pass-through vs intercepted."""
    start_response("200 OK", [("Content-Type", "text/plain")])
    return [_SENTINEL_BODY]


def _build_client(app_root: str = "/") -> Client:
    shim = LegacyPrefixRedirectMiddleware(_sentinel_inner_app, app_root)
    return Client(shim, response_wrapper=Response)


# Each row: (legacy_path, expected_canonical, methods).
# Methods come from LEGACY_REDIRECT_MAP and are verified against the
# canonical endpoint's @expose decorator at HEAD.
_GET_REDIRECT_ROWS: list[tuple[str, str]] = [
    ("/superset/welcome/", "/welcome/"),
    ("/superset/dashboard/42/", "/dashboard/42/"),
    ("/superset/dashboard/p/abc123/", "/dashboard/p/abc123/"),
    ("/superset/slice/7/", "/slice/7/"),
    ("/superset/warm_up_cache/", "/warm_up_cache/"),
    ("/superset/fetch_datasource_metadata", "/fetch_datasource_metadata"),
    ("/superset/language_pack/en/", "/language_pack/en/"),
    ("/superset/file-handler", "/file-handler"),
    ("/superset/sqllab/history/", "/sqllab/history/"),
    ("/superset/explore/", "/explore/"),
    ("/superset/explore/table/5/", "/explore/table/5/"),
    ("/superset/explore/p/key123/", "/explore/p/key123/"),
    ("/superset/explore_json/", "/explore_json/"),
    ("/superset/explore_json/table/5/", "/explore_json/table/5/"),
    ("/superset/explore_json/data/cache_abc/", "/explore_json/data/cache_abc/"),
    ("/superset/tags/", "/tags/"),
    ("/superset/all_entities/", "/all_entities/"),
]

# POST → 308 (body-preserving) rows: canonical accepts POST.
_POST_BODY_PRESERVED_ROWS: list[tuple[str, str]] = [
    ("/superset/explore/", "/explore/"),
    ("/superset/explore/table/5/", "/explore/table/5/"),
    ("/superset/explore_json/", "/explore_json/"),
    ("/superset/explore_json/table/5/", "/explore_json/table/5/"),
    ("/superset/log/", "/log/"),
]

# POST → 410 rows: canonical is GET-only.
_POST_410_ROWS: list[str] = [
    "/superset/welcome/",
    "/superset/dashboard/42/",
    "/superset/dashboard/p/abc123/",
    "/superset/slice/7/",
    "/superset/warm_up_cache/",
    "/superset/fetch_datasource_metadata",
    "/superset/language_pack/en/",
    "/superset/file-handler",
    "/superset/sqllab/history/",
    "/superset/explore/p/key123/",
    "/superset/explore_json/data/cache_abc/",
    "/superset/tags/",
    "/superset/all_entities/",
]


# ---------------------------------------------------------------------------
# Section A — Path-rewriter behavior
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(("legacy", "canonical"), _GET_REDIRECT_ROWS)
def test_legacy_get_redirects_308_under_root(legacy: str, canonical: str) -> None:
    """Under root deployment, every enumerated legacy GET 308s to the
    bare canonical path (no `/superset` prefix)."""
    client = _build_client(app_root="/")
    resp = client.get(legacy)
    assert resp.status_code == 308
    assert resp.headers["Location"] == canonical


@pytest.mark.parametrize(("legacy", "canonical"), _GET_REDIRECT_ROWS)
def test_legacy_get_redirects_308_under_subdir(legacy: str, canonical: str) -> None:
    """Under subdir deployment (e.g. `SUPERSET_APP_ROOT=/myapp`), every
    enumerated legacy GET 308s to a single-prefixed canonical path.

    Critical: `Location` must be `/myapp<canonical>`, never
    `/myapp/superset<canonical>`. The shim wraps outside
    `AppRootMiddleware`, so it sees the raw inbound `PATH_INFO`; the
    `Location` is built from the construction-time `app_root` capture,
    not from `environ["SCRIPT_NAME"]`.

    The `/superset` app root, where this prefix and `_LEGACY_PREFIX` are the
    same token, is covered separately in Section A.1."""
    client = _build_client(app_root="/myapp")
    resp = client.get(legacy)
    assert resp.status_code == 308
    assert resp.headers["Location"] == f"/myapp{canonical}"


@pytest.mark.parametrize(("legacy", "canonical"), _GET_REDIRECT_ROWS)
def test_app_root_prefixed_legacy_get_redirects_308_under_subdir(
    legacy: str, canonical: str
) -> None:
    """Under subdir deployment, legacy bookmarks saved from a pre-upgrade
    deployment under the same subdirectory carry the app root too:
    `/myapp/superset/<canonical>`. The shim strips the captured app root
    before the legacy-prefix check, so both the bare and the app-root-
    prefixed legacy forms 308 to the same `/myapp<canonical>` target."""
    client = _build_client(app_root="/myapp")
    resp = client.get(f"/myapp{legacy}")
    assert resp.status_code == 308
    assert resp.headers["Location"] == f"/myapp{canonical}"


def test_app_root_prefixed_legacy_preserves_query_string() -> None:
    """Query strings survive the app-root-prefixed legacy redirect."""
    client = _build_client(app_root="/myapp")
    resp = client.get("/myapp/superset/explore/?form_data_key=abc")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/myapp/explore/?form_data_key=abc"


def test_app_root_strip_respects_segment_boundary() -> None:
    """A path that merely shares a string prefix with the app root (e.g.
    `/myapparoo/...` under `app_root=/myapp`) is NOT treated as app-root-
    prefixed — the strip only fires on `{app_root}/`."""
    client = _build_client(app_root="/myapp")
    resp = client.get("/myapparoo/superset/welcome/")
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


def test_app_root_prefixed_unenumerated_path_passes_through() -> None:
    """Closed-set discipline holds for the app-root-prefixed form too."""
    client = _build_client(app_root="/myapp")
    resp = client.get("/myapp/superset/not-a-real-route/")
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


@pytest.mark.parametrize(("legacy", "canonical"), _POST_BODY_PRESERVED_ROWS)
def test_legacy_post_body_preserved_308(legacy: str, canonical: str) -> None:
    """POST against a POST-capable canonical → 308 (308 is body-
    preserving per RFC 7538; 410 would lose the body)."""
    client = _build_client(app_root="/")
    resp = client.post(legacy, data={"k": "v"})
    assert resp.status_code == 308
    assert resp.headers["Location"] == canonical


@pytest.mark.parametrize("legacy", _POST_410_ROWS)
def test_legacy_post_against_get_only_canonical_410(legacy: str) -> None:
    """POST against a GET-only canonical → 410 Gone.

    A 308 here would re-POST against the canonical and 405 — explicit
    410 surfaces the operator-facing signal cleanly."""
    client = _build_client(app_root="/")
    resp = client.post(legacy, data={"k": "v"})
    assert resp.status_code == 410
    assert "Location" not in resp.headers


@pytest.mark.parametrize(("legacy", "canonical"), _POST_BODY_PRESERVED_ROWS)
def test_app_root_prefixed_legacy_post_body_preserved_308(
    legacy: str, canonical: str
) -> None:
    """Method disposition is shared after the app-root strip: the app-root-
    prefixed POST form follows the same 308 (body-preserving) branch as the
    bare form, with the prefixed Location."""
    client = _build_client(app_root="/myapp")
    resp = client.post(f"/myapp{legacy}", data={"k": "v"})
    assert resp.status_code == 308
    assert resp.headers["Location"] == f"/myapp{canonical}"


@pytest.mark.parametrize("legacy", _POST_410_ROWS)
def test_app_root_prefixed_legacy_post_against_get_only_canonical_410(
    legacy: str,
) -> None:
    """POST against a GET-only canonical → 410 Gone for the app-root-
    prefixed form too (the most consequential branch of the shim — a 308
    here would re-POST and 405)."""
    client = _build_client(app_root="/myapp")
    resp = client.post(f"/myapp{legacy}", data={"k": "v"})
    assert resp.status_code == 410
    assert "Location" not in resp.headers


# ---------------------------------------------------------------------------
# Section A.0 — HEAD is folded to GET.
#
# HEAD is "GET without a response body" (RFC 9110 §9.3.2): a resource that
# serves GET must serve HEAD, and Werkzeug registers HEAD implicitly on every
# GET rule. `LEGACY_REDIRECT_MAP` therefore lists only the *explicit* methods
# from each canonical `@expose` decorator and never spells HEAD — so the shim
# has to fold HEAD→GET before the method check. Without the fold, every legacy
# HEAD probe falls into the `method not in allowed_methods` branch and gets a
# spurious 410 Gone, which is what link-checkers, uptime monitors and
# `curl -I` all send.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(("legacy", "canonical"), _GET_REDIRECT_ROWS)
def test_legacy_head_redirects_308_like_get(legacy: str, canonical: str) -> None:
    """HEAD against a GET-capable canonical → the same 308 a GET gets."""
    client = _build_client(app_root="/")
    resp = client.head(legacy)
    assert resp.status_code == 308
    assert resp.headers["Location"] == canonical


@pytest.mark.parametrize(("legacy", "canonical"), _GET_REDIRECT_ROWS)
def test_app_root_prefixed_legacy_head_redirects_308_like_get(
    legacy: str, canonical: str
) -> None:
    """The HEAD fold applies to the app-root-prefixed form too."""
    client = _build_client(app_root="/myapp")
    resp = client.head(f"/myapp{legacy}")
    assert resp.status_code == 308
    assert resp.headers["Location"] == f"/myapp{canonical}"


def test_legacy_head_against_post_only_canonical_410() -> None:
    """`/log/` is the one POST-only row. HEAD folds to GET, which the
    canonical does not serve, so 410 is correct here — the fold must not
    blanket-allow HEAD, only make it track GET."""
    client = _build_client(app_root="/")
    resp = client.head("/superset/log/")
    assert resp.status_code == 410
    assert "Location" not in resp.headers


def test_legacy_sql_deep_link_head_redirects_308() -> None:
    """The SQL Lab deep-link branch has its own method check
    (`!= "GET"`); HEAD must fold there as well, not 410."""
    client = _build_client(app_root="/")
    resp = client.head("/superset/sql/5/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/sqllab/?dbid=5"


def test_unenumerated_superset_path_passes_through() -> None:
    """A `/superset/<not-in-table>` path passes through to the inner app
    (closed-set discipline — the shim is not an open-prefix rewriter)."""
    client = _build_client(app_root="/")
    resp = client.get("/superset/not-a-real-route/")
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


def test_non_superset_path_passes_through() -> None:
    """A path that does not start with `/superset` is never touched."""
    client = _build_client(app_root="/")
    resp = client.get("/api/v1/chart/")
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


@pytest.mark.parametrize("bare", ["/superset", "/superset/"])
def test_bare_legacy_prefix_passes_through(bare: str) -> None:
    """The bare legacy prefix itself (`/superset` and `/superset/`, with no
    canonical tail) is not an enumerated row. It exercises the
    `candidate == _LEGACY_PREFIX` disjunct and the `or "/"` fallback on the
    empty strip result — `_match("/")` returns None, so the request passes
    through to the inner app rather than 308-ing to `/`."""
    client = _build_client(app_root="/")
    resp = client.get(bare)
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


def test_canonical_path_without_legacy_prefix_passes_through() -> None:
    """The shim only matches paths under `/superset` — a pure canonical
    request (e.g. `/explore/`) is never intercepted, even though
    `/explore/` is one of the rows in `LEGACY_REDIRECT_MAP`. Pins the
    closed-set discipline: the legacy prefix is part of the key, not a
    suffix-substring match."""
    client = _build_client(app_root="/")
    for canonical in ("/explore/", "/welcome/", "/dashboard/5/", "/log/"):
        resp = client.get(canonical)
        assert resp.status_code == 200, canonical
        assert resp.data == _SENTINEL_BODY, canonical


def test_legacy_sql_deep_link_redirects_to_sqllab_dbid() -> None:
    """`/superset/sql/<id>/` has **no** 1:1 path row — `Database.sql_url`
    reshaped to `/sqllab/?dbid=<id>`. The shim special-cases the numeric
    deep link (via `_LEGACY_SQL_RE`) and 308s to the migrated query-string
    shape so legacy SQL Lab bookmarks survive one release cycle instead of
    hard-404ing."""
    client = _build_client(app_root="/")
    resp = client.get("/superset/sql/5/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/sqllab/?dbid=5"
    # Handled by the special case, NOT the closed-set map.
    assert "/sql/" not in LEGACY_REDIRECT_MAP


def test_legacy_sql_deep_link_without_trailing_slash() -> None:
    """The historical route was `@expose("/sql/<int:database_id>/")`; the
    trailing slash is optional on the inbound bookmark. Both forms 308 to the
    same target."""
    client = _build_client(app_root="/")
    resp = client.get("/superset/sql/5")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/sqllab/?dbid=5"


def test_legacy_sql_deep_link_under_subdir() -> None:
    """Under a subdir deployment the dbid target carries the single app-root
    prefix — `/myapp/sqllab/?dbid=<id>`, never `/myapp/superset/...`."""
    client = _build_client(app_root="/myapp")
    resp = client.get("/myapp/superset/sql/12/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/myapp/sqllab/?dbid=12"


def test_legacy_sql_deep_link_merges_query_string_with_ampersand() -> None:
    """An inbound query string is merged onto the already-present `?dbid=<id>`
    with `&` — never a second `?`. Guards against re-introducing the
    `SqlaTable.sql_url` double-`?` bug shape (`/sqllab/?dbid=5?table_name=…`)."""
    client = _build_client(app_root="/")
    resp = client.get("/superset/sql/5/?table_name=foo&schema=bar")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/sqllab/?dbid=5&table_name=foo&schema=bar"
    # Exactly one `?` in the Location.
    assert resp.headers["Location"].count("?") == 1


def test_legacy_sql_post_returns_410() -> None:
    """The old `/superset/sql/<id>/` route was GET-only; a POST 308 would
    re-POST against `/sqllab/` (a GET view) → 405. Emit 410 instead, matching
    the disposition of every other GET-only canonical."""
    client = _build_client(app_root="/")
    resp = client.post("/superset/sql/5/", data={"k": "v"})
    assert resp.status_code == 410
    assert "Location" not in resp.headers


@pytest.mark.parametrize(
    "path",
    [
        "/superset/sql/",  # no id
        "/superset/sql/abc/",  # non-numeric id
        "/superset/sql/5/extra/",  # trailing extra segment
    ],
)
def test_legacy_sql_non_numeric_passes_through(path: str) -> None:
    """Closed-set discipline: only a bare numeric `<database_id>` is
    special-cased. Anything else is not a real legacy SQL Lab deep link and
    falls through to the inner app (→ 404 in production) rather than being
    coerced into a `?dbid=<garbage>` redirect."""
    client = _build_client(app_root="/")
    resp = client.get(path)
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


@pytest.mark.parametrize(("legacy", "canonical"), _GET_REDIRECT_ROWS)
def test_app_root_superset_redirects_doubled_legacy_path(
    legacy: str, canonical: str
) -> None:
    """`APPLICATION_ROOT == "/superset"` is the one deployment where the
    app-root prefix and the legacy prefix are the same token, so a legacy
    bookmark carries it twice: `/superset/superset/welcome/`.

    The app-root strip runs first, leaving `/superset/welcome/` — a genuine
    legacy path — so the doubled form 308s to the single-prefixed canonical.
    Previously the shim disabled itself wholesale in this deployment shape
    and these URLs hard-404'd."""
    client = _build_client(app_root="/superset")
    resp = client.get(f"/superset{legacy}")
    assert resp.status_code == 308
    assert resp.headers["Location"] == f"/superset{canonical}"


@pytest.mark.parametrize(("legacy", "canonical"), _GET_REDIRECT_ROWS)
def test_app_root_superset_canonical_path_passes_through(
    legacy: str, canonical: str
) -> None:
    """The redirect target from the test above must itself pass through
    rather than redirect again — this is what makes the doubled-path 308
    converge instead of looping.

    Inbound `/superset/welcome/` strips its app root to `/welcome/`, which
    is not a legacy path, so it falls through to the inner app. A canonical
    URL cannot re-enter the redirect branch, because the app-root strip
    happens *before* the legacy-prefix check."""
    client = _build_client(app_root="/superset")
    resp = client.get(f"/superset{canonical}")
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


def test_app_root_superset_doubled_sql_deep_link_redirects() -> None:
    """The SQL Lab deep-link branch also survives the `/superset` app root."""
    client = _build_client(app_root="/superset")
    resp = client.get("/superset/superset/sql/5/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/superset/sqllab/?dbid=5"


def test_bare_app_root_superset_passes_through() -> None:
    """Inbound `/superset` (bare, no trailing slash) under the `/superset`
    app root does not hit the segment-boundary strip, so it reaches the
    legacy check as the bare prefix. It maps to no row and passes through
    — it must not be mistaken for a legacy path with an empty tail."""
    client = _build_client(app_root="/superset")
    resp = client.get("/superset")
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


@pytest.mark.parametrize(
    "app_root",
    ["/", "", "/superset", "/superset/", "/other", "/a/b"],
)
def test_shim_active_for_every_app_root(app_root: str) -> None:
    """The shim performs its rewrite under every `APPLICATION_ROOT`,
    including `/superset` itself. No deployment shape disables it."""
    client = _build_client(app_root=app_root)
    prefix = app_root.rstrip("/")
    resp = client.get(f"{prefix}/superset/welcome/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == f"{prefix}/welcome/"


# ---------------------------------------------------------------------------
# Section A.1 — APPLICATION_ROOT casing and trailing-slash shapes.
# `_LEGACY_PREFIX` is the lowercase literal `/superset` and the inbound-path
# check is byte-comparison, so the shim recognises exactly the legacy URL
# token Superset used to emit — no casefold(). These tests pin that the
# app-root value's own shape (casing, trailing slashes) only affects the
# prefix that gets stripped and re-attached, never whether the shim runs.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "app_root",
    ["/Superset", "/SUPERSET", "/SuperSet"],
)
def test_mixed_case_app_root_is_not_the_legacy_prefix(app_root: str) -> None:
    """A mixed-case APPLICATION_ROOT is an ordinary subdirectory as far as
    the shim is concerned — it is not the lowercase `/superset` legacy
    token, so a legacy bookmark under it carries both prefixes and 308s to
    the operator's casing."""
    client = _build_client(app_root=app_root)
    resp = client.get(f"{app_root}/superset/welcome/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == f"{app_root}/welcome/"


@pytest.mark.parametrize(
    "app_root",
    ["/superset/", "/superset//", "/superset///"],
)
def test_trailing_slash_app_root_variants_normalise(app_root: str) -> None:
    """Trailing-slash variants all collapse to `/superset` via `rstrip("/")`,
    so they behave identically to the bare `/superset` app root: the doubled
    legacy path 308s to the single-prefixed canonical.

    Pinning the multi-slash branch protects against a future maintainer
    swapping `rstrip("/")` for `removesuffix("/")`, which strips only one and
    would leave a stray slash in every `Location`.
    """
    shim = LegacyPrefixRedirectMiddleware(_sentinel_inner_app, app_root)
    assert shim.app_root_prefix == "/superset"
    client = Client(shim, response_wrapper=Response)
    resp = client.get("/superset/superset/welcome/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/superset/welcome/"


@pytest.mark.parametrize(
    "inbound_path",
    [
        "/Superset/welcome/",
        "/SUPERSET/welcome/",
        "/SuperSet/welcome/",
    ],
)
def test_inbound_path_case_sensitivity_passes_through(inbound_path: str) -> None:
    """Mixed-case inbound paths are NOT matched as legacy paths — the shim
    only intercepts the lowercase `/superset/...` literal. Anything else
    falls through to the inner app unchanged.

    Counter-example: if `path_info.startswith(_LEGACY_PREFIX + "/")` were
    swapped for a case-insensitive comparison, `/Superset/welcome/` under
    root deployment would 308 to `/welcome/` — semantically reasonable but
    a deliberate behaviour change that should land with an explicit pin
    update here.
    """
    client = _build_client(app_root="/")
    resp = client.get(inbound_path)
    assert resp.status_code == 200
    assert resp.data == _SENTINEL_BODY


def test_lowercase_inbound_path_still_308s_under_mixed_case_app_root() -> None:
    """When the operator deploys `APPLICATION_ROOT=/Superset` and a client
    hits the legacy lowercase `/superset/welcome/`, the shim:
      1. Matches the inbound path (case-sensitive against `_LEGACY_PREFIX`).
      2. Builds the Location from the captured `app_root_prefix` — so the
         redirect lands the client at the operator's casing.

    This is the failure mode that finding raised — but it does NOT produce a
    self-loop, because `/Superset/welcome/` != `/superset/welcome/` at the
    string level, so the inbound path of the redirected request will not
    re-match the legacy prefix. Pin the documented shape: 308 to the
    mixed-case canonical, no loop.
    """
    client = _build_client(app_root="/Superset")
    resp = client.get("/superset/welcome/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/Superset/welcome/"


def test_location_built_from_app_root_not_script_name() -> None:
    """The shim ignores `environ["SCRIPT_NAME"]` — `Location` is built
    from the construction-time `app_root` capture only.

    Simulates a misbehaving proxy that injects `SCRIPT_NAME`."""
    shim = LegacyPrefixRedirectMiddleware(_sentinel_inner_app, "/")
    client = Client(shim, response_wrapper=Response)
    resp = client.get(
        "/superset/welcome/",
        environ_overrides={"SCRIPT_NAME": "/proxy-injected"},
    )
    assert resp.status_code == 308
    assert "/proxy-injected" not in resp.headers["Location"]
    assert resp.headers["Location"] == "/welcome/"


def test_location_built_from_app_root_not_forwarded_host() -> None:
    """The shim ignores `X-Forwarded-*` headers entirely — `Location` is
    relative + built from captured `app_root`."""
    shim = LegacyPrefixRedirectMiddleware(_sentinel_inner_app, "/")
    client = Client(shim, response_wrapper=Response)
    resp = client.get(
        "/superset/welcome/",
        headers={
            "X-Forwarded-Host": "evil.example.com",
            "X-Forwarded-Prefix": "/evil-prefix",
            "X-Forwarded-Proto": "https",
        },
    )
    assert resp.status_code == 308
    location = resp.headers["Location"]
    assert "evil.example.com" not in location
    assert "/evil-prefix" not in location
    assert location == "/welcome/"


def test_query_string_preserved_in_location() -> None:
    """The `?...` part of the URL is forwarded onto `Location` as-is."""
    client = _build_client(app_root="/")
    resp = client.get("/superset/dashboard/5/?standalone=1&filter_id=2")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/dashboard/5/?standalone=1&filter_id=2"


def test_query_string_preserved_under_subdir() -> None:
    """Subdir + query string: single prefix, query intact."""
    client = _build_client(app_root="/myapp")
    resp = client.get("/superset/explore/?form_data=%7B%7D")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/myapp/explore/?form_data=%7B%7D"


# ---------------------------------------------------------------------------
# Section E — Closed-set discipline
# ---------------------------------------------------------------------------


# Snapshot — frozenset so the comparison is order-independent. Any new
# legacy row MUST be added here in the same commit that adds it to the
# module-level map.
_EXPECTED_KEYSET: frozenset[str] = frozenset(
    {
        "/welcome/",
        "/dashboard/",
        "/dashboard/p/",
        "/slice/",
        "/warm_up_cache/",
        "/fetch_datasource_metadata",
        "/language_pack/",
        "/file-handler",
        "/log/",
        "/sqllab/history/",
        "/explore_json/",
        "/explore_json/data/",
        "/explore/",
        "/explore/p/",
        "/tags/",
        "/all_entities/",
    }
)


def test_legacy_redirect_map_closed_set() -> None:
    """`LEGACY_REDIRECT_MAP.keys()` is a closed set — any row added or
    removed must update the snapshot in the same commit."""
    assert frozenset(LEGACY_REDIRECT_MAP.keys()) == _EXPECTED_KEYSET


# ---------------------------------------------------------------------------
# Section B — Wrap-order pins through create_app()
# ---------------------------------------------------------------------------


def _clean_env() -> dict[str, str]:
    env = os.environ.copy()
    env.pop("SUPERSET_APP_ROOT", None)
    env.pop("SUPERSET_CONFIG", None)
    return env


@patch("superset.initialization.SupersetAppInitializer.init_app")
def test_wrap_order_shim_is_outermost_under_root(mock_init_app) -> None:
    """After `create_app()` returns with `app_root == "/"`, the
    outermost `wsgi_app` layer is `LegacyPrefixRedirectMiddleware`.

    Unconditional — the shim wraps even under root deployments because
    legacy bookmarks exist regardless of `APPLICATION_ROOT`."""
    with patch.dict(os.environ, _clean_env(), clear=True):
        app = create_app()
    assert isinstance(app.wsgi_app, LegacyPrefixRedirectMiddleware)


@patch("superset.initialization.SupersetAppInitializer.init_app")
def test_wrap_order_shim_is_outermost_under_subdir(mock_init_app) -> None:
    """Under subdir deployment, the shim is still the outermost layer
    and captures `app_root = "/superset"`."""
    env = _clean_env()
    env["SUPERSET_APP_ROOT"] = "/superset"
    with patch.dict(os.environ, env, clear=True):
        app = create_app()
    assert isinstance(app.wsgi_app, LegacyPrefixRedirectMiddleware)
    assert app.wsgi_app.app_root_prefix == "/superset"


@patch("superset.initialization.SupersetAppInitializer.init_app")
def test_wrap_order_shim_outside_init_app_wraps(mock_init_app) -> None:
    """Even if `init_app()` itself re-wraps `app.wsgi_app` (which
    `configure_middlewares()` does with ProxyFix / ChunkedEncodingFix /
    ADDITIONAL_MIDDLEWARE), the shim must end up **outside** that wrap.

    Simulate via a fake middleware that `init_app()` installs."""

    class _FakeInnerMiddleware:
        def __init__(self, wsgi_app):
            self.wsgi_app = wsgi_app

        def __call__(self, environ, start_response):
            return self.wsgi_app(environ, start_response)

    def fake_init_app(self) -> None:  # noqa: ARG001
        # Mirror the configure_middlewares() shape: re-wrap app.wsgi_app
        # so the new fake middleware is the current outermost.
        self.superset_app.wsgi_app = _FakeInnerMiddleware(self.superset_app.wsgi_app)

    with (
        patch.dict(os.environ, _clean_env(), clear=True),
        patch(
            "superset.initialization.SupersetAppInitializer.init_app",
            new=fake_init_app,
        ),
    ):
        app = create_app()
    # Shim is still outermost; FakeInnerMiddleware sits somewhere inside.
    # `create_app()` also wraps ExtensionCacheMiddleware between the shim
    # and the inner middleware, so walk the `wsgi_app` chain to find the
    # fake — the layering invariant is "shim outside init_app's wraps,"
    # not "shim's direct inner is init_app's outermost wrap."
    assert isinstance(app.wsgi_app, LegacyPrefixRedirectMiddleware)
    inner: object = app.wsgi_app.wsgi_app
    while hasattr(inner, "wsgi_app") and not isinstance(inner, _FakeInnerMiddleware):
        inner = inner.wsgi_app
    assert isinstance(inner, _FakeInnerMiddleware)


# ---------------------------------------------------------------------------
# Section C — Live-route shadow pins
# ---------------------------------------------------------------------------


def test_shim_does_not_shadow_explore_root(app_context: None) -> None:
    """`GET /explore/` (no legacy prefix) still routes to
    `ExploreView.root` — the shim does not over-match on `/explore/`.

    The registration-order pin survives the outer-wrap change."""
    from flask import current_app

    adapter = current_app.url_map.bind("")
    endpoint, _ = adapter.match("/explore/", method="GET")
    assert endpoint == "ExploreView.root"


def test_shim_does_not_shadow_redirect_view(app_context: None) -> None:
    """`/redirect/?url=...` is not in `LEGACY_REDIRECT_MAP` and is not
    under `/superset/*` — the shim passes through and `RedirectView`
    handles it."""
    from flask import current_app

    adapter = current_app.url_map.bind("")
    endpoint, _ = adapter.match("/redirect/", method="GET")
    # Registered RedirectView endpoint shape: `RedirectView.redirect_warning`.
    assert endpoint == "RedirectView.redirect_warning"


# ---------------------------------------------------------------------------
# Section D — SqlaTable.sql_url query-encoding regression
# ---------------------------------------------------------------------------


def _make_sqla_table(table_name: str, database_id: int = 5):
    """Build a `SqlaTable` instance + `Database` instance without touching
    the ORM session — both models tolerate construction without a bind."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    return SqlaTable(
        table_name=table_name,
        database=Database(database_name="test_db", id=database_id),
    )


def test_sqla_table_sql_url_single_dbid_decoded_table_name() -> None:
    """`SqlaTable.sql_url` parses as a well-formed URL with a single
    `dbid` value and a decoded `table_name`. The HEAD bug emitted a
    second literal `?` (`/sqllab/?dbid=5?table_name=my_table`); the fix
    appends `table_name` as a real query param."""
    table = _make_sqla_table("my_table", database_id=5)
    parts = urlsplit(table.sql_url)
    assert parts.path == "/sqllab/"
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    assert query == {"dbid": "5", "table_name": "my_table"}


def test_sqla_table_sql_url_slash_in_name_encoded() -> None:
    """Table names containing `/` percent-encode to `%2F` so the query
    parser does not interpret the slash. Pins `quote(safe="")` (default
    `safe="/"` would corrupt this case)."""
    table = _make_sqla_table("schema/with_slash", database_id=5)
    parts = urlsplit(table.sql_url)
    # Raw query bytes contain %2F, not a literal `/`.
    assert "%2F" in parts.query
    # parse_qsl decodes back to the original.
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    assert query["table_name"] == "schema/with_slash"


def test_sqla_table_sql_url_special_chars_encoded() -> None:
    """Table names with `&`, `=`, ` `, and `#` round-trip cleanly through
    `parse_qsl` — pins safe encoding of the full set of query-meaningful
    characters."""
    raw = "a&b=c d#e"
    table = _make_sqla_table(raw, database_id=5)
    parts = urlsplit(table.sql_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    assert query["table_name"] == raw
    # Sanity: `dbid` still parses as a single key.
    assert query["dbid"] == "5"


# ---------------------------------------------------------------------------
# Section A (continued) — short-circuit + no-double-redirect pins
# ---------------------------------------------------------------------------


def test_shim_short_circuits_before_inner_app() -> None:
    """For an enumerated legacy path, the inner app is **never** invoked
    — the shim 308s first. Pin via a sentinel inner app that would emit
    a unique body if reached."""

    def _raise_on_reach(environ, start_response):  # pragma: no cover
        raise AssertionError("shim must 308 before inner app sees the legacy path")

    # Use a non-colliding subdir — `/superset` would trigger the
    # short-circuit and fall through to inner (covered elsewhere).
    shim = LegacyPrefixRedirectMiddleware(_raise_on_reach, "/myapp")
    client = Client(shim, response_wrapper=Response)
    resp = client.get("/superset/welcome/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/myapp/welcome/"


def test_no_double_redirect_warm_up_cache() -> None:
    """Legacy `/superset/warm_up_cache/` → exactly one 308 from the shim.

    The canonical `Superset.warm_up_cache` has its own
    `@deprecated(new_target="api/v1/chart/warm_up_cache/")` that emits a
    further redirect at request time — that is a separate hop. The shim
    must not concatenate or skip steps."""
    client = _build_client(app_root="/")
    resp = client.get("/superset/warm_up_cache/")
    assert resp.status_code == 308
    assert resp.headers["Location"] == "/warm_up_cache/"
    # Pass-through inner did not run.
    assert resp.data == b""
