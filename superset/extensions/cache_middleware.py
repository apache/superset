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
from __future__ import annotations

import re
from types import TracebackType
from typing import Callable, Iterable, TYPE_CHECKING

if TYPE_CHECKING:
    from _typeshed.wsgi import StartResponse, WSGIApplication, WSGIEnvironment

# Matches only the static asset endpoint: /api/v1/extensions/<publisher>/<name>/<file>
# Does not match the list (/), get (/<publisher>/<name>), or info (/_info) endpoints.
_ASSET_PATH_RE = re.compile(r"^/api/v1/extensions/[^/]+/[^/]+/[^/]+$")


class ExtensionCacheMiddleware:
    """Strip 'Cookie' from the Vary header on extension asset responses.

    Flask's session interface appends Vary: Cookie unconditionally after every
    after_request hook runs, so it cannot be removed at the view layer. This
    middleware intercepts the WSGI response at the lowest level, after all
    Flask processing is complete.
    """

    def __init__(self, wsgi_app: WSGIApplication) -> None:
        self.wsgi_app = wsgi_app

    def __call__(
        self, environ: WSGIEnvironment, start_response: StartResponse
    ) -> Iterable[bytes]:
        path = environ.get("PATH_INFO", "")
        if not _ASSET_PATH_RE.match(path):
            return self.wsgi_app(environ, start_response)

        def patched_start_response(
            status: str,
            response_headers: list[tuple[str, str]],
            exc_info: (
                tuple[type[BaseException], BaseException, TracebackType]
                | tuple[None, None, None]
                | None
            ) = None,
        ) -> Callable[[bytes], object]:
            new_headers = []
            for name, value in response_headers:
                if name.lower() == "vary":
                    parts = [
                        v.strip()
                        for v in value.split(",")
                        if v.strip().lower() != "cookie"
                    ]
                    if parts:
                        new_headers.append((name, ", ".join(parts)))
                else:
                    new_headers.append((name, value))
            return start_response(status, new_headers, exc_info)

        return self.wsgi_app(environ, patched_start_response)
