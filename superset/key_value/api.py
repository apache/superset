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

from flask import g, request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.extensions import event_logger
from superset.key_value.commands.create import CreateKeyValueCommand
from superset.key_value.commands.delete import DeleteKeyValueCommand
from superset.key_value.commands.exceptions import (
    KeyValueCreateFailedError,
    KeyValueDeleteFailedError,
    KeyValueGetFailedError,
    KeyValueUpdateFailedError,
)
from superset.key_value.commands.get import GetKeyValueCommand
from superset.key_value.commands.update import UpdateKeyValueCommand
from superset.key_value.dao import KeyValueDAO
from superset.key_value.schemas import KeyValueSchema
from superset.models.key_value import KeyValue
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class KeyValueRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(KeyValue)
    schema = KeyValueSchema()
    class_permission_name = "KeyValue"
    resource_name = "key_value_store"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    include_route_methods = {
        RouteMethod.POST,
        RouteMethod.PUT,
        RouteMethod.GET,
        RouteMethod.DELETE,
    }
    allow_browser_login = True

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        # TODO Add docs
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.schema.load(request.json)
            key = CreateKeyValueCommand(g.user, item).run()
            return self.response(201, key=key)
        except KeyValueCreateFailedError as ex:
            logger.error(
                "Error creating value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    # TODO: If we decide to generate the key on the client-side, we should
    # delete the POST endpoint and only support PUT. We also don't need a key parameter.
    @expose("/<string:key>/", methods=["PUT"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}",
        log_to_statsd=False,
    )
    def put(self, key: str) -> Response:
        # TODO Add docs
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.schema.load(request.json)
            model = UpdateKeyValueCommand(g.user, item).run()
            if not model:
                return self.response_404()
            result = self.schema.dump(model)
            return self.response(200, result=result)
        except KeyValueGetFailedError as ex:
            logger.error(
                "Error updating the value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<string:key>/", methods=["GET"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}",
        log_to_statsd=False,
    )
    def get(self, key: str) -> Response:
        # TODO Add docs
        try:
            model = GetKeyValueCommand(g.user, key).run()
            if not model:
                return self.response_404()
            result = self.schema.dump(model)
            return self.response(200, result=result)
        except KeyValueGetFailedError as ex:
            logger.error(
                "Error accessing the value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<string:key>/", methods=["DELETE"])
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}",
        log_to_statsd=False,
    )
    def delete(self, key: str) -> Response:
        # TODO Add docs
        try:
            model = DeleteKeyValueCommand(g.user, key).run()
            if not model:
                return self.response_404()
            return self.response(200, message="Deleted successfully")
        except KeyValueDeleteFailedError as ex:
            logger.error(
                "Error deleting the value %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
