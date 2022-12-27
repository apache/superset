import datetime
import json

import requests
from flask import g, request, Response, jsonify
from flask_appbuilder.api import BaseApi, expose, protect, safe
import logging

from superset import charts
from superset.charts.api import ChartRestApi
from superset.charts.commands.create import CreateChartCommand
from superset.charts.commands.exceptions import ChartNotFoundError
from superset.charts.schemas import ChartPostSchema
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context_factory import QueryContextFactory
from superset.common.query_object import QueryObject
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.datasets.api import DatasetRestApi
from superset.datasets.dao import DatasetDAO
from superset.explore.commands.get import GetExploreCommand
from superset.explore.commands.parameters import CommandParameters
from superset.explore.exceptions import DatasetAccessDeniedError, WrongEndpointError
from superset.explore.permalink.exceptions import ExplorePermalinkGetFailedError
from superset.explore.schemas import ExploreContextSchema
from superset.extensions import event_logger
from superset.quotron.DataTypes import Autocomplete, QuotronChart, Params
from superset.quotron.schemas import AutoCompleteSchema, QuestionSchema
from superset.superset_typing import Column, Metric, AdhocMetric, AdhocColumn
from superset.temporary_cache.commands.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheResourceNotFoundError,
)
from superset.utils.core import DatasourceDict

logger = logging.getLogger(__name__)


def get_table_from_name(table_name):
    table = DatasetDAO.find_table_by_name(table_name)
    return table

def get_column_from_name(column_name):
    column = DatasetDAO.find_column_by_name(column_name)

    return AdhocColumn(columnType=column.type, id=column.id, column_name = column.column_name, groupby = True)

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


        add_model_schema = ChartPostSchema()
        add_model_schema.slice_name = question
        add_model_schema.viz_type = 'dist_bar'
        table = get_table_from_name('financial_data')
        column1 = get_column_from_name('revenue')
        column2 = get_column_from_name('grossProfit')

        #3. Create a slice
        metric1  = AdhocMetric(aggregate='AVG', column=column1, expressionType='SIMPLE')
        metric2  = AdhocMetric(aggregate='AVG', column=column2,expressionType='SIMPLE' )
        series_limit_metric = AdhocMetric(aggregate='AVG', column=get_column_from_name('calendarYear'),expressionType='SIMPLE' )

        datasource = DatasourceDict(type="table",id="24")
        queryObject = QueryObject(datasource=datasource,columns = [column1, column2], metrics = [
            metric1,
            metric2], series_limit_metric = series_limit_metric, row_limit = 10000)

        qc = QueryContextFactory().create(
            datasource=datasource,
            queries=[],
            result_type='full',
            result_format='json'
        )
        qc.queries.append(queryObject)

        params = Params(datasource="24__table", viz_type="dist_bar",
                        time_range="No Filter",
                        metrics=[metric1, metric2],groupby=["calendarYear"],
                        timeseries_limit_metric=series_limit_metric,
                        order_desc=False)
        quotronChart = QuotronChart(slice_name=question, viz_type="dist_bar",datasource_id=24, datasource_type="table",
                                    query_context=json.dumps(qc.__dict__, default=lambda o: '<not serializable>'),
                                    params =json.dumps(params.__dict__, default=lambda o: '<not serializable>'))
        result = add_model_schema.dump(quotronChart)
        new_model = CreateChartCommand(result).run()
        logger.info(new_model)
        # logger.info(response)
        return self.response(200, result = 'ABC')



