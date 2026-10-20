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
"""Serving the application shell at pages contributed by extensions."""

from contextlib import nullcontext
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError
from superset_core.extensions.types import ManifestPage

from superset.initialization import SupersetAppInitializer


def _page(
    path: str = "/acme-demo/queue/",
    id_: str = "acme.demo.queue",
    resource: str = "Dashboard",
) -> ManifestPage:
    return ManifestPage(
        id=id_,
        name="Queue",
        path=path,
        permission={"resource": resource, "action": "read"},
    )


def _extension_with_pages(*pages: ManifestPage) -> MagicMock:
    extension = MagicMock()
    extension.backend = None
    extension.manifest.id = "acme.demo"
    extension.manifest.backend = None
    extension.manifest.contributions.pages = list(pages)
    return extension


def _run_init(extension: MagicMock) -> MagicMock:
    initializer = object.__new__(SupersetAppInitializer)
    with (
        patch(
            "superset.extensions.utils.get_extensions",
            return_value={"acme.demo": extension},
        ),
        patch("superset.extensions.utils.install_in_memory_importer"),
        patch("superset.initialization.extension_context", return_value=nullcontext()),
        patch("superset.initialization.appbuilder") as mock_appbuilder,
    ):
        initializer.init_extensions()
    return mock_appbuilder


def test_build_page_view_serves_the_declared_path() -> None:
    from superset.extensions.view import build_page_view

    view = build_page_view(_page())

    assert view.route_base == "/acme-demo/queue"
    # FAB links a menu entry to `default_view` and assumes "list" when unset,
    # which breaks every page that renders the menu.
    assert view.default_view == "index"


def test_build_page_view_also_serves_sub_paths() -> None:
    """The frontend matches a page path as a prefix, so deep links must resolve."""
    from superset.extensions.view import build_page_view

    view = build_page_view(_page())
    exposed = {
        url
        for name in ("index", "deep_link")
        for url, *_ in getattr(getattr(view, name), "_urls", [])
    }

    assert "/" in exposed
    assert "/<path:subpath>" in exposed


def test_each_declared_page_is_registered() -> None:
    mock_appbuilder = _run_init(
        _extension_with_pages(
            _page("/acme-demo/queue/", "acme.demo.queue"),
            _page("/acme-demo/settings/", "acme.demo.settings"),
        )
    )

    assert mock_appbuilder.add_view_no_menu.call_count == 2
    registered = {
        call.args[0].route_base
        for call in mock_appbuilder.add_view_no_menu.call_args_list
    }
    assert registered == {"/acme-demo/queue", "/acme-demo/settings"}


def test_an_extension_with_no_pages_registers_nothing() -> None:
    extension = _extension_with_pages()
    extension.manifest.contributions = None

    assert _run_init(extension).add_view_no_menu.call_count == 0


def test_one_unregisterable_page_does_not_stop_the_extension() -> None:
    """A bad page must not take its extension's backend down with it."""
    initializer = object.__new__(SupersetAppInitializer)
    extension = _extension_with_pages(_page())
    extension.manifest.backend = MagicMock(entrypoint="acme.demo.backend:init")

    with (
        patch(
            "superset.extensions.utils.get_extensions",
            return_value={"acme.demo": extension},
        ),
        patch("superset.extensions.utils.install_in_memory_importer"),
        patch("superset.extensions.utils.eager_import") as mock_eager_import,
        patch("superset.initialization.extension_context", return_value=nullcontext()),
        patch(
            "superset.initialization.appbuilder.add_view_no_menu",
            side_effect=RuntimeError("boom"),
        ),
        patch("superset.initialization.logger") as mock_logger,
    ):
        initializer.init_extensions()

    mock_logger.exception.assert_called_once()
    # The failure names the extension and the page, so an operator can tell
    # which of several contributed pages is missing.
    assert "acme.demo:acme.demo.queue" in mock_logger.exception.call_args.args
    # The backend entrypoint still ran.
    mock_eager_import.assert_called_once_with("acme.demo.backend:init")


@pytest.mark.parametrize(
    "path",
    [
        "relative/",
        # Protocol-relative: a browser reads this as another host, so it would
        # be an open redirect anywhere the host emitted it as a link.
        "//evil.example.com/",
        "/ok/../../etc/",
        "/has space/",
        "",
        # A page owns its path as a prefix, so the root would be every page at
        # once, the host's own screens included.
        "/",
        # An empty interior segment and a "." segment are both spellings of a
        # path that is not the one it looks like.
        "/a//b/",
        "/a/./b/",
        "/.",
    ],
)
def test_a_page_path_that_is_not_a_plain_rooted_path_is_refused(path: str) -> None:
    with pytest.raises(ValidationError):
        ManifestPage(id="x", name="y", path=path, permission={"resource": "Dashboard"})


@pytest.mark.parametrize(
    "path", ["/acme-demo/queue/", "/my_ext/", "/a/b/c/", "/v1.2/page/"]
)
def test_ordinary_page_paths_are_accepted(path: str) -> None:
    assert (
        ManifestPage(
            id="x", name="y", path=path, permission={"resource": "Dashboard"}
        ).path
        == path
    )


def test_the_declared_path_actually_resolves(app) -> None:
    """The point of all of the above: the URL must not 404.

    The frontend route only exists once the application is running, so this
    is what makes a cold load, a refresh or a bookmark work. Before this, a
    contributed page resolved only for navigation that started inside the app.
    """
    from superset.extensions import appbuilder
    from superset.extensions.view import build_page_view

    path = "/acme-demo-resolves/queue/"
    with app.test_request_context():
        appbuilder.add_view_no_menu(build_page_view(_page(path, "acme.demo.resolves")))

    rules = {str(rule) for rule in app.url_map.iter_rules()}
    assert path in rules or path.rstrip("/") in rules, (
        f"{path} is not in the url map; a cold load would 404"
    )

    # And the deep link the frontend's prefix matching implies.
    assert any(
        str(rule).startswith("/acme-demo-resolves/queue/") and "subpath" in str(rule)
        for rule in app.url_map.iter_rules()
    ), "a deep link under the page path would 404"


def test_an_unauthenticated_cold_load_is_sent_to_login_not_404(app) -> None:
    """A 404 and a redirect to login are very different answers.

    404 is what the page gave before this change, and it is indistinguishable
    from the extension not being installed. It must also not be a 500, which
    is what `flask_login.login_required` produces here: Superset never sets
    `login_manager.login_view`, so the redirect it tries to build fails.
    """
    from superset.extensions import appbuilder
    from superset.extensions.view import build_page_view

    path = "/acme-demo-auth/queue/"
    with app.test_request_context():
        appbuilder.add_view_no_menu(build_page_view(_page(path, "acme.demo.auth")))

    response = app.test_client().get(path, follow_redirects=False)

    assert response.status_code != 404
    assert response.status_code in (301, 302, 308), response.status_code


def test_a_page_must_declare_the_permission_that_guards_it() -> None:
    """Omitting it would mean guessing, and the safe guess is not the useful one."""
    with pytest.raises(ValidationError):
        ManifestPage(id="x", name="y", path="/x/")


def test_the_declared_permission_guards_the_view() -> None:
    from superset.extensions.view import build_page_view

    view = build_page_view(_page(resource="ChangeRequest"))

    assert view.class_permission_name == "ChangeRequest"
    assert view.method_permission_name == {"index": "read", "deep_link": "read"}


def _extension(extension_id: str, pages: list[ManifestPage]) -> MagicMock:
    extension = MagicMock()
    extension.backend = None
    extension.manifest.id = extension_id
    extension.manifest.backend = None
    extension.manifest.contributions.pages = list(pages)
    return extension


def _build_app(extensions: dict[str, MagicMock]):
    """A Superset app built the way production builds one.

    Registration has to happen during ``init_app``: ``add_view_no_menu``
    registers a Flask blueprint, and Flask refuses that once the app has served
    a request. That is fine for extensions present at startup, which is what
    ``init_extensions`` handles -- and it is why a page contributed by an
    extension enabled at runtime needs a restart before its URL works.
    """
    import importlib
    import os

    from superset.app import SupersetApp
    from superset.extensions import appbuilder
    from superset.initialization import SupersetAppInitializer

    # "superset", not __name__: Flask resolves its template folder relative to
    # the import name, so a test module's name makes `superset/spa.html`
    # unfindable and the shell renders as a 500. That is why other tests in
    # this repo patch `render_app_template` out; here the point is to render it.
    app = SupersetApp("superset")
    app.config.from_object("superset.config")
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        os.environ.get("SUPERSET__SQLALCHEMY_DATABASE_URI") or "sqlite://"
    )
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["TESTING"] = True
    app.config["RATELIMIT_ENABLED"] = False
    app.config["CACHE_CONFIG"] = {}
    app.config["DATA_CACHE_CONFIG"] = {}
    app.config["SERVER_NAME"] = "example.com"
    app.config["APPLICATION_ROOT"] = "/"
    app.config["STATIC_ASSETS_PREFIX"] = ""
    app.config["FEATURE_FLAGS"] = {
        **app.config.get("FEATURE_FLAGS", {}),
        "ENABLE_EXTENSIONS": True,
    }

    appbuilder.baseviews = []

    with (
        patch("superset.extensions.utils.get_extensions", return_value=extensions),
        patch("superset.extensions.utils.install_in_memory_importer"),
        patch("superset.initialization.extension_context", return_value=nullcontext()),
    ):
        SupersetAppInitializer(app).init_app()

    with app.app_context():
        import superset.views.base

        importlib.reload(superset.views.base)

    return app


def _rules(app, needle: str) -> list[str]:
    return sorted(
        rule for rule in {str(r) for r in app.url_map.iter_rules()} if needle in rule
    )


@pytest.fixture
def app_with_page(request: pytest.FixtureRequest):
    """A Superset app built the way production builds one, with a page declared.

    Registration has to happen during ``init_app``: ``add_view_no_menu``
    registers a Flask blueprint, and Flask refuses that once the app has
    served a request. That is fine for extensions present at startup, which is
    what ``init_extensions`` handles -- and it is the reason a page contributed
    by an extension enabled at runtime needs a restart before its URL works.

    Built here rather than reusing the shared ``app`` fixture because that one
    is module-scoped and has already served a request by the time these tests
    run.
    """
    from superset.extensions import appbuilder

    pages = getattr(request, "param", None) or [
        _page("/acme-demo-render/queue/", "acme.demo.render")
    ]

    yield _build_app({"acme.demo": _extension("acme.demo", pages)})

    appbuilder.baseviews = []


def test_the_page_renders_the_application_shell(app_with_page, full_api_access) -> None:
    """The whole point: an authorised viewer gets the app, not a 404 or a 500.

    Resolving the route is not enough -- the shell has to render, with the
    bootstrap payload the frontend reads to start up, or the page is blank.
    """
    response = app_with_page.test_client().get("/acme-demo-render/queue/")
    body = response.get_data(as_text=True)

    assert response.status_code == 200, body[:400]
    # The mount point and the bootstrap payload the SPA reads on startup.
    assert 'id="app"' in body
    assert "data-bootstrap" in body


def test_a_deep_link_renders_the_same_shell(app_with_page, full_api_access) -> None:
    """The frontend matches a page's path as a prefix, so this must work too."""
    response = app_with_page.test_client().get("/acme-demo-render/queue/42/")
    body = response.get_data(as_text=True)

    assert response.status_code == 200, body[:400]
    assert 'id="app"' in body


def test_a_viewer_without_the_declared_permission_does_not_get_the_page(
    app_with_page,
) -> None:
    """The declared permission has to be enforced, not just recorded."""
    response = app_with_page.test_client().get("/acme-demo-render/queue/")

    assert response.status_code != 200
    assert 'id="app"' not in response.get_data(as_text=True)


def test_two_pages_sharing_an_id_are_refused_loudly(caplog) -> None:
    """One view class would be built for both, so the second silently vanishes.

    It is still only one page that gets served -- what changes is that the host
    says so, instead of the path simply not existing.
    """
    app = _build_app(
        {
            "acme.a": _extension(
                "acme.a",
                [_page("/dup-first/", "same.id"), _page("/dup-second/", "same.id")],
            )
        }
    )

    assert _rules(app, "/dup-first/")
    assert not _rules(app, "/dup-second/")
    assert any(
        "declared twice" in record.getMessage()
        # Both paths are named, because the owner alone cannot tell them apart
        # when the clash is inside one extension.
        and "/dup-first/" in record.getMessage()
        and "/dup-second/" in record.getMessage()
        for record in caplog.records
    ), [r.getMessage() for r in caplog.records]


def test_two_extensions_claiming_one_path_are_refused_loudly(caplog) -> None:
    """Which one answered would otherwise depend on load order."""
    app = _build_app(
        {
            "acme.a": _extension("acme.a", [_page("/shared-path/", "a.page")]),
            # Declared without the trailing slash: the same page, and the
            # normalisation in the manifest model is what makes that visible.
            "acme.b": _extension("acme.b", [_page("/shared-path", "b.page")]),
        }
    )

    assert len([r for r in app.url_map.iter_rules() if str(r) == "/shared-path/"]) == 1
    assert any(
        "claimed by both" in record.getMessage()
        and "acme.a:a.page" in record.getMessage()
        and "acme.b:b.page" in record.getMessage()
        for record in caplog.records
    ), [r.getMessage() for r in caplog.records]


def test_a_page_claiming_a_host_path_is_refused(caplog) -> None:
    """A contributed page must not shadow a screen Superset already serves."""
    app = _build_app(
        {"acme.a": _extension("acme.a", [_page("/dashboard/list/", "a.shadow")])}
    )

    # One rule, the host's -- not two with the answer depending on load order.
    assert (
        len([r for r in app.url_map.iter_rules() if str(r) == "/dashboard/list/"]) == 1
    )
    assert any(
        "which Superset already serves" in record.getMessage()
        for record in caplog.records
    ), [r.getMessage() for r in caplog.records]


def test_a_refused_page_does_not_stop_the_others(caplog) -> None:
    app = _build_app(
        {
            "acme.a": _extension(
                "acme.a",
                [
                    _page("/dashboard/list/", "a.shadow"),
                    _page("/still-served/", "a.good"),
                ],
            )
        }
    )

    assert _rules(app, "/still-served/")


def test_the_guarding_permission_is_logged(caplog) -> None:
    """A viewer without it is redirected with no hint about what they lack.

    The redirect is the right answer; being unable to find out which permission
    produced it is not, so the pairing is recorded at startup.
    """
    _build_app({"acme.a": _extension("acme.a", [_page("/logged/", "a.logged")])})

    assert any(
        "guarded by 'read on Dashboard'" in record.getMessage()
        and "/logged/" in record.getMessage()
        for record in caplog.records
    ), [r.getMessage() for r in caplog.records]


@pytest.mark.parametrize(
    ("declared", "normalised"),
    [("/q", "/q/"), ("/q/", "/q/"), ("/q///", "/q/"), ("/a/b", "/a/b/")],
)
def test_page_paths_are_normalised_to_one_trailing_slash(
    declared: str, normalised: str
) -> None:
    """So that "/queue" and "/queue/" are recognised as the same page."""
    assert (
        ManifestPage(
            id="x", name="y", path=declared, permission={"resource": "Dashboard"}
        ).path
        == normalised
    )


@pytest.mark.parametrize(
    "page_id",
    [
        "with space",
        "with/slash",
        "123start",
        "",
        "drop;table",
        # Upper case and empty segments would both reach the generated class
        # name, which is also what Flask-AppBuilder names the permissions after.
        "Upper.Case",
        "a..b",
    ],
)
def test_a_page_id_that_would_make_a_bad_view_name_is_refused(page_id: str) -> None:
    """The id becomes part of a generated view class name.

    Flask-AppBuilder names a view's permissions after its class, so an id with
    a space, a slash or no content at all ends up in a permission name -- and
    two empty ids would generate the same class and silently collide.
    """
    with pytest.raises(ValidationError):
        ManifestPage(
            id=page_id, name="Q", path="/x/", permission={"resource": "Dashboard"}
        )


@pytest.mark.parametrize(
    "page_id", ["a.b", "acme.demo.queue", "my_ext.queue-2", "queue"]
)
def test_ordinary_page_ids_are_accepted(page_id: str) -> None:
    assert (
        ManifestPage(
            id=page_id, name="Q", path="/x/", permission={"resource": "Dashboard"}
        ).id
        == page_id
    )
