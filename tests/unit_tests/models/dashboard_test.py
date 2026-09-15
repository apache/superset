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

import logging
from unittest.mock import patch, PropertyMock

import pytest
from flask import current_app

from superset.models.dashboard import Dashboard
from superset.utils import json


def test_dashboard_link_escapes_slug(app_context: None) -> None:
    """dashboard_link must HTML-escape the user-controlled slug in the href.

    The slug can carry markup via the import path (which does not run the REST
    API's slug sanitization), so the rendered FAB list-view link must escape it.
    `url_for` percent-encodes path params and `escape()` HTML-encodes the
    result before Markup-marking; the rendered link must contain neither the
    raw injected script tag nor an unescaped attribute breakout.
    """
    dash = Dashboard()
    dash.id = 1
    dash.dashboard_title = "My Dashboard"
    dash.slug = '"><script>alert(1)</script>'

    with current_app.test_request_context("/"):
        link = str(dash.dashboard_link())

    # The injected script tag / attribute breakout must be escaped away.
    assert "<script>" not in link
    assert '"><script' not in link
    # The legitimate anchor markup is still present.
    assert link.startswith("<a href=")
    assert "My Dashboard" in link


def test_dashboard_link_renders_plain_slug(app_context: None) -> None:
    """A normal slug renders a working link under a subdirectory deployment.

    `dashboard_link` uses `url_for`, which prepends the request's script root
    so the rendered href is correct under both root and `/superset`
    deployments. The test pins the `/superset` shape by passing `base_url`
    with the prefix path — werkzeug derives `SCRIPT_NAME` from the base URL's
    path and the URL adapter then prepends it on `url_for`. Passing
    `environ_base={"SCRIPT_NAME": "/superset"}` alone is not enough: the URL
    adapter is built from the parsed base URL, not raw environ values.
    """
    dash = Dashboard()
    dash.id = 7
    dash.dashboard_title = "Sales"
    dash.slug = "sales"

    with current_app.test_request_context("/", base_url="http://localhost/superset/"):
        link = str(dash.dashboard_link())

    assert "/superset/dashboard/sales/" in link
    assert "Sales" in link


def test_thumbnail_url_is_router_relative_at_root(app_context: None) -> None:
    """thumbnail_url uses url_for, so at root it keeps the legacy shape."""
    dash = Dashboard()
    dash.id = 7

    with patch.object(
        Dashboard, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        with current_app.test_request_context("/"):
            url = dash.thumbnail_url

    assert url == "/api/v1/dashboard/7/thumbnail/abc123/"


def test_thumbnail_url_carries_app_root_prefix(app_context: None) -> None:
    """Under a subdirectory deployment the serialized thumbnail URL must carry
    the application root, because the frontend treats thumbnail_url as an
    already-prefixed raw fetch target (it is excluded from
    normalizeBackendUrls and never passed through ensureAppRoot)."""
    dash = Dashboard()
    dash.id = 7

    with patch.object(
        Dashboard, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        with current_app.test_request_context(
            "/", base_url="http://example.com/superset/"
        ):
            url = dash.thumbnail_url

    assert url == "/superset/api/v1/dashboard/7/thumbnail/abc123/"


def test_thumbnail_url_is_none_without_digest(app_context: None) -> None:
    dash = Dashboard()
    dash.id = 7

    with patch.object(
        Dashboard, "digest", new_callable=PropertyMock, return_value=None
    ):
        with current_app.test_request_context("/"):
            assert dash.thumbnail_url is None


def test_thumbnail_url_works_outside_request_context(app_context: None) -> None:
    """The property must stay callable from out-of-request callers (CLI,
    celery tasks): with no request there is no SCRIPT_NAME to honor, so it
    falls back to the router-relative shape instead of raising."""
    dash = Dashboard()
    dash.id = 7

    with patch.object(
        Dashboard, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        url = dash.thumbnail_url

    assert url == "/api/v1/dashboard/7/thumbnail/abc123/"


LOGGER = "superset.models.dashboard"


def test_tabs_returns_all_tabs_and_tree_for_a_valid_layout(
    app_context: None,
) -> None:
    """A well-formed layout is walked exactly as before.

    This is the regression guard for the defensive lookups in `tabs`: when
    every id referenced by a `children` array resolves and every TAB node
    carries `meta.text`, the property must return the same `all_tabs` mapping
    and the same `tab_tree` shape it always has. Only TAB nodes surface in the
    tree — ROOT/GRID/TABS are traversed through, not emitted — and a tab
    nested inside another tab is emitted under its parent, not at top level.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]},
            "TABS-1": {
                "id": "TABS-1",
                "type": "TABS",
                "children": ["TAB-1", "TAB-2"],
            },
            # TAB-1 holds a nested tab bar of its own, alongside a row, so a
            # tab with more than one child is covered.
            "TAB-1": {
                "id": "TAB-1",
                "type": "TAB",
                "meta": {"text": "First"},
                "children": ["TABS-2", "ROW-1"],
            },
            # A non-tab sibling holding a chart: walked through, and neither
            # it nor its child is ever part of the tree.
            "ROW-1": {"id": "ROW-1", "type": "ROW", "children": ["CHART-1"]},
            "CHART-1": {"id": "CHART-1", "type": "CHART", "children": []},
            "TABS-2": {
                "id": "TABS-2",
                "type": "TABS",
                "children": ["TAB-1-1"],
            },
            "TAB-1-1": {
                "id": "TAB-1-1",
                "type": "TAB",
                "meta": {"text": "Nested"},
                "children": [],
            },
            "TAB-2": {
                "id": "TAB-2",
                "type": "TAB",
                "meta": {"text": "Second"},
                "children": [],
            },
        }
    )

    tabs = dash.tabs

    assert tabs["all_tabs"] == {
        "TAB-1": "First",
        "TAB-1-1": "Nested",
        "TAB-2": "Second",
    }

    tab_tree = tabs["tab_tree"]
    assert [node["id"] for node in tab_tree] == ["TAB-1", "TAB-2"]
    assert [node["type"] for node in tab_tree] == ["TAB", "TAB"]
    assert [node["title"] for node in tab_tree] == ["First", "Second"]
    assert [node["value"] for node in tab_tree] == ["TAB-1", "TAB-2"]

    # The nested tab replaces its parent's original children, and the TABS
    # container that held it is walked through rather than emitted.
    nested = tab_tree[0]["children"]
    assert [node["id"] for node in nested] == ["TAB-1-1"]
    assert [node["title"] for node in nested] == ["Nested"]
    assert [node["value"] for node in nested] == ["TAB-1-1"]
    assert nested[0]["children"] == []
    # Leaf tabs get an empty child list.
    assert tab_tree[1]["children"] == []


def test_tabs_skips_children_missing_from_the_layout(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A `children` entry naming an id that is not a key in the layout is
    skipped, with a warning, rather than raising.

    `position_json` is only validated for JSON parseability, so a stored
    layout can reference a node that no longer exists. The tabs that do
    resolve must still be returned.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]},
            "TABS-1": {
                "id": "TABS-1",
                "type": "TABS",
                # TAB-2 is referenced but never defined below.
                "children": ["TAB-1", "TAB-2"],
            },
            "TAB-1": {
                "id": "TAB-1",
                "type": "TAB",
                "meta": {"text": "First"},
                "children": [],
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs["all_tabs"] == {"TAB-1": "First"}
    assert [node["id"] for node in tabs["tab_tree"]] == ["TAB-1"]
    assert "skipping layout node TAB-2, missing or malformed" in caplog.text


def test_tabs_skips_layout_nodes_that_are_not_mappings(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A `children` entry resolving to something that is not an object is
    skipped, with a warning, rather than raising."""
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]},
            "TABS-1": {
                "id": "TABS-1",
                "type": "TABS",
                "children": ["TAB-1", "TAB-2"],
            },
            "TAB-1": {
                "id": "TAB-1",
                "type": "TAB",
                "meta": {"text": "First"},
                "children": [],
            },
            # Present, but not an object.
            "TAB-2": "not a node",
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs["all_tabs"] == {"TAB-1": "First"}
    assert "skipping layout node TAB-2, missing or malformed" in caplog.text


def test_tabs_skips_layout_nodes_without_a_type(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A node with no `type` is skipped, with a warning, rather than raising.

    Its subtree is dropped, so the warning is what tells an operator why a
    dashboard that visibly has tabs reports fewer of them.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            # No `type` key, so the tab bar underneath is never reached.
            "GRID_ID": {"id": "GRID_ID", "children": ["TABS-1"]},
            "TABS-1": {"id": "TABS-1", "type": "TABS", "children": ["TAB-1"]},
            "TAB-1": {
                "id": "TAB-1",
                "type": "TAB",
                "meta": {"text": "First"},
                "children": [],
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs == {"all_tabs": {}, "tab_tree": []}
    assert "skipping untyped layout node GRID_ID" in caplog.text


def test_tabs_handles_tab_nodes_without_a_title(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A TAB node whose title cannot be read does not raise.

    Every shape that `meta` can take without carrying a `text` is covered: no
    `meta` at all, an empty `meta`, and a `meta` that is not an object. All
    three keep the node, with an empty title, so a single untitled tab cannot
    take down the whole layout walk.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]},
            "TABS-1": {
                "id": "TABS-1",
                "type": "TABS",
                "children": ["TAB-1", "TAB-2", "TAB-3", "TAB-4"],
            },
            # No `meta` key at all.
            "TAB-1": {"id": "TAB-1", "type": "TAB", "children": []},
            # `meta` present but carrying no `text`.
            "TAB-2": {
                "id": "TAB-2",
                "type": "TAB",
                "meta": {},
                "children": [],
            },
            # `meta` present but not an object.
            "TAB-3": {
                "id": "TAB-3",
                "type": "TAB",
                "meta": "First",
                "children": [],
            },
            # `text` present but not a string.
            "TAB-4": {
                "id": "TAB-4",
                "type": "TAB",
                "meta": {"text": None},
                "children": [],
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs["all_tabs"] == {"TAB-1": "", "TAB-2": "", "TAB-3": "", "TAB-4": ""}
    assert [node["title"] for node in tabs["tab_tree"]] == ["", "", "", ""]
    for tab_id in ("TAB-1", "TAB-2", "TAB-3", "TAB-4"):
        assert f"tab node {tab_id} has no title in the layout" in caplog.text


def test_tabs_skips_tab_nodes_without_an_id(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A TAB node without a usable `id` is left out of the result entirely.

    Such a tab cannot be keyed in `all_tabs`, and it cannot carry a `value`,
    so a tree entry for it would not satisfy `TabSchema` and could never be
    selected in the tab picker. It is dropped from both, with a warning.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]},
            "TABS-1": {
                "id": "TABS-1",
                "type": "TABS",
                "children": ["TAB-1", "TAB-2", "TAB-3"],
            },
            # No `id` key.
            "TAB-1": {"type": "TAB", "meta": {"text": "First"}, "children": []},
            "TAB-2": {
                "id": "TAB-2",
                "type": "TAB",
                "meta": {"text": "Second"},
                "children": [],
            },
            # `id` present but not a string, so it cannot key `all_tabs`.
            "TAB-3": {
                "id": ["TAB-3"],
                "type": "TAB",
                "meta": {"text": "Third"},
                "children": [],
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs["all_tabs"] == {"TAB-2": "Second"}
    # The unusable tabs are absent from the tree too, so it cannot carry an
    # entry that has no `value` for the API to serialise.
    assert [node["id"] for node in tabs["tab_tree"]] == ["TAB-2"]
    assert all("value" in node for node in tabs["tab_tree"])
    assert caplog.text.count("skipping tab node with no usable id in the layout") == 2


def test_tabs_returns_no_tabs_when_layout_has_no_root(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A non-empty layout with no ROOT_ID node yields no tabs.

    The empty-layout early return does not cover this case, because the parsed
    layout is a non-empty mapping — it simply has nothing to start the walk
    from. Like every other exit it returns the normal payload shape, since
    callers index `all_tabs` and iterate `tab_tree`.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {"GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": []}}
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)

    assert dash.tabs == {"all_tabs": {}, "tab_tree": []}
    assert "layout has no usable ROOT_ID node" in caplog.text


def test_tabs_returns_no_tabs_for_an_empty_layout(app_context: None) -> None:
    """No layout at all — unset, blank or an empty object — yields no tabs."""
    dash = Dashboard()
    dash.id = 1

    dash.position_json = None
    assert dash.tabs == {"all_tabs": {}, "tab_tree": []}

    dash.position_json = ""
    assert dash.tabs == {"all_tabs": {}, "tab_tree": []}

    dash.position_json = json.dumps({})
    assert dash.tabs == {"all_tabs": {}, "tab_tree": []}


def test_tabs_returns_no_tabs_when_layout_is_not_a_mapping(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """Valid JSON that is not an object yields no tabs instead of raising.

    `null` and `[]` parse successfully but are not mappings, so they slip past
    the empty-layout early return.
    """
    dash = Dashboard()
    dash.id = 1

    caplog.set_level(logging.WARNING, logger=LOGGER)

    dash.position_json = json.dumps(None)
    assert dash.tabs == {"all_tabs": {}, "tab_tree": []}

    dash.position_json = json.dumps([])
    assert dash.tabs == {"all_tabs": {}, "tab_tree": []}

    assert caplog.text.count("layout is not a mapping") == 2


def test_tabs_handles_malformed_children(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A `children` value that cannot be walked is treated as empty.

    `children` is only meaningful as a list of node ids. A layout may store
    `null`, a scalar, or a list holding something that is not an id, none of
    which can be dereferenced.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]},
            "TABS-1": {
                "id": "TABS-1",
                "type": "TABS",
                # TAB-2 is named by an entry that is not an id.
                "children": ["TAB-1", ["TAB-2"]],
            },
            # `children` is not a list at all.
            "TAB-1": {
                "id": "TAB-1",
                "type": "TAB",
                "meta": {"text": "First"},
                "children": None,
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs["all_tabs"] == {"TAB-1": "First"}
    assert [node["id"] for node in tabs["tab_tree"]] == ["TAB-1"]
    assert tabs["tab_tree"][0]["children"] == []
    assert "layout node TAB-1 has malformed children" in caplog.text
    assert "missing or malformed" in caplog.text


def test_tabs_skips_an_unusable_tab_outside_a_tab_bar(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A TAB reached without a TABS parent is validated when it is registered.

    Only a TABS node contributes its children to the tree, so that is where an
    unusable tab is normally caught. A TAB stored directly under GRID or ROOT
    never passes that check, and is rejected when its title and id are read
    instead.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            # The tab hangs straight off the grid, with no tab bar in between.
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TAB-1"]},
            "TAB-1": {
                "id": ["TAB-1"],
                "type": "TAB",
                "meta": {"text": "First"},
                "children": [],
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs == {"all_tabs": {}, "tab_tree": []}
    assert "skipping tab node with no usable id in the layout" in caplog.text


def test_tabs_keeps_nodes_that_are_not_usable_tabs_out_of_the_tree(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """Only a node that registers as a tab is added to the tree.

    A TABS node contributes its children to `tab_tree`, but a child that is
    untyped, or is not a TAB, never reaches `register_tab` and so never gets a
    `value` or a `title`. Such an entry would not satisfy `TabSchema`, so it is
    kept out of the tree, while still being walked in case tabs are stored
    below it.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]},
            "TABS-1": {
                "id": "TABS-1",
                "type": "TABS",
                "children": ["TAB-1", "ROW-1", "TAB-2"],
            },
            # No `type`, so the walk rejects it before it can be registered.
            "TAB-1": {"id": "TAB-1", "meta": {"text": "Untyped"}, "children": []},
            # Typed, but not a tab.
            "ROW-1": {"id": "ROW-1", "type": "ROW", "children": []},
            "TAB-2": {
                "id": "TAB-2",
                "type": "TAB",
                "meta": {"text": "Second"},
                "children": [],
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs["all_tabs"] == {"TAB-2": "Second"}
    assert [node["id"] for node in tabs["tab_tree"]] == ["TAB-2"]
    # Nothing in the tree may be missing the fields the API serialises.
    assert all("value" in node and "title" in node for node in tabs["tab_tree"])
    for node_id in ("TAB-1", "ROW-1"):
        assert f"keeping layout node {node_id} out of the tab tree" in caplog.text


def test_tabs_stops_at_a_layout_that_reaches_itself(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A self-referencing layout must not queue the same node forever.

    The walk is a queue, so a node listed among its own descendants is
    re-enqueued on every pass and the walk never ends. A dashboard stored with
    such a layout could not be read or written again, because an update reads
    the stored tabs to find the deleted ones.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {"ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["ROOT_ID"]}}
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs == {"all_tabs": {}, "tab_tree": []}
    assert "skipping layout node ROOT_ID, the layout reaches it more than once" in (
        caplog.text
    )


def test_tabs_keeps_the_tabs_above_a_cycle(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A cycle deeper in the layout costs only the nodes below it."""
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]},
            "TABS-1": {"id": "TABS-1", "type": "TABS", "children": ["TAB-1"]},
            # Points back at its own tab bar.
            "TAB-1": {
                "id": "TAB-1",
                "type": "TAB",
                "meta": {"text": "First"},
                "children": ["TABS-1"],
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs["all_tabs"] == {"TAB-1": "First"}
    assert [node["id"] for node in tabs["tab_tree"]] == ["TAB-1"]
    assert "skipping layout node TABS-1, the layout reaches it more than once" in (
        caplog.text
    )


def test_tabs_places_a_node_the_layout_reaches_twice_only_once(
    app_context: None, caplog: pytest.LogCaptureFixture
) -> None:
    """A node reached from two parents is placed where it is reached first.

    This is not a cycle, but it is not a tree either — a node cannot render in
    two places — and the walk writes `title`, `value` and `children` onto each
    node it visits, so a second visit would overwrite the first.
    """
    dash = Dashboard()
    dash.id = 1
    dash.position_json = json.dumps(
        {
            "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
            "GRID_ID": {
                "id": "GRID_ID",
                "type": "GRID",
                "children": ["TABS-1", "TABS-2"],
            },
            "TABS-1": {"id": "TABS-1", "type": "TABS", "children": ["TAB-1"]},
            "TABS-2": {"id": "TABS-2", "type": "TABS", "children": ["TAB-1"]},
            "TAB-1": {
                "id": "TAB-1",
                "type": "TAB",
                "meta": {"text": "Shared"},
                "children": [],
            },
        }
    )

    caplog.set_level(logging.WARNING, logger=LOGGER)
    tabs = dash.tabs

    assert tabs["all_tabs"] == {"TAB-1": "Shared"}
    assert [node["id"] for node in tabs["tab_tree"]] == ["TAB-1"]
    assert "skipping layout node TAB-1, the layout reaches it more than once" in (
        caplog.text
    )
