# DODO added #32839641
import datetime
import logging

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset.commands.onboarding.exceptions import (
    OnboardingAccessDeniedError,
    OnboardingForbiddenError,
    OnboardingInvalidError,
    OnboardingNotFoundError,
    OnboardingUpdateFailedError,
)
from superset.commands.onboarding.update import UpdateOnboardingCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.user_info import UserInfoDAO
from superset.models.user_info import UserInfo
from superset.onboarding.schemas import (
    OnboardingGetResponseSchema,
    OnboardingPutSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class OnboardingRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(UserInfo)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET
    resource_name = "onboarding"
    allow_browser_login = True

    class_permission_name = "Onboarding"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    list_columns = [
        "id",
        "is_onboarding_finished",
        "onboarding_started_time",
        "language",
        "user_id",
        "dodo_role",
    ]

    edit_model_schema = OnboardingPutSchema()
    onboarding_get_response_schema = OnboardingGetResponseSchema()

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    # pylint: disable=arguments-differ
    def get(self) -> Response:
        """Get user onboarding information
        ---
        get:
          description: >-
            Get onboarding information for the current user
          responses:
            200:
              description: Onboarding information
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/OnboardingGetResponseSchema'
                      email:
                        type: string
                      last_name:
                        type: string
                      first_name:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        try:
            user_id = g.user.id
            user_info = UserInfoDAO.get_by_user_id(user_id)
        except OnboardingAccessDeniedError:
            return self.response_403()
        except OnboardingNotFoundError:
            return self.response_404()
        result = self.onboarding_get_response_schema.dump(user_info)
        result = {
            **result,
            "email": g.user.email,
            "last_name": g.user.last_name,
            "first_name": g.user.first_name,
        }
        return self.response(200, result=result)

    @expose("/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    # pylint: disable=arguments-differ
    def put(self) -> Response:
        """Update user onboarding information
        ---
        put:
          description: >-
            Update onboarding information for the current user
          requestBody:
            description: Onboarding information
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Onboarding information updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
                      onboarding_started_time:
                        type: string
                        format: date-time
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            user_id = g.user.id
            id_model = UserInfoDAO.get_by_user_id(user_id).id
            onboarding_started_time = datetime.datetime.utcnow().isoformat()
            item["onboarding_started_time"] = onboarding_started_time
            UpdateOnboardingCommand(id_model, item).run()
            response = self.response(200, result=item)
        except OnboardingNotFoundError:
            response = self.response_404()
        except OnboardingForbiddenError:
            response = self.response_403()
        except OnboardingInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except OnboardingUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            response = self.response_422(message=str(ex))
        return response
