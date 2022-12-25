import datetime

import requests
from flask import g, request, Response, jsonify
from flask_appbuilder.api import BaseApi, expose, protect, safe
import logging

from superset import charts
from superset.charts.api import ChartRestApi
from superset.charts.commands.exceptions import ChartNotFoundError
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.explore.commands.get import GetExploreCommand
from superset.explore.commands.parameters import CommandParameters
from superset.explore.exceptions import DatasetAccessDeniedError, WrongEndpointError
from superset.explore.permalink.exceptions import ExplorePermalinkGetFailedError
from superset.explore.schemas import ExploreContextSchema
from superset.extensions import event_logger
from superset.quotron.DataTypes import Autocomplete
from superset.quotron.schemas import AutoCompleteSchema, QuestionSchema
from superset.temporary_cache.commands.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheResourceNotFoundError,
)


logger = logging.getLogger(__name__)


class QuotronRestApi(BaseApi):
    include_route_methods = {
        "auto_complete", "answer"
    }
    resource_name = "quotron"
    openapi_spec_tag = "Quotron"
    openapi_spec_component_schemas = (AutoCompleteSchema, QuestionSchema)
    @expose("/auto_complete/", methods=["GET"])
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
    )
    def auto_complete(self) -> Response:
        """
                ---
                get:
                  description: Auto complete for questions
                  responses:
                    200:
                      description: Auto complete questions for currently logged in user
                      content:
                        application/json:
                            schema:
                                $ref: "#/components/schemas/AutoCompleteSchema"
                """
        logger.info(g.user)
        autocomplete = Autocomplete(email=g.user.email,question="what is the highest revenue?", time=datetime.datetime.now())
        schema = AutoCompleteSchema()
        result = schema.dump(autocomplete)
        return self.response(200, result = [result])


    @expose("/answer/", methods=["POST"])
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.data",
        log_to_statsd=False,
    )
    def answer(self) -> Response:
        """
        Takes a natural langauge question and generate a corresponding graph/ slice
        ---
        post:
          description: >-
            Takes a natural langauge question and generate a corresponding graph/ slice
          requestBody:
            description: >-
              Question context that has natural langauge question and metadata
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/QuestionSchema"
                example:
                    {
                    "question": "what is the highest revenue?"
                    }


          responses:
            200:
              description: Query result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/AnswerSchema"

            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        req = QuestionSchema().load(request.json)
        logger.info(g.user)
        question = req['question']

        #1. Get quotron SQL query
        # resp =requests.get(f'https://home.quotron.ai/ask/{question}')

        #2. Parse quotron query

        #3. Create a slice
        ChartRestApi.post()

        # logger.info(response)
        return self.response(200, result = 'ABC')



