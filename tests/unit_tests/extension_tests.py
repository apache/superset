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
from os.path import dirname, join
from unittest.mock import Mock

from superset.extensions import UIManifestProcessor

APP_DIR = f"{dirname(__file__)}/fixtures"
SUPERSET_DIR = join(dirname(__file__), "..", "..", "superset")


def test_get_manifest_with_prefix():
    app = Mock(
        config={"STATIC_ASSETS_PREFIX": "https://cool.url/here"},
        template_context_processors={None: []},
    )
    manifest_processor = UIManifestProcessor(APP_DIR)
    manifest_processor.init_app(app)
    manifest = manifest_processor.get_manifest()
    assert manifest["js_manifest"]("main") == ["/static/dist/main-js.js"]
    assert manifest["css_manifest"]("main") == ["/static/dist/main-css.css"]
    assert manifest["js_manifest"]("styles") == ["/static/dist/styles-js.js"]
    assert manifest["css_manifest"]("styles") == []
    assert manifest["assets_prefix"] == "https://cool.url/here"


def test_get_manifest_no_prefix():
    app = Mock(
        config={"STATIC_ASSETS_PREFIX": ""}, template_context_processors={None: []}
    )
    manifest_processor = UIManifestProcessor(APP_DIR)
    manifest_processor.init_app(app)
    manifest = manifest_processor.get_manifest()
    assert manifest["js_manifest"]("main") == ["/static/dist/main-js.js"]
    assert manifest["css_manifest"]("main") == ["/static/dist/main-css.css"]
    assert manifest["js_manifest"]("styles") == ["/static/dist/styles-js.js"]
    assert manifest["css_manifest"]("styles") == []
    assert manifest["assets_prefix"] == ""


def test_spa_template_includes_css_bundles():
    """
    Verify spa.html loads CSS bundles for production builds.
    """
    template_path = join(SUPERSET_DIR, "templates", "superset", "spa.html")
    with open(template_path) as f:
        template_content = f.read()

    assert "css_bundle(assets_prefix, 'theme')" in template_content, (
        "spa.html must call css_bundle for the 'theme' entry to load "
        "extracted CSS (including font @font-face declarations) in production builds"
    )
    assert "css_bundle(assets_prefix, entry)" in template_content, (
        "spa.html must call css_bundle for the page entry to load "
        "entry-specific extracted CSS in production builds"
    )


def test_spa_template_standalone_body_has_min_height():
    """Standalone body must be measurable so screenshot waits don't time out."""
    from jinja2 import DictLoader, Environment

    template_path = join(SUPERSET_DIR, "templates", "superset", "spa.html")
    with open(template_path) as f:
        template_content = f.read()

    env = Environment(  # noqa: S701
        loader=DictLoader(
            {
                "spa.html": template_content,
                # Stub out includes/imports that are not relevant for this test.
                "appbuilder/general/lib.html": "",
                "superset/partials/asset_bundle.html": (
                    "{% macro css_bundle(prefix, entry) %}{% endmacro %}"
                    "{% macro js_bundle(prefix, entry) %}{% endmacro %}"
                ),
                "superset/macros.html": ("{% macro get_nonce() %}{% endmacro %}"),
                "tail_js_custom_extra.html": "",
                "head_custom_extra.html": "",
            }
        )
    )

    appbuilder = Mock()
    appbuilder.app.config = {"FAVICONS": []}

    def render(standalone_mode: bool) -> str:
        return env.get_template("spa.html").render(
            appbuilder=appbuilder,
            assets_prefix="",
            bootstrap_data="{}",
            entry="spa",
            standalone_mode=standalone_mode,
            theme_tokens={},
            spinner_svg=None,
        )

    standalone_html = render(standalone_mode=True)
    assert "body.standalone" in standalone_html
    assert "min-height: 100vh" in standalone_html

    non_standalone_html = render(standalone_mode=False)
    assert "body.standalone" not in non_standalone_html
