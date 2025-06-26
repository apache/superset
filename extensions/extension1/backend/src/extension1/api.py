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
