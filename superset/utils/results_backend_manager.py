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


class ResultsBackendManager:
    def __init__(self) -> None:
        super().__init__()
        self._results_backend = None
        self._use_msgpack = False

    def init_app(self, app):
        self._results_backend = app.config.get("RESULTS_BACKEND")
        self._use_msgpack = app.config.get("RESULTS_BACKEND_USE_MSGPACK")

    @property
    def results_backend(self):
        return self.results_backend

    @property
    def should_use_msgpack(self):
        return self._use_msgpack
