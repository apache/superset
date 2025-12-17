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
"""
Data Access Rules REST API.

This module provides the REST API for managing Data Access Rules,
including CRUD operations and a group_keys discovery endpoint.
"""

import logging

from flask import Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.data_access_rules.models import DataAccessRule
from superset.data_access_rules.schemas import (
    DataAccessRuleListSchema,
    DataAccessRulePostSchema,
    DataAccessRulePutSchema,
    DataAccessRuleShowSchema,
)
from superset.data_access_rules.utils import get_all_group_keys
from superset.extensions import event_logger
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedRoles, BaseFilterRelatedUsers

logger = logging.getLogger(__name__)


class DataAccessRulesRestApi(BaseSupersetModelRestApi):
    """REST API for Data Access Rules."""

    datamodel = SQLAInterface(DataAccessRule)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.RELATED,
        "group_keys",
    }
    resource_name = "dar"
    class_permission_name = "DataAccessRule"
    openapi_spec_tag = "Data Access Rules"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True

    list_columns = [
        "id",
        "role_id",
        "role.id",
        "role.name",
        "rule",
        "changed_on_delta_humanized",
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_by.id",
    ]
    order_columns = [
        "id",
        "role_id",
        "changed_on_delta_humanized",
    ]
    add_columns = [
        "role_id",
        "rule",
    ]
    edit_columns = [
        "role_id",
        "rule",
    ]
    show_columns = [
        "id",
        "role_id",
        "role.name",
        "role.id",
        "rule",
        "created_on",
        "changed_on",
        "created_by.first_name",
        "created_by.last_name",
        "changed_by.first_name",
        "changed_by.last_name",
    ]
    search_columns = ["role", "changed_by"]

    allowed_rel_fields = {"role", "changed_by"}
    base_related_field_filters = {
        "role": [["id", BaseFilterRelatedRoles, lambda: []]],
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }

    add_model_schema = DataAccessRulePostSchema()
    edit_model_schema = DataAccessRulePutSchema()
    list_model_schema = DataAccessRuleListSchema()
    show_model_schema = DataAccessRuleShowSchema()

    openapi_spec_methods = {
        "get": {"get": {"summary": "Get a data access rule"}},
        "get_list": {"get": {"summary": "Get a list of data access rules"}},
        "post": {"post": {"summary": "Create a data access rule"}},
        "put": {"put": {"summary": "Update a data access rule"}},
        "delete": {"delete": {"summary": "Delete a data access rule"}},
    }

    @expose("/group_keys/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.group_keys",
        log_to_statsd=False,
    )
    def group_keys(self) -> Response:
        """
        Get all distinct group_keys used in RLS rules.

        This endpoint is useful for UI discoverability - showing users
        what group_keys already exist so they can reuse them.
        ---
        get:
          summary: Get all distinct RLS group keys
          description: >-
            Returns a list of all unique group_key values used in RLS rules
            across all Data Access Rules. This helps users discover existing
            keys for consistent rule grouping.
          responses:
            200:
              description: List of group keys
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/GroupKeysResponseSchema'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        group_keys = get_all_group_keys()
        return self.response(200, result=sorted(group_keys))
