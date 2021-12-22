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
from abc import ABC, abstractmethod
from typing import Any

from apispec import APISpec
from flask import g, request, Response
from flask_appbuilder.api import BaseApi
from marshmallow import ValidationError

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.dashboards.commands.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.exceptions import InvalidPayloadFormatError
from superset.key_value.commands.exceptions import KeyValueAccessDeniedError
from superset.key_value.schemas import KeyValuePostSchema, KeyValuePutSchema

logger = logging.getLogger(__name__)


class KeyValueRestApi(BaseApi, ABC):
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

    def add_apispec_components(self, api_spec: APISpec) -> None:
        api_spec.components.schema(
            KeyValuePostSchema.__name__, schema=KeyValuePostSchema,
        )
        api_spec.components.schema(
            KeyValuePutSchema.__name__, schema=KeyValuePutSchema,
        )
        super().add_apispec_components(api_spec)

    def post(self, pk: int) -> Response:
        if not request.is_json:
            raise InvalidPayloadFormatError("Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
            key = self.get_create_command()(g.user, pk, item["value"]).run()
            return self.response(201, key=key)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        except (DashboardAccessDeniedError, KeyValueAccessDeniedError):
            return self.response_403()
        except DashboardNotFoundError:
            return self.response_404()

    def put(self, pk: int, key: str) -> Response:
        if not request.is_json:
            raise InvalidPayloadFormatError("Request is not JSON")
        try:
            item = self.edit_model_schema.load(request.json)
            result = self.get_update_command()(g.user, pk, key, item["value"]).run()
            if not result:
                return self.response_404()
            return self.response(200, message="Value updated successfully.")
        except ValidationError as error:
            return self.response_400(message=error.messages)
        except (DashboardAccessDeniedError, KeyValueAccessDeniedError):
            return self.response_403()
        except DashboardNotFoundError:
            return self.response_404()

    def get(self, pk: int, key: str) -> Response:
        try:
            value = self.get_get_command()(g.user, pk, key).run()
            if not value:
                return self.response_404()
            return self.response(200, value=value)
        except (DashboardAccessDeniedError, KeyValueAccessDeniedError):
            return self.response_403()
        except DashboardNotFoundError:
            return self.response_404()

    def delete(self, pk: int, key: str) -> Response:
        try:
            result = self.get_delete_command()(g.user, pk, key).run()
            if not result:
                return self.response_404()
            return self.response(200, message="Deleted successfully")
        except (DashboardAccessDeniedError, KeyValueAccessDeniedError):
            return self.response_403()
        except DashboardNotFoundError:
            return self.response_404()

    @abstractmethod
    def get_create_command(self) -> Any:
        ...

    @abstractmethod
    def get_update_command(self) -> Any:
        ...

    @abstractmethod
    def get_get_command(self) -> Any:
        ...

    @abstractmethod
    def get_delete_command(self) -> Any:
        ...
