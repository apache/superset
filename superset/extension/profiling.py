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
from flask import Flask

from superset.utils.profiler import SupersetProfiler


class ProfilingExtension:  # pylint: disable=too-few-public-methods
    def __init__(self, interval: float = 1e-4) -> None:
        self.interval = interval

    def init_app(self, app: Flask) -> None:
        app.wsgi_app = SupersetProfiler(app.wsgi_app, self.interval)  # type: ignore
