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

"""Pin the spa.html service-worker registration path under subdir deployments.

The
service-worker `<script>` block in `superset/templates/superset/spa.html`
emits the registration URL via `'{{ assets_prefix }}/static/service-worker.js'`.
Under `APPLICATION_ROOT=/superset` the `app.py:73-74` backfill sets
`STATIC_ASSETS_PREFIX=/superset`, so the rendered URL must be
`/superset/static/service-worker.js` exactly once — and the SW *scope* the
browser derives from that URL determines whether the SW intercepts the
deployed app at all.

The PWA manifest pin (test_pwa_manifest.py) only covers the `<link
rel="manifest">` row. The SW registration sits two blocks down and uses a
different template variable (`assets_prefix` vs `application_root_rstrip`);
both need their own contract pin so a regression in one doesn't ride along
silently in the other.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from jinja2 import Environment

REPO_ROOT = Path(__file__).resolve().parents[3]
SPA_HTML = REPO_ROOT / "superset/templates/superset/spa.html"

# The snippet we pin. Extracted via regex from spa.html so the pin tracks the
# template's evolution without re-pasting it here.
SW_REGISTER_LINE_RE = re.compile(r"navigator\.serviceWorker\s*\.register\(\s*'([^']+)'")


def _extract_sw_register_template() -> str:
    """Return the raw Jinja expression inside the SW `.register(...)` call.

    The expression is what gets substituted at render time. Extracting it
    keeps the behavioural assertions below decoupled from surrounding
    whitespace / minor template churn — a future maintainer can move the
    block around without breaking the test, but cannot change the substituted
    expression itself without surfacing here.
    """
    source = SPA_HTML.read_text()
    match = SW_REGISTER_LINE_RE.search(source)
    assert match is not None, (
        "spa.html no longer contains a `navigator.serviceWorker.register(...)` "
        "call. If the SW was intentionally removed, delete this test module."
    )
    return match.group(1)


# ---------------------------------------------------------------------------
# Source-pin: the template expression is the documented shape.
# ---------------------------------------------------------------------------


def test_spa_html_service_worker_registration_uses_assets_prefix() -> None:
    """The SW register URL is `{{ assets_prefix }}/static/service-worker.js`.

    `assets_prefix` comes from the `get_manifest` template context processor
    (superset/extensions/__init__.py:110), which sources
    `STATIC_ASSETS_PREFIX`. Under app_root="/superset", `app.py:73-74`
    backfills STATIC_ASSETS_PREFIX to "/superset" — so the rendered URL is
    single-prefixed for free.

    Counter-example: if a refactor swapped `assets_prefix` for a hard-coded
    `/static/...` or for `application_root_rstrip`, the test fires. Both
    failure modes are real regressions — hard-coded path breaks subdir
    deployments; `application_root_rstrip` breaks CDN-backed static hosting.
    """
    expression = _extract_sw_register_template()
    assert expression == "{{ assets_prefix }}/static/service-worker.js"


def test_spa_html_service_worker_block_uses_correct_navigator_api() -> None:
    """The full `if ('serviceWorker' in navigator)` guard is present.

    Regression net for an accidental removal of the feature-detection
    branch — without the guard the registration call throws in any browser
    where `navigator.serviceWorker` is undefined (HTTP-only contexts, older
    Safari versions, etc.).
    """
    source = SPA_HTML.read_text()
    assert "'serviceWorker' in navigator" in source
    assert "navigator.serviceWorker" in source
    assert "window.addEventListener('load'" in source


# ---------------------------------------------------------------------------
# Behaviour: Jinja-render the expression under each deployment shape.
# ---------------------------------------------------------------------------

# The expression is dependency-free (`assets_prefix` is the only var). We
# render it with a bare Jinja Environment to avoid spinning up the full
# Flask + appbuilder template stack the docker-light worktree can't host.
# autoescape is irrelevant: the rendered output is a URL fragment the test
# asserts against directly — it is never injected into HTML. Turning
# autoescape ON would corrupt the assertions when `assets_prefix` contains
# characters Jinja would HTML-escape (ampersands in CDN signed URLs, etc.).
_JINJA = Environment(autoescape=False)  # noqa: S701


def _render_sw_url(assets_prefix: str) -> str:
    expression = _extract_sw_register_template()
    return _JINJA.from_string(expression).render(assets_prefix=assets_prefix)


@pytest.mark.parametrize(
    "assets_prefix, expected_url",
    [
        # Root deployment (STATIC_ASSETS_PREFIX defaults to "")
        ("", "/static/service-worker.js"),
        # Subdir deployment (app.py:73-74 backfills STATIC_ASSETS_PREFIX
        # to the app root when the operator hasn't set it explicitly)
        ("/superset", "/superset/static/service-worker.js"),
        # Operator-configured deep nesting
        ("/deep/nested/root", "/deep/nested/root/static/service-worker.js"),
        # CDN host — STATIC_ASSETS_PREFIX may legitimately be a full origin.
        # The SW will register against the CDN; that's a separate scope
        # concern (browser will refuse cross-origin SW registration without
        # `Service-Worker-Allowed`), but the template emission itself is
        # correct: one slash join, no doubling, no missing.
        (
            "https://cdn.example.com",
            "https://cdn.example.com/static/service-worker.js",
        ),
    ],
)
def test_rendered_sw_url_under_each_deployment_shape(
    assets_prefix: str, expected_url: str
) -> None:
    """The substituted URL has exactly one prefix join, no doubling, no `//`
    artefacts other than the URL scheme separator (CDN case).
    """
    rendered = _render_sw_url(assets_prefix)
    assert rendered == expected_url
    assert "/superset/superset/" not in rendered
    # `//` only legitimately appears as the scheme separator. Anywhere else
    # signals a join bug.
    after_scheme = rendered.split("://", 1)[-1]
    assert "//" not in after_scheme


def test_rendered_sw_url_under_subdir_is_single_prefixed() -> None:
    """Explicit pin for the subdir contract — the most common deployment
    shape this test was added to protect. Keeps the headline contract
    greppable from the failure message even if the parametrised case above
    is reorganised in future."""
    assert _render_sw_url("/superset") == "/superset/static/service-worker.js"


def test_rendered_sw_url_path_is_a_sibling_of_assets_dir() -> None:
    """The SW URL must sit at the deployment root, NOT under `/static/assets/`.

    Browsers derive the SW scope from the URL path (one directory up). The
    current shape `<root>/static/service-worker.js` gives scope `<root>/static/`
    — which still does not cover the deployed app routes. A future refactor
    that moves the SW into the bundled assets dir would silently shrink scope
    further. Pin the placement so any move surfaces here.
    """
    rendered = _render_sw_url("/superset")
    # The path segment after the prefix is `/static/service-worker.js`.
    assert rendered.endswith("/static/service-worker.js")
    assert "/static/assets/" not in rendered
