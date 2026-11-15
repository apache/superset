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
Standalone pages: an extension's own pages, which Superset serves.

An extension serves a page from one of its REST endpoints, so the page has
that endpoint's URL and its checks: the endpoint checks what the page needs,
as the endpoints the page calls do, and answers ``render_page``. The host
answers with Superset's app shell, without the menu, which renders the
component that the extension's frontend registered under the page's id
(``pages.registerPage`` in ``@apache-superset/core``).

Usage:
    from superset_core.extensions.pages import render_page

    @expose("/report/<report_id>/page", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    def report_page(self, report_id: str) -> Response:
        # The same checks as the endpoints the page calls.
        return render_page("extensions.acme.reports.report", {"reportId": report_id})
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from flask import Response


def render_page(page: str, params: Mapping[str, str] | None = None) -> Response:
    """
    Superset's app shell, rendering the extension page registered as ``page``.

    ``page`` is the id that the frontend registered the page's component
    under. The host prefixes no frontend id, so it carries the extension's
    own prefix, such as ``extensions.acme.reports.report``. ``params`` reach
    the component as its ``params`` prop: what the page needs to find its
    content, such as an id, and never the content itself, which the page
    fetches through the extension's endpoints and their checks. The shell
    carries nothing else of the page's.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param page: The id that the frontend registered the page under.
    :param params: Strings by name, for the page's component.
    :returns: The HTML response that renders the page.
    :raises NotImplementedError: If called before the host implementation is
        initialized.
    """
    raise NotImplementedError(
        "render_page not initialized. "
        "This function should be replaced during Superset startup."
    )
