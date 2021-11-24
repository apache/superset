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
import logging
from abc import abstractmethod
from typing import Any

from flask import g, request, Response
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.exceptions import InvalidPayloadFormatError
from superset.key_value.commands.create import CreateKeyValueCommand
from superset.key_value.commands.delete import DeleteKeyValueCommand
from superset.key_value.commands.get import GetKeyValueCommand
from superset.key_value.commands.update import UpdateKeyValueCommand
from superset.key_value.schemas import KeyValuePostSchema, KeyValuePutSchema
from superset.models.key_value import KeyValueEntry
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class KeyValueRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(KeyValueEntry)
    add_model_schema = KeyValuePostSchema()
    edit_model_schema = KeyValuePutSchema()
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = {
        RouteMethod.POST,
        RouteMethod.PUT,
        RouteMethod.GET,
        RouteMethod.DELETE,
    }
    allow_browser_login = True
    openapi_spec_component_schemas = (
        KeyValuePostSchema,
        KeyValuePutSchema,
    )

    def post(self, pk: int) -> Response:
        if not request.is_json:
            raise InvalidPayloadFormatError("Request is not JSON")
        item = self.add_model_schema.load(request.json)
        key = CreateKeyValueCommand(g.user, self.get_dao(), pk, item).run()
        return self.response(201, key=key)

    def put(self, pk: int, key: str) -> Response:
        if not request.is_json:
            raise InvalidPayloadFormatError("Request is not JSON")
        item = self.edit_model_schema.load(request.json)
        result = UpdateKeyValueCommand(g.user, self.get_dao(), pk, key, item).run()
        if not result:
            return self.response_404()
        return self.response(200, message="Value updated successfully.",)

    def get(self, pk: int, key: str) -> Response:
        value = GetKeyValueCommand(g.user, self.get_dao(), pk, key).run()
        if not value:
            return self.response_404()
        return self.response(200, value=value)

    def delete(self, pk: int, key: str) -> Response:
        result = DeleteKeyValueCommand(g.user, self.get_dao(), pk, key).run()
        if not result:
            return self.response_404()
        return self.response(200, message="Deleted successfully")

    @abstractmethod
    def get_dao(self) -> Any:
        ...
