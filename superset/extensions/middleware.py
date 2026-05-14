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
import re
from collections.abc import Callable, Iterator
from typing import Any

# Matches /api/v1/extensions/<publisher>/<name>/<file>
_EXTENSION_ASSET_RE = re.compile(r"^/api/v1/extensions/[^/]+/[^/]+/[^/]+$")


class ExtensionStaticCacheMiddleware:
    """
    Strips the `Vary: Cookie` header from extension static asset responses.

    Flask's session machinery adds `Vary: Cookie` to every response whenever
    the session object is accessed anywhere in the request pipeline, even by
    unrelated `after_request` hooks. This prevents browsers from caching
    extension chunks (JS, WASM) by URL.

    Extension asset filenames include a content hash, so the URL is the only
    cache key needed. This middleware removes `Vary: Cookie` for those URLs
    after the full WSGI response has been assembled, after all Flask hooks have
    run.
    """

    def __init__(self, app: Any) -> None:
        self.app = app

    def __call__(
        self, environ: dict[str, Any], start_response: Callable[..., Any]
    ) -> Iterator[bytes]:
        path = environ.get("PATH_INFO", "")
        if not _EXTENSION_ASSET_RE.match(path):
            return self.app(environ, start_response)

        def strip_vary_cookie(
            status: str,
            headers: list[tuple[str, str]],
            exc_info: Any = None,
        ) -> Any:
            new_headers = []
            for name, value in headers:
                if name.lower() == "vary":
                    stripped = ", ".join(
                        v.strip()
                        for v in value.split(",")
                        if v.strip().lower() != "cookie"
                    )
                    if stripped:
                        new_headers.append((name, stripped))
                else:
                    new_headers.append((name, value))
            return start_response(status, new_headers, exc_info)

        return self.app(environ, strip_vary_cookie)
