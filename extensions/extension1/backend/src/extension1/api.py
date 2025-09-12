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

from flask import Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from superset_core.api.types.rest_api import RestApi


class Extension1API(RestApi):
    # TODO: These need to be automated and prefixed, like "Extension [extension1]"
    resource_name = "extension1"
    openapi_spec_tag = "Extension1"
    class_permission_name = "extension1"

    @expose("/hello")
    @protect()
    @safe
    @permission_name("read")
    def hello(self) -> Response:
        return self.response(200, result="Hello world!")
