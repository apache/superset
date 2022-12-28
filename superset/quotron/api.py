import datetime
import json
import logging

import requests
import sqlparse
from flask import g, request, Response
from flask_appbuilder.api import BaseApi, expose
from sql_metadata import Parser

from superset.charts.commands.create import CreateChartCommand
from superset.charts.schemas import ChartPostSchema
from superset.common.query_context_factory import QueryContextFactory
from superset.common.query_object import QueryObject
from superset.datasets.dao import DatasetDAO
from superset.extensions import event_logger, cache_manager
from superset.quotron.DataTypes import Autocomplete, QuotronChart, Params
from superset.quotron.schemas import AutoCompleteSchema, QuestionSchema
from superset.superset_typing import AdhocMetric, AdhocColumn
from superset.utils.core import DatasourceDict, AdhocFilterClause, \
    QueryObjectFilterClause

logger = logging.getLogger(__name__)


def get_where_clause(sql):
    parsed_sql = sqlparse.parse(sql)
    for item in parsed_sql[0].tokens:
        if isinstance(item, sqlparse.sql.Where):
            clause = item.value
            stripped_clause = clause.replace('where', '')
            logger.debug(f'stripped clause: {stripped_clause}')
            return stripped_clause



class QuotronRestApi(BaseApi):
    include_route_methods = {
        "auto_complete", "answer"
    }
    resource_name = "quotron"
    openapi_spec_tag = "Quotron"
    openapi_spec_component_schemas = (AutoCompleteSchema, QuestionSchema)

    @cache_manager.cache.memoize(timeout=60)
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
        resp =requests.get(f'https://nlp.quotron.ai/ask/{question}')

        #2. Parse quotron query
        sql = resp.json()['query']
        where_clause = get_where_clause(sql)
        columns = Parser(sql).columns
        table = Parser(sql).tables[0]
        logger.info(columns)
        logger.info(table)
        add_model_schema = ChartPostSchema()
        add_model_schema.slice_name = question
        add_model_schema.viz_type = 'dist_bar'
        table = get_table_from_name(table)
        superset_columns = []
        for column in columns:
            superset_columns.append(get_column_from_name(column))

        superset_metrics = []
        for superset_column in superset_columns:
            superset_metrics.append(AdhocMetric(aggregate='AVG', column=superset_column, expressionType='SIMPLE'))

        series_limit_metric = AdhocMetric(aggregate='AVG', column=get_column_from_name('calendar_Year'),expressionType='SIMPLE' )

        datasource = DatasourceDict(type="table",id="24")
        extras = {
			"having": "",
			"where": where_clause
		}

        queryObject = QueryObject(datasource=datasource,columns = superset_columns,
                                  metrics = superset_metrics, series_limit_metric = series_limit_metric, row_limit = 10000, extras=extras)

        qc = QueryContextFactory().create(
            datasource=datasource,
            queries=[],
            result_type='full',
            result_format='json'
        )
        qc.queries.append(queryObject)
        adhoc_filters = [{
		"expressionType": "SQL",
		"sqlExpression": where_clause,
		"clause": "WHERE",
	}]
        params = Params(datasource="24__table", viz_type="dist_bar",
                        time_range="No Filter",
                        metrics=superset_metrics,groupby=["calendar_Year"],
                        timeseries_limit_metric=series_limit_metric,
                        order_desc=False,
                        adhoc_filters=adhoc_filters)
        quotronChart = QuotronChart(slice_name=question, viz_type="dist_bar",datasource_id=24, datasource_type="table",
                                    query_context=json.dumps(qc.__dict__, default=lambda o: '<not serializable>'),
                                    params =json.dumps(params.__dict__, default=lambda o: '<not serializable>'))
        result = add_model_schema.dump(quotronChart)
        new_model = CreateChartCommand(result).run()
        logger.info(new_model)
        # logger.info(response)
        return self.response(200, result = 'ABC')



def get_table_from_name(table_name):
    table = DatasetDAO.find_table_by_name(table_name)
    return table

def get_column_from_name(column_name):
    column = DatasetDAO.find_column_by_name(column_name)
    return AdhocColumn(columnType=column.type, id=column.id, column_name = column.column_name, groupby = True)
