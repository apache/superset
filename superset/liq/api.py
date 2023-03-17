from flask import redirect, request, Response
from flask_appbuilder.api import expose, protect, BaseApi
from werkzeug.wrappers import Response as WerkzeugResponse
# from flask import current_app, g
from marshmallow import Schema, EXCLUDE, fields, ValidationError

from superset.views.base_api import BaseSupersetApi

global_state = {}

class PermissiveSchema(Schema):
    """
    A marshmallow schema that ignores unexpected fields, instead of throwing an error.
    """

    class Meta:  # pylint: disable=too-few-public-methods
        unknown = EXCLUDE

class SetRadiusSchema(PermissiveSchema):
    radius_key = fields.String(required=True)
    sa1s = fields.List(fields.String(), required=True)

class GetSA1Schema(PermissiveSchema):
    radius_key = fields.String(required=True)

set_radius_schema = SetRadiusSchema()
get_sa1_schema = GetSA1Schema()

class LiqRestApi(BaseSupersetApi):

    resource_name = 'liq'
    csrf_exempt = True

    @expose('/set_radius/', methods=['POST'])
    def set_radius(self) -> Response:
        """Response
        Updates global state for a radius key with its constituent SA1s
        ---
        post:
          description: >-
            Updates radius key with constituent SA1s
          requestBody:
            description: Parameters
            required: true
            content:
              application/json:
                schema: SetRadiusSchema
          responses:
            200:
              description: Successfully updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
        """
        global global_state
        try:
            body = set_radius_schema.load(request.json)
            global_state[body['radius_key']] = body['sa1s']
            return self.response(200, message="OK")
        except ValidationError as error:
            return self.response_400(message=error.messages)
        
    @expose('/get_sa1s/', methods=['GET'])
    def get_sa1s(self) -> Response:
        """Response
        Looks up global state for a constituent SA1s of a radius key
        ---
        post:
          description: >-
            List of constituent SA1s of a radius
          requestBody:
            description: Parameters
            required: true
            content:
              application/json:
                schema: GetSA1Schema
          responses:
            200:
              description: Constituent SA1s
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          sa1s:
                            type: array
                            items:
                              type: string

        """
        global global_state
        try:
            body = get_sa1_schema.load(request.json)
            ret = {'sa1s': global_state[body['radius_key']]}
            return self.response(200, result=ret)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        except KeyError:
            return self.response_404()