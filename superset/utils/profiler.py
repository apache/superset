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

from typing import Any, Callable
from unittest import mock

from werkzeug.wrappers import Request, Response

try:
    from pyinstrument import Profiler
except ModuleNotFoundError:
    Profiler = None


class SupersetProfiler:  # pylint: disable=too-few-public-methods
    """
    WSGI middleware to instrument Superset.

    To see the instrumentation for a given page, set `PROFILING=True`
    in the config, and append `?_instrument=1` to the page.
    """

    def __init__(
        self,
        app: Callable[[Any, Any], Any],
        interval: float = 0.0001,
    ):
        self.app = app
        self.interval = interval

    @Request.application
    def __call__(self, request: Request) -> Response:
        if request.args.get("_instrument") != "1":
            return Response.from_app(self.app, request.environ)

        if Profiler is None:
            raise Exception("The module pyinstrument is not installed.")

        profiler = Profiler(interval=self.interval)

        # call original request
        fake_start_response = mock.MagicMock()
        with profiler:
            self.app(request.environ, fake_start_response)

        # return HTML profiling information
        return Response(profiler.output_html(), mimetype="text/html")
