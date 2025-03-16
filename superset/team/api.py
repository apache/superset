# DODO added #32839641

import logging

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset.commands.team.create import CreateTeamCommand
from superset.commands.team.exceptions import TeamCreateFailedError, TeamInvalidError
from superset.commands.team.update import UpdateTeamCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.team import TeamDAO
from superset.daos.user import UserDAO
from superset.extensions import (
    security_manager,
)
from superset.models.team import Team
from superset.team.filters import (
    TeamExternalFilter,
    TeamIDFilter,
    TeamNameFilter,
    TeamSlugFilter,
)
from superset.team.schemas import (
    AddUserSchema,
    TeamGetResponseSchema,
    TeamGetSchema,
    TeamPostSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    statsd_metrics,
)

logger = logging.getLogger(__name__)


class TeamRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Team)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        "add_user",
        "remove_user",
    }
    resource_name = "team"
    allow_browser_login = True

    class_permission_name = "Team"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    search_columns = ("id", "slug", "is_external", "name")

    search_filters = {
        "name": [TeamNameFilter],
        "is_external": [TeamExternalFilter],
        "id": [TeamIDFilter],
        "slug": [TeamSlugFilter],
    }

    list_columns = [
        "id",
        "name",
        "is_external",
        "slug",
        "roles.id",
        "roles.name",
        "participants.first_name",
        "participants.last_name",
        "participants.id",
    ]

    get_model_schema = TeamGetSchema()
    team_get_response_schema = TeamGetResponseSchema()
    add_model_schema = TeamPostSchema()
    add_user_schema = AddUserSchema()

    @expose("/<pk>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    # pylint: disable=arguments-differ
    def get(self, pk: int) -> Response:
        """Get a Team by id
        ---
        get:
          description: >-
            Get a Team by id.
          parameters:
            - in: path
              schema:
                type: integer
              name: pk
              description: The team id
          responses:
            200:
              description: Team information
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            team = TeamDAO().find_by_id(pk)
            return self.response(201, result=self.get_model_schema.dump(team))
        except TeamInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except TeamCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def post(self) -> Response:
        """Create a new Team
        ---
        post:
          description: >-
            Create a new Team.
          requestBody:
            description: Team schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Team added
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
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            logger.warning("validate data failed to add new Team")
            return self.response_400(message=error.messages)
        try:
            CreateTeamCommand(item).run()
            return self.response(201, result={"status": "cool"})
        except TeamInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except TeamCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/add_user", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def add_user(self) -> Response:
        """Add a user to a Team
        ---
        post:
          description: >-
            Add a user to an existing Team.
          requestBody:
            description: Team and user information
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    team_id:
                      type: integer
                    user_id:
                      type: integer
          responses:
            201:
              description: User added to team
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_user_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            logger.warning("validate data failed to add new Team")
            return self.response_400(message=error.messages)
        try:
            team_id = item.get("team_id")
            user = security_manager.get_user_by_id(item.get("user_id"))
            changed_model = UpdateTeamCommand(
                team_id, {"participants": [user]}, "add_user"
            ).run()
            current_roles = user.roles
            team_roles = changed_model.roles
            changed_roles = list(set(current_roles) | set(team_roles))
            UserDAO.update_user_roles(user, changed_roles)
            return self.response(201, result={"status": "successful"})
        except TeamInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except TeamCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/remove_user", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def remove_user(self) -> Response:
        """Remove a user from a Team
        ---
        post:
          description: >-
            Remove a user from an existing Team.
          requestBody:
            description: Team and user information
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    team_id:
                      type: integer
                    user_id:
                      type: integer
          responses:
            201:
              description: User removed from team
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      status:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_user_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            logger.warning("validate data failed to add new Team")
            return self.response_400(message=error.messages)
        try:
            team_id = item.get("team_id")
            user = security_manager.get_user_by_id(item.get("user_id"))
            changed_model = UpdateTeamCommand(
                team_id, {"participants": [user]}, "remove_user"
            ).run()
            current_roles = user.roles
            team_roles = changed_model.roles
            changed_roles = [role for role in current_roles if role not in team_roles]
            UserDAO.update_user_roles(user, changed_roles)
            return self.response(201, result={"status": "successful"})
        except TeamInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except TeamCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
