# DODO added #32839641

import datetime
import logging

from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset.commands.statement.create import CreateStatementCommand
from superset.commands.statement.exceptions import (
    StatementAccessDeniedError,
    StatementCreateFailedError,
    StatementForbiddenError,
    StatementInvalidError,
    StatementNotFoundError,
    StatementUpdateFailedError,
)
from superset.commands.statement.update import UpdateStatementCommand
from superset.commands.team.update import UpdateTeamCommand
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.statement import StatementDAO
from superset.daos.team import TeamDAO
from superset.daos.user import UserDAO
from superset.daos.user_info import UserInfoDAO
from superset.models.statement import Statement
from superset.statement.filters import (
    StatementIDFilter,
    StatementUserFirstNameFilter,
)
from superset.statement.schemas import (
    StatementGetResponseSchema,
    StatementGetSchema,
    StatementPostSchema,
    StatementPutSchema,
)
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    statsd_metrics,
)
from superset.views.filters import (
    BaseFilterRelatedUsers,
    BaseFilterRelatedUsersFirstName,
)

logger = logging.getLogger(__name__)


class StatementRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Statement)

    RouteMethod.REST_MODEL_VIEW_CRUD_SET.add(RouteMethod.RELATED)
    resource_name = "statement"
    allow_browser_login = True

    class_permission_name = "Statement"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP

    list_columns = [
        "id",
        "user.id",
        "user.first_name",
        "user.last_name",
        "user.email",
        "finished",
        "team",
        "is_new_team",
        "team_slug",
        "is_external",
        "created_datetime",
        "request_roles.name",
        "request_roles.id",
        "last_changed_datetime",
    ]

    search_columns = ("id", "user", "finished", "team")

    order_columns = [
        "id",
        "team",
        "user",
        "created_datetime",
        "finished",
    ]

    # base_filters = [
    #     ["id", StatementIDFilter],
    # ]

    list_select_columns = list_columns
    search_filters = {"user": [StatementUserFirstNameFilter], "id": [StatementIDFilter]}

    base_related_field_filters = {"user": [["id", BaseFilterRelatedUsers, lambda: []]]}

    related_field_filters = {
        "user": RelatedFieldFilter("first_name", BaseFilterRelatedUsersFirstName)
    }
    allowed_rel_fields = {"user"}
    get_model_schema = StatementGetSchema()
    edit_model_schema = StatementPutSchema()
    statement_get_response_schema = StatementGetResponseSchema()
    add_model_schema = StatementPostSchema()

    @expose("/<pk>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    # pylint: disable=arguments-differ
    def get(self, pk: int) -> Response:
        """Gets a Statement by ID
        ---
        get:
          description: >-
            Get a statement by ID
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The ID of the statement
          responses:
            200:
              description: Statement
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/StatementGetResponseSchema'
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
            statement = StatementDAO.get_by_id(pk)
            user = statement.user[0]
            dodo_role = UserInfoDAO.get_dodo_role(user.id)
        except StatementAccessDeniedError:
            return self.response_403()
        except StatementNotFoundError:
            return self.response_404()
        result = self.statement_get_response_schema.dump(statement)
        result["dodo_role"] = dodo_role
        return self.response(200, result=result)

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def post(self) -> Response:
        """Creates a new Statement
        ---
        post:
          description: >-
            Create a new Statement.
          requestBody:
            description: Statement schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Statement added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      is_onboarding_finished:
                        type: boolean
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
        # This validates custom Schema with custom validations
        except ValidationError as error:
            logger.warning("validate data failed to add new statement")
            return self.response_400(message=error.messages)
        try:
            user_id = g.user.id
            item["user"] = [user_id]
            item["finished"] = False
            item["created_datetime"] = datetime.datetime.utcnow().isoformat()
            CreateStatementCommand(item).run()
            finished_onboarding = UserInfoDAO.finish_onboarding()
            return self.response(
                201, result={"is_onboarding_finished": finished_onboarding}
            )
        except StatementInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except StatementCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put(self, pk: int) -> Response:  # pylint: disable=too-many-locals
        """Updates a Statement
        ---
        put:
          description: >-
            Updates an existing Statement. Can mark it as finished and update the team assignment.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The Statement ID
          requestBody:
            description: Statement update schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Statement updated successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                        description: The ID of the updated Statement
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
                        description: The updated Statement data
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
            change_fields_for_statement = {
                "finished": True,
                "last_changed_datetime": datetime.datetime.utcnow().isoformat(),
            }
            changed_statement = UpdateStatementCommand(
                pk, change_fields_for_statement
            ).run()
            if item.get("is_approved"):
                team_slug = item.get("team_slug")
                team_model = TeamDAO.find_team_by_slug(team_slug)
                team_id = team_model.id
                user = changed_statement.user[0]

                #  ищем в какой команде пользователь и удаляем его оттуда
                current_teams = user.teams
                if current_teams and len(current_teams) > 0:
                    for current_team in current_teams:
                        participants = [
                            participant
                            for participant in current_team.participants
                            if participant.id != user.id
                        ]
                        updated_participants = {"participants": participants}
                        UpdateTeamCommand(current_team.id, updated_participants).run()
                participants = team_model.participants
                if participants:
                    participants.append(user)
                else:
                    participants = [user]
                updated_participants = {"participants": participants}
                #  записываем пользователя в новую команду
                UpdateTeamCommand(team_id, updated_participants).run()
                request_roles = changed_statement.request_roles
                current_roles = user.roles
                roles = request_roles + current_roles
                UserDAO.update_user_roles(user, roles)
            response = self.response(
                200,
                id=changed_statement.id,
                result=self.statement_get_response_schema.dump(changed_statement),
            )
        except StatementNotFoundError:
            response = self.response_404()
        except StatementForbiddenError:
            response = self.response_403()
        except StatementInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except StatementUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            response = self.response_422(message=str(ex))
        return response
