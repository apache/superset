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
"""Middleware to set ``REMOTE_USER`` from a proxy header."""

from __future__ import annotations

import sys
from typing import TYPE_CHECKING, Any

if sys.version_info >= (3, 11):
    from wsgiref.types import StartResponse, WSGIApplication, WSGIEnvironment
elif TYPE_CHECKING:
    from _typeshed.wsgi import StartResponse, WSGIApplication, WSGIEnvironment


class RemoteUserMiddleware:
    """WSGI middleware that copies a header into ``REMOTE_USER``."""

    def __init__(self, app: WSGIApplication, header: str) -> None:
        self.app = app
        self.header_env = f"HTTP_{header.upper().replace('-', '_')}"

    def __call__(
        self, environ: WSGIEnvironment, start_response: StartResponse
    ) -> Any:
        remote_user = environ.get(self.header_env)
        if remote_user:
            environ["REMOTE_USER"] = remote_user
        return self.app(environ, start_response)
