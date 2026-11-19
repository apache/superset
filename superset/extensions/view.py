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
import functools
import logging
from typing import Any, Callable

from flask import redirect, render_template, request, url_for
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access, permission_name
from flask_login import current_user

from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView, get_spa_template_context

logger = logging.getLogger(__name__)


def signed_in(f: Callable[..., FlaskResponse]) -> Callable[..., FlaskResponse]:
    """Require a session, and nothing more.

    ``@has_access`` is the usual decorator and the wrong one for a contributed
    page: on ``ExtensionsView`` it asks for ``can_read on Extensions``, which
    ``superset init`` grants to Admin alone. ``flask_login``'s
    ``login_required`` is the other obvious choice and cannot redirect here --
    FAB sets ``login_view`` to ``"login"`` while the endpoint it registers is
    ``AuthDBView.login``, so an anonymous request raises ``BuildError`` and
    becomes a 500 instead of reaching the form. Hence FAB's own redirect,
    without FAB's permission check.
    """

    @functools.wraps(f)
    def wrapper(self: Any, *args: Any, **kwargs: Any) -> FlaskResponse:
        if current_user and current_user.is_authenticated:
            return f(self, *args, **kwargs)
        return redirect(
            url_for(
                f"{self.appbuilder.sm.auth_view.__class__.__name__}.login",
                next=request.url,
            )
        )

    return wrapper


class ExtensionsView(BaseSupersetView):
    route_base = "/extensions"
    class_permission_name = "Extensions"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    @expose("/list/")
    @has_access
    @permission_name("read")
    def list(self) -> FlaskResponse:
        return super().render_app_template()

    @expose("/pages/<page_id>")
    # Registered again with the trailing slash rather than left to Flask's
    # redirect: a rule declared without one does not match with one, and
    # ``expose`` has no ``strict_slashes`` to pass through the way
    # ``add_url_rule`` did. Most Superset screens are linked with a trailing
    # slash -- the bell's "View all approvals" among them -- so the slashed
    # form has to be a rule in its own right or it hard-404s for everyone,
    # admin included.
    @expose("/pages/<page_id>/")
    # And again for anything the page routes to below its own address.
    # ``navigation.navigateTo`` is part of the contract this view serves --
    # a page reads its own sub-path from ``navigation.getLocation()`` and
    # moves within itself by pushing one -- so the client puts sub-paths in
    # the address bar whether or not the server has a rule for them.
    # Without this one it does not: the page works until it is reloaded,
    # bookmarked or shared, and then 404s.
    # ``sub_path`` is accepted and ignored, because the shell is the same
    # shell and the client router reads the rest off ``window.location``.
    @expose("/pages/<page_id>/<path:sub_path>")
    # Signed in, and nothing more. Deliberately not ``@has_access``, which on
    # this view asks for ``can_read on Extensions`` -- a permission ``superset
    # init`` grants to Admin alone, so every contributed page was admin-only
    # on any cold load (reload, bookmark, link) while opening fine by menu
    # click, which routes client-side and never asks the server. That is the
    # wrong question twice over: the shell carries no data, and a page's own
    # permission -- named on its ``registerView`` call and checked against the
    # permissions this shell already ships -- is what decides who may open it,
    # so a feature whose point is non-admin editors cannot hang off an admin
    # permission.
    @signed_in
    def page(self, page_id: str, sub_path: str | None = None) -> FlaskResponse:
        """The application shell for a contributed page.

        One route for every page there will ever be, because the address is
        the host's to form. It carries no data -- the extension's own REST
        endpoints are the security boundary and go through ``@protect()`` --
        so serving the shell for an id nothing registered is not a leak, and
        the client says "not found" once extensions have settled.

        A page whose permission the user does not hold is served too: the
        gate is on reachability and advertisement, not on data, and the
        client renders its own "Not authorized" state from the permissions
        the shell's bootstrap payload already carries.
        """
        return _render_shell()


def _render_shell() -> str:
    """The application shell, identical to the one ``/welcome/`` serves."""
    return render_template("superset/spa.html", **get_spa_template_context())
