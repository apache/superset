from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from apispec.ext.marshmallow.common import resolve_schema_cls
from flask import current_app, request
from flask_appbuilder.api import BaseApi
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.basemanager import BaseManager
from flask_appbuilder.baseviews import BaseView
from flask_appbuilder.security.decorators import has_access


def resolver(schema):
    schema_cls = resolve_schema_cls(schema)
    name = schema_cls.__name__
    if name == "MetaSchema":
        if hasattr(schema_cls, "Meta"):
            return (
                f"{schema_cls.Meta.parent_schema_name}.{schema_cls.Meta.model.__name__}"
            )
    if name.endswith("Schema"):
        return name[:-6] or name
    return name


class SupersetOpenApi(BaseApi):
    route_base = "/api"
    allow_browser_login = True

    @expose("/<version>/_openapi")
    @protect()
    @safe
    def get(self, version):
        """Endpoint that renders an OpenApi spec for all views that belong
            to a certain version
        ---
        get:
          description: >-
            Get the OpenAPI spec for a specific API version
          parameters:
          - in: path
            schema:
              type: string
            name: version
          responses:
            200:
              description: The OpenAPI spec
              content:
                application/json:
                  schema:
                    type: object
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        version_found = False
        api_spec = self._create_api_spec(version)
        for base_api in current_app.appbuilder.baseviews:
            if isinstance(base_api, BaseApi) and base_api.version == version:
                base_api.add_api_spec(api_spec)
                version_found = True
        if version_found:
            return self.response(200, **api_spec.to_dict())
        else:
            return self.response_404()

    @staticmethod
    def _create_api_spec(version):
        servers = current_app.config.get(
            "FAB_OPENAPI_SERVERS", [{"url": request.host_url.rstrip("/")+current_app.config.get("APPLICATION_ROOT","/")}]
        )
        return APISpec(
            title=current_app.appbuilder.app_name,
            version=version,
            openapi_version="3.0.2",
            info=dict(description=current_app.appbuilder.app_name),
            plugins=[MarshmallowPlugin(schema_name_resolver=resolver)],
            servers=servers,
        )

class SupsersetSwaggerView(BaseView):
    route_base = "/swagger"
    default_view = "show"
    openapi_uri = "/api/{}/_openapi"

    @expose("/<version>")
    @has_access
    def show(self, version):
        app_root = current_app.config.get("APPLICATION_ROOT","")+self.openapi_uri
        return self.render_template(
            current_app.config.get(
                "FAB_API_SWAGGER_TEMPLATE", "appbuilder/swagger/swagger.html"
            ),
            openapi_uri=app_root.format(version),
        )

