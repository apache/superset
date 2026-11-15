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
"""
The host's side of standalone extension pages
(``superset_core.extensions.pages``).

``render_page`` serves the single-page app's shell, as the host's own pages
do, with the page's id and params in the bootstrap data under
``extension_page``: the frontend renders that page instead of its routes.
"""

from __future__ import annotations

from collections.abc import Mapping

from flask import current_app, render_template, Response

from superset.extensions import appbuilder
from superset.views.base import get_spa_template_context

#: Where the bootstrap data names the page that the shell renders.
BOOTSTRAP_KEY = "extension_page"


def render_page(page: str, params: Mapping[str, str] | None = None) -> Response:
    """
    The host's ``superset_core.extensions.pages.render_page``.

    Raises ``ValueError`` for an empty page id, and ``TypeError`` for params
    that aren't strings by name.
    """
    if not isinstance(page, str) or not page:
        raise ValueError("a page's id is a non-empty string")
    values = dict(params or {})
    if not all(
        isinstance(name, str) and isinstance(value, str)
        for name, value in values.items()
    ):
        raise TypeError("a page's params are strings by name")
    context = get_spa_template_context(
        "spa",
        {BOOTSTRAP_KEY: {"id": page, "params": values}},
        standalone_mode=True,
    )
    # What Flask-AppBuilder's BaseView.render_template adds for its templates.
    html = render_template(
        "superset/spa.html",
        base_template=appbuilder.base_template,
        appbuilder=appbuilder,
        current_app=current_app,
        **context,
    )
    return Response(html, mimetype="text/html")
