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

from superset.async_events.async_query_manager import AsyncQueryManager
from superset.utils.class_utils import load_class_from_name


class AsyncQueryManagerFactory:
    def __init__(self) -> None:
        self._async_query_manager: AsyncQueryManager = None  # type: ignore

    def init_app(self, app: Flask) -> None:
        self._async_query_manager = load_class_from_name(
            app.config["GLOBAL_ASYNC_QUERY_MANAGER_CLASS"]
        )()
        self._async_query_manager.init_app(app)

    def instance(self) -> AsyncQueryManager:
        return self._async_query_manager
