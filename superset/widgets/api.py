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
"""REST API for saved widgets."""

import logging
from typing import Any, Optional

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset import is_feature_enabled
from superset.commands.widget.create import CreateWidgetCommand
from superset.commands.widget.delete import DeleteWidgetCommand
from superset.commands.widget.exceptions import (
    WidgetCreateFailedError,
    WidgetDeleteFailedError,
    WidgetForbiddenError,
    WidgetInvalidError,
    WidgetNotFoundError,
    WidgetRevisionConflictError,
    WidgetUpdateFailedError,
)
from superset.commands.widget.update import UpdateWidgetCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.widget import WidgetDAO
from superset.extensions import event_logger
from superset.subjects.filters import FilterRelatedSubjects, subject_type_filter
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedUsers
from superset.widgets.filters import (
    WidgetAllTextFilter,
    WidgetEditableFilter,
    WidgetFilter,
)
from superset.widgets.models import Widget
from superset.widgets.schemas import (
    openapi_spec_methods_override,
    WidgetPostSchema,
    WidgetPutSchema,
)

logger = logging.getLogger(__name__)


def _parse_if_match(value: Optional[str]) -> Optional[int]:
    """
    Parse an ``If-Match`` header carrying a widget revision.

    Accepts the strong (``"3"``), weak (``W/"3"``) and bare (``3``) forms.

    :raises ValueError: If the header is present but not a revision
    """
    if value is None:
        return None
    tag = value.strip()
    if tag.startswith("W/"):
        tag = tag[2:]
    return int(tag.strip('"'))


class WidgetRestApi(BaseSupersetModelRestApi):
    """REST API for saved, permissioned widgets."""

    datamodel = SQLAInterface(Widget)
    resource_name = "widget"
    allow_browser_login = True

    class_permission_name = "Widget"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    include_route_methods = {
        RouteMethod.GET,
        RouteMethod.GET_LIST,
        RouteMethod.POST,
        RouteMethod.PUT,
        RouteMethod.DELETE,
        RouteMethod.INFO,
        RouteMethod.RELATED,
    }

    show_columns = [
        "id",
        "uuid",
        "widget_type",
        "schema_version",
        "name",
        "description",
        "props",
        "revision",
        "created_on",
        "created_on_delta_humanized",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "changed_on",
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.id",
        "changed_by.last_name",
        "editors.id",
        "editors.label",
        "editors.type",
        "viewers.id",
        "viewers.label",
        "viewers.type",
    ]
    list_columns = show_columns
    list_select_columns = list_columns + ["created_by_fk", "changed_by_fk"]
    order_columns = ["name", "widget_type", "changed_on", "created_on"]
    search_columns = ["id", "name", "widget_type", "created_by", "editors"]
    search_filters = {
        "id": [WidgetEditableFilter],
        "name": [WidgetAllTextFilter],
    }
    base_filters = [["id", WidgetFilter, lambda: []]]
    base_order = ("changed_on", "desc")

    add_model_schema = WidgetPostSchema()
    edit_model_schema = WidgetPutSchema()

    allowed_rel_fields = {"created_by", "changed_by", "editors", "viewers"}
    order_rel_fields = {"editors": ("label", "asc"), "viewers": ("label", "asc")}
    text_field_rel_fields = {"editors": "label", "viewers": "label"}
    extra_fields_rel_fields = {
        "editors": ["type", "active", "secondary_label", "img"],
        "viewers": ["type", "active", "secondary_label", "img"],
    }
    related_field_filters = {
        "created_by": RelatedFieldFilter("first_name", FilterRelatedUsers),
        "changed_by": RelatedFieldFilter("first_name", FilterRelatedUsers),
        "editors": RelatedFieldFilter("label", FilterRelatedSubjects),
        "viewers": RelatedFieldFilter("label", FilterRelatedSubjects),
    }
    base_related_field_filters = {
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "editors": [
            ["type", subject_type_filter("SUBJECTS_RELATED_TYPES_WIDGETS"), lambda: []]
        ],
        "viewers": [
            ["type", subject_type_filter("SUBJECTS_RELATED_TYPES_WIDGETS"), lambda: []]
        ],
    }

    openapi_spec_tag = "Widgets"
    openapi_spec_methods = openapi_spec_methods_override

    @before_request
    def ensure_canvas_enabled(self) -> Optional[Response]:
        if not is_feature_enabled("CANVAS"):
            return self.response_404()
        return None

    def _widget_response(self, status: int, widget: Widget) -> Response:
        """Serialize a widget and expose its revision as the ``ETag``."""
        response = self.response(status, result=self.show_model_schema.dump(widget))
        response.headers["ETag"] = f'"{widget.revision}"'
        return response

    @expose("/<widget_uuid>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, widget_uuid: str, **kwargs: Any) -> Response:
        """Get a widget.
        ---
        get:
          summary: Get a widget
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: widget_uuid
          responses:
            200:
              description: Widget detail, with its revision as the ETag
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        widget = WidgetDAO.find_by_id(widget_uuid, id_column="uuid")
        if not widget:
            return self.response_404()
        return self._widget_response(200, widget)

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Create a widget.
        ---
        post:
          summary: Create a widget
          requestBody:
            description: Widget schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Widget created, with its revision as the ETag
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            item = self.add_model_schema.load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            widget = CreateWidgetCommand(item).run()
        except WidgetInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except WidgetCreateFailedError as ex:
            logger.error("Error creating widget: %s", str(ex), exc_info=True)
            return self.response_422(message=str(ex))
        return self._widget_response(201, widget)

    @expose("/<widget_uuid>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, widget_uuid: str) -> Response:
        """Update a widget.
        ---
        put:
          summary: Update a widget
          description: >-
            Send the revision the change is based on in the If-Match header; a
            stale revision is rejected with 409 and the current revision.
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: widget_uuid
          - in: header
            schema:
              type: string
            name: If-Match
          requestBody:
            description: Widget schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Widget updated, with its new revision as the ETag
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: The widget was changed since the given revision
            422:
              $ref: '#/components/responses/422'
        """
        try:
            expected_revision = _parse_if_match(request.headers.get("If-Match"))
        except ValueError:
            return self.response_400(message="If-Match must carry a widget revision.")
        try:
            item = self.edit_model_schema.load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            widget = UpdateWidgetCommand(widget_uuid, item, expected_revision).run()
        except WidgetNotFoundError:
            return self.response_404()
        except WidgetForbiddenError:
            return self.response_403()
        except WidgetRevisionConflictError as ex:
            return self.response(409, message=ex.message, revision=ex.current_revision)
        except WidgetInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except WidgetUpdateFailedError as ex:
            logger.error("Error updating widget: %s", str(ex), exc_info=True)
            return self.response_422(message=str(ex))
        return self._widget_response(200, widget)

    @expose("/<widget_uuid>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, widget_uuid: str) -> Response:
        """Delete a widget.
        ---
        delete:
          summary: Delete a widget
          parameters:
          - in: path
            schema:
              type: string
              format: uuid
            name: widget_uuid
          responses:
            200:
              description: Widget deleted
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        try:
            DeleteWidgetCommand(widget_uuid).run()
        except WidgetNotFoundError:
            return self.response_404()
        except WidgetForbiddenError:
            return self.response_403()
        except WidgetDeleteFailedError as ex:
            logger.error("Error deleting widget: %s", str(ex), exc_info=True)
            return self.response_422(message=str(ex))
        return self.response(200, message="OK")
