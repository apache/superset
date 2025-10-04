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

from typing import Type

from superset_core.api.types.rest_api import CoreRestApi, RestApi

from superset.extensions import appbuilder


class HostRestApi(CoreRestApi):
    @staticmethod
    def add_api(api: Type[RestApi]) -> None:
        view = appbuilder.add_api(api)
        appbuilder._add_permission(view, True)

    @staticmethod
    def add_extension_api(api: Type[RestApi]) -> None:
        api.route_base = "/extensions/" + (api.resource_name or "")
        view = appbuilder.add_api(api)
        appbuilder._add_permission(view, True)
