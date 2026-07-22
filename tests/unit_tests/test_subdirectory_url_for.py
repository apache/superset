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
"""url_for emission for Superset.* endpoints under subdirectory deployments.

Flask-AppBuilder's BaseView auto-derives `route_base` from the class name,
which used to mount every `@expose` route on `Superset` under `/superset/...`.
Combined with `AppRootMiddleware` stripping `/superset` from `PATH_INFO` and
setting `SCRIPT_NAME=/superset`, werkzeug's `MapAdapter.build` produced
doubled URLs (`/superset/superset/...`) on every `url_for(..., _external=True)`
call into that namespace — and the routes themselves became unreachable at
request time because the in-rule `/superset` prefix no longer matched the
post-strip PATH_INFO.

`Superset.route_base = ""` mounts the routes at the root so the appRoot
applies exactly once (via SCRIPT_NAME / basename). These tests pin both
branches: no SCRIPT_NAME and SCRIPT_NAME=`/superset`.
"""

from flask import url_for


def test_dashboard_permalink_url_has_no_route_prefix_without_script_name(
    app_context: None,
) -> None:
    """Under root deployment, the permalink route lives at /dashboard/p/<key>/.

    The auto-derived `/superset` prefix on the `Superset` view class is gone;
    the route is now mounted at the root path so url_for returns a single,
    prefix-free URL.
    """
    from flask import current_app

    with current_app.test_request_context("/"):
        url = url_for("Superset.dashboard_permalink", key="abc123")
        assert url == "/dashboard/p/abc123/"


def test_dashboard_permalink_url_carries_single_script_name_prefix(
    app_context: None,
) -> None:
    """Under subdirectory deployment, url_for emits exactly one prefix.

    AppRootMiddleware sets SCRIPT_NAME=/superset on every inbound request
    once APPLICATION_ROOT is configured. url_for prepends SCRIPT_NAME to the
    rule, so the emitted URL is `/superset/dashboard/p/<key>/` — a single
    prefix, not the previous `/superset/superset/dashboard/p/<key>/`.
    """
    from flask import current_app

    with current_app.test_request_context(
        "/",
        environ_overrides={"SCRIPT_NAME": "/superset"},
    ):
        url = url_for("Superset.dashboard_permalink", key="abc123")
        assert url == "/superset/dashboard/p/abc123/"


def test_welcome_url_carries_single_script_name_prefix(
    app_context: None,
) -> None:
    """Spot-check a second route to confirm the fix is not endpoint-specific.

    The `brand.path` regression in the QA findings traced to
    `url_for("Superset.welcome", _external=True)` returning the doubled
    `/superset/superset/welcome/`. Pinning a single-prefix expectation for
    welcome guards against a regression that reintroduces the auto-derived
    route_base on the Superset class.
    """
    from flask import current_app

    with current_app.test_request_context(
        "/",
        environ_overrides={"SCRIPT_NAME": "/superset"},
    ):
        url = url_for("Superset.welcome")
        assert url == "/superset/welcome/"


def test_dashboard_permalink_external_url_is_single_prefixed(
    app_context: None,
) -> None:
    """`url_for(..., _external=True)` is the shape the permalink API serves.

    Pin the external (scheme://host included) variant explicitly — that is
    the value that ends up on the user's clipboard via
    `superset/dashboards/permalink/api.py` and must carry one application
    root segment, not two.
    """
    from flask import current_app

    with current_app.test_request_context(
        "/",
        environ_overrides={"SCRIPT_NAME": "/superset"},
    ):
        url = url_for("Superset.dashboard_permalink", key="abc123", _external=True)
        assert url.endswith("/superset/dashboard/p/abc123/")
        assert "/superset/superset/" not in url


def test_explore_permalink_url_is_single_prefixed(app_context: None) -> None:
    """ExplorePermalinkView previously hard-coded route_base = "/superset".

    The `superset/explore/permalink/api.py` endpoint serves the clipboard URL
    via `url_for("ExplorePermalinkView.permalink", _external=True)`. Under
    SCRIPT_NAME=/superset that combination doubled to
    `/superset/superset/explore/p/<key>/`. Mirroring the Superset.route_base=""
    decision pins the single-prefix shape and prevents the doubled emission
    from regressing.
    """
    from flask import current_app

    with current_app.test_request_context(
        "/",
        environ_overrides={"SCRIPT_NAME": "/superset"},
    ):
        url = url_for("ExplorePermalinkView.permalink", key="abc123", _external=True)
        assert url.endswith("/superset/explore/p/abc123/")
        assert "/superset/superset/" not in url


def test_tag_views_urls_are_single_prefixed(app_context: None) -> None:
    """TagModelView and TaggedObjectsModelView previously hard-coded
    `route_base = "/superset/tags"` / `/superset/all_entities"`.

    Mirroring the Superset.route_base="" decision, the rule is now
    `/tags/` / `/all_entities/` and `url_for` under SCRIPT_NAME=/superset
    must carry the prefix exactly once.
    """
    from flask import current_app

    with current_app.test_request_context(
        "/",
        environ_overrides={"SCRIPT_NAME": "/superset"},
    ):
        assert url_for("TagModelView.list") == "/superset/tags/"
        assert url_for("TaggedObjectsModelView.list") == "/superset/all_entities/"


def test_dashboard_model_url_has_no_route_prefix() -> None:
    """`Dashboard.url` / `Dashboard.get_url` previously hard-coded
    `/superset/dashboard/<id>/` as a string literal.

    After `Superset.route_base = ""` the backend rule is `/dashboard/<id>/`,
    so the literal was wrong on both root deployments (no matching rule) and
    on subdirectory deployments (downstream callers re-applied the app root
    and produced doubled paths in DashboardList row hrefs, ultimately leading
    to the user-visible discard-edit 404). The method now returns a
    prefix-free relative URL that downstream `ensureAppRoot`-aware helpers
    can prepend exactly once.
    """
    from superset.models.dashboard import Dashboard

    assert Dashboard.get_url(11) == "/dashboard/11/"
    assert Dashboard.get_url(11, "births") == "/dashboard/births/"


def test_slice_explore_json_url_has_no_route_prefix(app_context: None) -> None:
    """`Slice.explore_json_url` previously baked `/superset/explore_json` into
    the path. After `Superset.route_base = ""` the rule is `/explore_json/`,
    so the literal pointed at a non-existent route. Pin the prefix-free shape
    so downstream `ensureAppRoot` callers prepend the application root once.
    """
    from superset.models.slice import Slice

    slc = Slice(id=42)
    assert slc.explore_json_url.startswith("/explore_json/")
    assert "/superset/explore_json" not in slc.explore_json_url


def test_database_sql_url_resolves_to_live_sqllab_route() -> None:
    """`Database.sql_url` previously returned `/superset/sql/<id>/` — a route
    that was removed when SQL Lab moved to its own blueprint at `/sqllab/`.
    The property now deep-links to SQL Lab via the `dbid` query parameter so
    it resolves under any application_root.
    """
    from superset.models.core import Database

    db = Database(database_name="db", id=7)
    assert db.sql_url == "/sqllab/?dbid=7"


def test_dashboard_link_emits_script_name_under_subdirectory(
    app_context: None,
) -> None:
    """`dashboard_link` renders raw HTML for the FAB list-view "title" column.
    Flask does not auto-apply SCRIPT_NAME to string fragments, so a literal
    `/dashboard/<id>/` href routed outside the application_root under
    subdirectory deployment. Pin that the rendered href now carries the
    SCRIPT_NAME prefix exactly once.
    """
    from flask import current_app

    from superset.models.dashboard import Dashboard

    dash = Dashboard(id=5, slug=None, dashboard_title="t")
    with current_app.test_request_context(
        "/", environ_overrides={"SCRIPT_NAME": "/superset"}
    ):
        html = str(dash.dashboard_link())
        assert 'href="/superset/dashboard/5/"' in html
        assert "/superset/superset/" not in html


def test_slice_link_emits_script_name_under_subdirectory(
    app_context: None,
) -> None:
    """Mirror of `dashboard_link` for `Slice.slice_link`."""
    from flask import current_app

    from superset.models.slice import Slice

    slc = Slice(id=9, slice_name="chart")
    with current_app.test_request_context(
        "/", environ_overrides={"SCRIPT_NAME": "/superset"}
    ):
        html = str(slc.slice_link)
        assert 'href="/superset/explore/?slice_id=9"' in html
        assert "/superset/superset/" not in html


def test_sqllab_permalink_external_url_is_single_prefixed(
    app_context: None,
) -> None:
    """SqllabView mounts the permalink view at `/sqllab/p/<key>/`.

    The clipboard URL surfaced by `superset/sqllab/permalink/api.py` is built
    via `url_for("SqllabView.permalink_view", _external=True)`. Under
    SCRIPT_NAME=/superset that emission must carry the prefix exactly once —
    mirroring the dashboard/explore permalink pins so a future regression to
    `SqllabView.route_base` (e.g. someone restoring the auto-derived
    `/SqllabView` or a hard-coded `/superset/sqllab` prefix) surfaces here
    rather than in user-reported broken share links.
    """
    from flask import current_app

    with current_app.test_request_context(
        "/",
        environ_overrides={"SCRIPT_NAME": "/superset"},
    ):
        url = url_for("SqllabView.permalink_view", permalink="abc123", _external=True)
        assert url.endswith("/superset/sqllab/p/abc123/")
        assert "/superset/superset/" not in url
