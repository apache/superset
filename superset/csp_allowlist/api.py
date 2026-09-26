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
from typing import Any

from flask import request, Response
from flask_appbuilder.api import expose, protect, rison as parse_rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.csp_allowlist.schemas import (
    CSPAllowlistEntryPostSchema,
    CSPAllowlistEntryPutSchema,
    get_delete_ids_schema,
    openapi_spec_methods_override,
)
from superset.daos.csp import CSPAllowlistDAO
from superset.extensions import db, event_logger
from superset.models.csp import CSPAllowlistEntry
from superset.security.csp import invalidate_csp_allowlist_cache
from superset.utils.decorators import transaction
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners

logger = logging.getLogger(__name__)


class CSPAllowlistRestApi(BaseSupersetModelRestApi):
    """CRUD API for runtime Content Security Policy allowlist entries.

    The ``CSPAllowlist`` view-menu is registered as admin-only (see
    ``SupersetSecurityManager.ADMIN_ONLY_VIEW_MENUS``), so only Admins (or a
    custom role explicitly granted ``can_write on CSPAllowlist``) may mutate the
    allowlist. Mutations invalidate the per-worker CSP cache so the new policy
    takes effect without a server restart.
    """

    datamodel = SQLAInterface(CSPAllowlistEntry)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
    }
    class_permission_name = "CSPAllowlist"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    resource_name = "csp_allowlist"
    allow_browser_login = True

    show_columns = [
        "id",
        "domain",
        "directive",
        "description",
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.id",
        "changed_by.last_name",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
    ]
    list_columns = [
        "id",
        "domain",
        "directive",
        "description",
        "created_on",
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.id",
        "changed_by.last_name",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
    ]
    add_columns = ["domain", "directive", "description"]
    edit_columns = add_columns
    order_columns = ["domain", "directive", "changed_on", "created_on"]

    add_model_schema = CSPAllowlistEntryPostSchema()
    edit_model_schema = CSPAllowlistEntryPutSchema()

    allowed_rel_fields = {"created_by", "changed_by"}

    apispec_parameter_schemas = {
        "get_delete_ids_schema": get_delete_ids_schema,
    }
    openapi_spec_tag = "CSP Allowlist"
    openapi_spec_methods = openapi_spec_methods_override

    related_field_filters = {
        "changed_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }
    base_related_field_filters = {
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }

    def post_add(self, item: CSPAllowlistEntry) -> None:
        invalidate_csp_allowlist_cache()

    def post_update(self, item: CSPAllowlistEntry) -> None:
        invalidate_csp_allowlist_cache()

    def post_delete(self, item: CSPAllowlistEntry) -> None:
        invalidate_csp_allowlist_cache()

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    def post(self) -> Response:
        """Create a CSP allowlist entry.
        ---
        post:
          summary: Create a CSP allowlist entry
          requestBody:
            description: CSP allowlist entry schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/CSPAllowlistRestApi.post'
          responses:
            201:
              description: CSP allowlist entry created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/CSPAllowlistRestApi.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        entry = CSPAllowlistEntry(**item)
        self.pre_add(entry)
        entry = self._save_entry(entry)
        self.post_add(entry)
        return self.response(
            201,
            id=entry.id,
            result=self.add_model_schema.dump(entry, many=False),
        )

    @transaction()
    def _save_entry(self, entry: CSPAllowlistEntry) -> CSPAllowlistEntry:
        db.session.add(entry)
        db.session.flush()
        return entry

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    def put(self, pk: int) -> Response:
        """Update a CSP allowlist entry.
        ---
        put:
          summary: Update a CSP allowlist entry
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: CSP allowlist entry schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/CSPAllowlistRestApi.put'
          responses:
            200:
              description: CSP allowlist entry updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/CSPAllowlistRestApi.put'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        entry = self.datamodel.get(pk, self._base_filters)
        if not entry:
            return self.response_404()
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.edit_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        for key, value in item.items():
            setattr(entry, key, value)
        self.pre_update(entry)
        entry = self._save_entry(entry)
        self.post_update(entry)
        return self.response(
            200,
            id=entry.id,
            result=self.edit_model_schema.dump(entry, many=False),
        )

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    @parse_rison(get_delete_ids_schema)
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete CSP allowlist entries.
        ---
        delete:
          summary: Bulk delete CSP allowlist entries
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: CSP allowlist entries bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        entries = CSPAllowlistDAO.find_by_ids(item_ids)
        if not entries:
            return self.response_404()
        CSPAllowlistDAO.delete(entries)
        invalidate_csp_allowlist_cache()
        return self.response(
            200,
            message=ngettext(
                "Deleted %(num)d CSP allowlist entry",
                "Deleted %(num)d CSP allowlist entries",
                num=len(entries),
            ),
        )
