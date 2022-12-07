import logging

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.filters import FilterStartsWith
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset import app
from superset.connectors.sqla.models import RowLevelSecurityFilter
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.dao.exceptions import DAOCreateFailedError
from superset.row_level_security.commands.create import CreateRLSRuleCommand
from superset.row_level_security.schemas import RLSPostSchema, RLSPutSchema
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    requires_form_data,
    requires_json,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class RLSRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(RowLevelSecurityFilter)
    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {RouteMethod.RELATED}
    resource_name = "rowlevelsecurity"
    class_permission_name = "Row Level Security"
    openapi_spec_tag = "Row Level Security"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True

    list_columns = [
        "id",
        "name",
        "filter_type",
        "tables",
        "roles",
        "clause",
        "creator",
        "changed_on_delta_humanized",
        "group_key",
    ]
    order_columns = ["name", "filter_type", "clause", "modified"]
    add_columns = [
        "name",
        "description",
        "filter_type",
        "tables",
        "roles",
        "group_key",
        "clause",
    ]
    show_columns = [
        "name",
        "description",
        "filter_type",
        "tables.id",
        "tables.table_name",
        "roles.id",
        "roles.name",
        "group_key",
        "clause",
    ]
    search_columns = (
        "name",
        "description",
        "filter_type",
        "tables",
        "roles",
        "group_key",
        "clause",
    )
    edit_columns = add_columns

    add_model_schema = RLSPostSchema()
    edit_model_schema = RLSPutSchema()

    allowed_rel_fields = {"tables", "roles"}

    if custom_filters := app.config["RLS_FILTER_RELATED_FIELDS"]:
        filter_rel_fields = custom_filters

    @expose("/", methods=["POST"])
    @protect()
    @safe
    @statsd_metrics
    @requires_json
    def post(self) -> Response:
        """Creates a new RLS rule
        ---
        post:
          description: >-
            Create a new RLS Rule
          requestBody:
            description: RLS schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Report schedule added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
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
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)

        try:
            new_model = CreateRLSRuleCommand(item).run()
            return self.response(201, id=new_model.id, result=item)
        except DAOCreateFailedError as ex:
            logger.error(
                "Error creating RLS rule %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
