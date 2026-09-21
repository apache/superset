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

import asyncio
from unittest.mock import MagicMock, patch

import pytest

from superset.mcp_service.widgets.prompts.build_widget_artifact import (
    get_widgets_bundle_url,
    render_widget_artifact_guide,
)

BUNDLE_URL = (
    "https://cdn.jsdelivr.net/npm/@apache-superset/widgets@0.1.0/"
    "artifact/superset-widgets.min.js"
)
MODULE = "superset.mcp_service.widgets.prompts.build_widget_artifact"


def test_guide_with_bundle_url_includes_loader_session_and_manifest() -> None:
    guide = render_widget_artifact_guide(BUNDLE_URL, connector_name="Acme Superset")

    assert f"Load the bundle from `{BUNDLE_URL}`" in guide
    assert f'const WIDGETS_URL = "{BUNDLE_URL}";' in guide
    assert "function loadSupersetWidgets(url)" in guide
    assert 'server: "Acme Superset",\n          strategy: "widget-tools",' in guide
    assert (
        '{"mcp": {"servers": [{"server": "Acme Superset", "tools": '
        '["get_widget_data", "get_widget_values", "get_saved_widget"]}]}}'
    ) in guide
    assert "ask the user for" not in guide


def test_guide_without_bundle_url_tells_the_model_to_ask() -> None:
    guide = render_widget_artifact_guide(None)

    assert "MCP_WIDGETS_BUNDLE_URL" in guide
    assert "ask the user for" in guide
    assert "guess a URL" in guide
    assert "<WIDGETS_BUNDLE_URL>" in guide


def test_query_dataset_strategy_manifest_and_limits() -> None:
    guide = render_widget_artifact_guide(BUNDLE_URL, strategy="query-dataset")

    assert '"tools": ["query_dataset"]' in guide
    assert "saved metric names only" in guide
    assert '"get_widget_data"' not in guide


def test_html_artifact_kind_uses_a_script_tag() -> None:
    guide = render_widget_artifact_guide(BUNDLE_URL, artifact_kind="html")

    assert f'<script src="{BUNDLE_URL}"></script>' in guide
    assert "```html" in guide
    assert "useEffect" not in guide


def test_unknown_options_fall_back_to_defaults() -> None:
    guide = render_widget_artifact_guide(
        BUNDLE_URL, strategy="nope", artifact_kind="svelte"
    )

    assert 'strategy: "widget-tools"' in guide
    assert "```jsx" in guide


def test_bundle_url_comes_from_app_config() -> None:
    app = MagicMock()
    app.config = {"MCP_WIDGETS_BUNDLE_URL": BUNDLE_URL}
    with patch(f"{MODULE}.current_app", app):
        assert get_widgets_bundle_url() == BUNDLE_URL


def test_bundle_url_defaults_to_none_outside_an_app() -> None:
    assert get_widgets_bundle_url() is None


@pytest.fixture
def feature_flags_enabled():
    with patch("superset.extensions.feature_flag_manager") as flags:
        flags.is_feature_enabled.return_value = True
        yield flags


def test_prompt_is_registered(feature_flags_enabled: MagicMock) -> None:
    from superset.mcp_service.app import mcp

    prompts = asyncio.run(mcp.list_prompts())

    assert "build_widget_artifact" in {prompt.name for prompt in prompts}
