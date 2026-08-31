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

"""Regression coverage: PWA manifest served dynamically.

Closes C5 in PR #39925 (subdirectory deployment): the static
`/static/assets/pwa-manifest.json` carried hard-coded `/superset/`
literals and could not adapt to non-`/superset` deployments. The new
`PwaManifestView` resolves `APPLICATION_ROOT` and `STATIC_ASSETS_PREFIX`
at request time. These tests pin field shapes under root, subdir, and
split static-prefix deployments; they also pin the closed field set and
the spa.html `<link>` contract.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from flask import Flask

from superset.utils import json
from superset.views.pwa_manifest import (
    _build_manifest,
    _normalize_app_root,
    PwaManifestView,
)

# ---------------------------------------------------------------------------
# Unit-level: _build_manifest under each deployment shape
# ---------------------------------------------------------------------------


def test_build_manifest_under_root_deployment() -> None:
    """`APPLICATION_ROOT=/` + empty static prefix → unprefixed canonical paths."""
    manifest = _build_manifest(application_root="/", static_assets_prefix="")
    assert manifest["start_url"] == "/welcome/"
    assert manifest["scope"] == "/"
    assert manifest["file_handlers"][0]["action"] == "/file-handler"
    assert manifest["icons"][0]["src"] == "/static/assets/images/pwa/icon-192.png"
    assert (
        manifest["screenshots"][0]["src"]
        == "/static/assets/images/pwa/screenshot-wide.png"
    )


def test_build_manifest_under_subdir_deployment() -> None:
    """`APPLICATION_ROOT=/superset` + inherited static prefix: fully prefixed."""
    manifest = _build_manifest(
        application_root="/superset", static_assets_prefix="/superset"
    )
    assert manifest["start_url"] == "/superset/welcome/"
    assert manifest["scope"] == "/superset/"
    assert manifest["file_handlers"][0]["action"] == "/superset/file-handler"
    assert (
        manifest["icons"][0]["src"] == "/superset/static/assets/images/pwa/icon-192.png"
    )
    assert (
        manifest["screenshots"][0]["src"]
        == "/superset/static/assets/images/pwa/screenshot-wide.png"
    )


def test_build_manifest_under_split_static_prefix() -> None:
    """`STATIC_ASSETS_PREFIX` as a CDN host; app-root paths use APPLICATION_ROOT."""
    manifest = _build_manifest(
        application_root="/superset",
        static_assets_prefix="https://cdn.example.com",
    )
    # App-root fields use APPLICATION_ROOT (the Superset backend host).
    assert manifest["start_url"] == "/superset/welcome/"
    assert manifest["scope"] == "/superset/"
    assert manifest["file_handlers"][0]["action"] == "/superset/file-handler"
    # Static-prefix fields use the CDN host.
    assert (
        manifest["icons"][0]["src"]
        == "https://cdn.example.com/static/assets/images/pwa/icon-192.png"
    )
    assert (
        manifest["screenshots"][0]["src"]
        == "https://cdn.example.com/static/assets/images/pwa/screenshot-wide.png"
    )


@pytest.mark.parametrize(
    "raw_root, expected",
    [
        ("/", ""),
        ("/superset", "/superset"),
        ("/superset/", "/superset"),
        ("", ""),
        ("/deep/nested/root", "/deep/nested/root"),
        ("/deep/nested/root/", "/deep/nested/root"),
    ],
)
def test_normalize_app_root_collapses_trailing_slash(
    raw_root: str, expected: str
) -> None:
    assert _normalize_app_root(raw_root) == expected


def test_build_manifest_handles_trailing_slash_application_root() -> None:
    """Trailing-slash `APPLICATION_ROOT` does not produce `//` joints."""
    manifest = _build_manifest(
        application_root="/superset/", static_assets_prefix="/superset/"
    )
    assert manifest["start_url"] == "/superset/welcome/"
    assert manifest["scope"] == "/superset/"
    assert "//" not in manifest["start_url"]
    assert "//" not in manifest["scope"]
    # Icons: only the protocol scheme should carry `//` (none here, relative URLs).
    assert "//" not in manifest["icons"][0]["src"]


def test_build_manifest_handles_empty_application_root() -> None:
    """Malformed empty `APPLICATION_ROOT` still produces a valid manifest."""
    manifest = _build_manifest(application_root="", static_assets_prefix="")
    assert manifest["start_url"] == "/welcome/"
    assert manifest["scope"] == "/"
    assert manifest["file_handlers"][0]["action"] == "/file-handler"


def test_build_manifest_no_superset_literal_under_root_deployment() -> None:
    """The literal-correction step actually fires under root deployment."""
    manifest = _build_manifest(application_root="/", static_assets_prefix="")
    serialized = json.dumps(manifest)
    assert "/superset/" not in serialized
    assert "/superset" not in serialized


def test_build_manifest_field_set_is_closed() -> None:
    """No phantom fields drift in (guards against the `shortcuts` phantom)."""
    manifest = _build_manifest(application_root="/", static_assets_prefix="")
    assert set(manifest.keys()) == {
        "name",
        "short_name",
        "description",
        "start_url",
        "scope",
        "display",
        "background_color",
        "theme_color",
        "icons",
        "screenshots",
        "file_handlers",
    }
    # Explicitly: NO `shortcuts` (PLAN line 1668-1669).
    assert "shortcuts" not in manifest


def test_build_manifest_icons_cross_product() -> None:
    """All four icon entries: (192,any), (512,any), (192,maskable), (512,maskable)."""
    manifest = _build_manifest(application_root="/", static_assets_prefix="")
    icons = manifest["icons"]
    assert len(icons) == 4
    pairs = {(icon["sizes"], icon["purpose"]) for icon in icons}
    assert pairs == {
        ("192x192", "any"),
        ("512x512", "any"),
        ("192x192", "maskable"),
        ("512x512", "maskable"),
    }


def test_build_manifest_screenshots_form_factors() -> None:
    """Both PWA form-factor screenshots present."""
    manifest = _build_manifest(application_root="/", static_assets_prefix="")
    form_factors = {s["form_factor"] for s in manifest["screenshots"]}
    assert form_factors == {"wide", "narrow"}


def test_build_manifest_file_handlers_accept_map() -> None:
    """Accept-MIME map matches the live JSON shape byte-for-byte (drift guard)."""
    manifest = _build_manifest(application_root="/", static_assets_prefix="")
    accept = manifest["file_handlers"][0]["accept"]
    assert accept == {
        "text/csv": [".csv"],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        "application/vnd.apache.parquet": [".parquet"],
    }


# ---------------------------------------------------------------------------
# Integration-level: HTTP response shape via a minimal Flask app
# ---------------------------------------------------------------------------


def _make_minimal_app(
    application_root: str = "/",
    static_assets_prefix: str = "",
) -> Flask:
    """Build the smallest Flask app that can serve PwaManifestView.

    Bypasses the full `SupersetAppInitializer` (which requires the docker
    test stack); registers only the manifest view's `manifest` method
    directly as a route. This keeps the test runnable in the worktree's
    docker-light environment (same blocker that pushed Slices 4 & 5
    to unit_tests/).
    """
    app = Flask(__name__)
    app.config["APPLICATION_ROOT"] = application_root
    app.config["STATIC_ASSETS_PREFIX"] = static_assets_prefix

    view = PwaManifestView()
    app.add_url_rule(
        "/pwa-manifest.json",
        endpoint="PwaManifestView.manifest",
        view_func=view.manifest,
        methods=["GET"],
    )
    return app


def test_manifest_route_returns_200_unauthenticated() -> None:
    """Anonymous GET succeeds (no @has_access)."""
    app = _make_minimal_app()
    client = app.test_client()
    response = client.get("/pwa-manifest.json")
    assert response.status_code == 200


def test_manifest_content_type_is_application_manifest_json() -> None:
    """Mimetype is the W3C-spec PWA manifest mimetype."""
    app = _make_minimal_app()
    client = app.test_client()
    response = client.get("/pwa-manifest.json")
    assert response.mimetype == "application/manifest+json"


def test_manifest_cache_control_revalidates() -> None:
    """Cache-Control allows revalidation but not stale serving."""
    app = _make_minimal_app()
    client = app.test_client()
    response = client.get("/pwa-manifest.json")
    assert response.headers["Cache-Control"] == "public, max-age=0, must-revalidate"


def test_manifest_body_is_valid_json() -> None:
    """Body parses as JSON and round-trips."""
    app = _make_minimal_app()
    client = app.test_client()
    response = client.get("/pwa-manifest.json")
    parsed = json.loads(response.data)
    assert isinstance(parsed, dict)
    assert parsed["name"] == "Apache Superset"


def test_manifest_route_under_subdir_config() -> None:
    """`APPLICATION_ROOT=/superset` propagates into the served body."""
    app = _make_minimal_app(
        application_root="/superset", static_assets_prefix="/superset"
    )
    client = app.test_client()
    response = client.get("/pwa-manifest.json")
    parsed = json.loads(response.data)
    assert parsed["start_url"] == "/superset/welcome/"
    assert parsed["scope"] == "/superset/"


def test_manifest_route_under_split_prefix_config() -> None:
    """CDN-hosted static-prefix only applies to icon/screenshot fields."""
    app = _make_minimal_app(
        application_root="/superset",
        static_assets_prefix="https://cdn.example.com",
    )
    client = app.test_client()
    response = client.get("/pwa-manifest.json")
    parsed = json.loads(response.data)
    assert parsed["start_url"] == "/superset/welcome/"
    assert parsed["scope"] == "/superset/"
    assert (
        parsed["icons"][0]["src"]
        == "https://cdn.example.com/static/assets/images/pwa/icon-192.png"
    )


def test_manifest_route_static_assets_prefix_fallback_to_application_root() -> None:
    """When `STATIC_ASSETS_PREFIX` is empty (root deployment default), icon
    paths use the (empty) `APPLICATION_ROOT` fallback — same shape as
    `superset/app.py:73-74` backfill logic."""
    app = _make_minimal_app(application_root="/", static_assets_prefix="")
    client = app.test_client()
    response = client.get("/pwa-manifest.json")
    parsed = json.loads(response.data)
    assert parsed["icons"][0]["src"] == "/static/assets/images/pwa/icon-192.png"


# ---------------------------------------------------------------------------
# Contract: spa.html link contract, static file deletion, view shape
# ---------------------------------------------------------------------------


def test_spa_html_link_uses_application_root_and_drops_v4_cache_bust() -> None:
    """spa.html `<link rel="manifest">` points to dynamic route under app root."""
    repo_root = Path(__file__).resolve().parents[3]
    spa_html = (repo_root / "superset/templates/superset/spa.html").read_text()
    # Pin: link references the dynamic route via application_root_rstrip.
    assert (
        '<link rel="manifest" '
        'href="{{ application_root_rstrip }}/pwa-manifest.json">' in spa_html
    )
    # Pin: `?v=4` cache-bust is gone (the dynamic route uses Cache-Control).
    assert "?v=4" not in spa_html
    # Pin: the link does NOT use `assets_prefix` (would point at CDN host).
    assert "assets_prefix" not in spa_html.split('rel="manifest"')[1].split(">")[0]


def test_static_pwa_manifest_file_is_deleted() -> None:
    """The legacy static manifest source file is removed (anti-regression
    against silently reintroducing the file with stale `/superset/` literals)."""
    repo_root = Path(__file__).resolve().parents[3]
    static_source = repo_root / "superset-frontend/src/pwa-manifest.json"
    assert not static_source.exists(), (
        "superset-frontend/src/pwa-manifest.json was reintroduced; the "
        "dynamic PwaManifestView is now the source of truth. Update "
        "PwaManifestView._build_manifest instead."
    )


def test_webpack_copy_rule_for_pwa_manifest_is_removed() -> None:
    """The webpack `CopyPlugin` entry that produced the served-from-dist
    pwa-manifest.json is gone (so even a forgotten src file would not be
    copied into the static-assets dist)."""
    repo_root = Path(__file__).resolve().parents[3]
    webpack_config = (repo_root / "superset-frontend/webpack.config.js").read_text()
    assert "src/pwa-manifest.json" not in webpack_config


def test_pwa_manifest_view_route_base_is_empty_string() -> None:
    """View is mounted under app root, not under a sub-prefix."""
    assert PwaManifestView.route_base == ""


def test_application_root_rstrip_template_global_is_registered() -> None:
    """The `application_root_rstrip` template global is added in
    superset/extensions/__init__.py so spa.html can render it."""
    repo_root = Path(__file__).resolve().parents[3]
    extensions_init = (repo_root / "superset/extensions/__init__.py").read_text()
    assert '"application_root_rstrip"' in extensions_init
