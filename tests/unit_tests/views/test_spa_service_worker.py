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

"""Pin the spa.html service-worker registration URL.

A service worker script must be same-origin with the page. `spa.html`
therefore registers `{{ application_root_rstrip }}/static/service-worker.js`
(the app origin, like the PWA manifest link) and never `assets_prefix`, which
`STATIC_ASSETS_PREFIX` may point at a cross-origin CDN.

`register()` is called without a `scope` option, so the browser-derived scope
is the script's directory (`<root>/static/`). That is unrelated to this
contract and unchanged by it.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from jinja2 import ChoiceLoader, DictLoader, Environment, FileSystemLoader

REPO_ROOT = Path(__file__).resolve().parents[3]
TEMPLATES_DIR = REPO_ROOT / "superset/templates"
SPA_HTML = TEMPLATES_DIR / "superset/spa.html"

SW_REGISTER_LINE_RE = re.compile(r"navigator\.serviceWorker\s*\.register\(\s*'([^']+)'")

CDN = "https://cdn.example.com"

# Partials that need the full Flask-AppBuilder stack and do not affect the
# service-worker registration are stubbed; spa.html itself is the real file.
_STUBS = {
    "appbuilder/general/lib.html": "",
    "head_custom_extra.html": "",
    "tail_js_custom_extra.html": "",
}


def _render_spa(application_root_rstrip: str = "", assets_prefix: str = "") -> str:
    env = Environment(  # noqa: S701
        loader=ChoiceLoader([DictLoader(_STUBS), FileSystemLoader(TEMPLATES_DIR)]),
        autoescape=True,
    )
    return env.get_template("superset/spa.html").render(
        config={"FAVICONS": []},
        assets_prefix=assets_prefix,
        application_root_rstrip=application_root_rstrip,
        js_manifest=lambda bundle: [],
        css_manifest=lambda bundle: [],
        entry="spa",
        bootstrap_data="{}",
        theme_tokens={},
    )


def test_spa_html_service_worker_registration_uses_application_root() -> None:
    """The register URL expression is rooted at the app, not `assets_prefix`."""
    match = SW_REGISTER_LINE_RE.search(SPA_HTML.read_text())
    assert match is not None, (
        "spa.html no longer contains a `navigator.serviceWorker.register(...)` "
        "call. If the SW was intentionally removed, delete this test module."
    )
    assert match.group(1) == "{{ application_root_rstrip }}/static/service-worker.js"


def test_spa_html_service_worker_block_uses_feature_detection() -> None:
    """Registration stays guarded by `'serviceWorker' in navigator`."""
    source = SPA_HTML.read_text()
    assert "'serviceWorker' in navigator" in source
    assert "window.addEventListener('load'" in source


@pytest.mark.parametrize(
    "application_root_rstrip, assets_prefix, expected",
    [
        ("", "", "/static/service-worker.js"),
        ("/superset", "/superset", "/superset/static/service-worker.js"),
        ("", CDN, "/static/service-worker.js"),
        ("/superset", CDN, "/superset/static/service-worker.js"),
    ],
)
def test_rendered_spa_registers_service_worker_from_app_origin(
    application_root_rstrip: str, assets_prefix: str, expected: str
) -> None:
    """The rendered page registers a same-origin URL, even with a CDN prefix."""
    html = _render_spa(application_root_rstrip, assets_prefix)
    assert f".register('{expected}')" in html
    if assets_prefix == CDN:
        assert f"{CDN}/static/service-worker.js" not in html
