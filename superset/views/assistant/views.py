# Sample Assiststant Page

from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView
from flask_appbuilder import expose
from flask_appbuilder.api import safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from superset.models.core import Database
from flask import current_app
from flask import request
import google.generativeai as genai
import logging
from superset.views.assistant.support import AssistantSupport
from superset.views.assistant.prompts import *


class AssistantView(BaseSupersetView):

    support = AssistantSupport()
    available_charts = {
        "pie": {
            "name": "Pie Chart",
            "credits": [
                "https://echarts.apache.org"
            ],
            "description": "The classic. Great for showing how much of a company each investor gets, what demographics follow your blog, or what portion of the budget goes to the military industrial complex.\n\n        Pie charts can be difficult to interpret precisely. If clarity of relative proportion is important, consider using a bar or other chart type instead.",
            "supportedAnnotationTypes": [],
            "behaviors": [
                "INTERACTIVE_CHART",
                "DRILL_TO_DETAIL",
                "DRILL_BY"
            ],
            "datasourceCount": 1,
            "enableNoResults": True,
            "tags": [
                "Categorical",
                "Circular",
                "Comparison",
                "Percentages",
                "Featured",
                "Proportional",
                "ECharts",
                "Nightingale"
            ],
            "category": "Part of a Whole",
            "additionalConsiderations": [
                "Consider using a bar chart instead if clarity of relative proportion is important."
                "Do not use Distict on columns that will be grouped by."
            ]
        },
        # "world_map": {
        #     "name": "World Map",
        #     "credits": [
        #         "http://datamaps.github.io/"
        #     ],
        #     "description": "A map of the world, that can indicate values in different countries. Can only be used with data that contains country names or codes.",
        #     "supportedAnnotationTypes": [],
        #     "behaviors": [
        #         "INTERACTIVE_CHART",
        #         "DRILL_TO_DETAIL",
        #         "DRILL_BY"
        #     ],
        #     "datasourceCount": 1,
        #     "enableNoResults": True,
        #     "tags": [
        #         "2D",
        #         "Comparison",
        #         "Intensity",
        #         "Legacy",
        #         "Multi-Dimensions",
        #         "Multi-Layers",
        #         "Multi-Variables",
        #         "Scatter",
        #         "Featured"
        #     ],
        #     "category": "Map",
        #     "additionalConsiderations": [
        #         "Data must contain country names or codes."
        #     ]
        # },
        "echarts_timeseries_line": {
            "name": "Line Chart",
            "canBeAnnotationTypes": [],
            "canBeAnnotationTypesLookup": {},
            "credits": [
                "https://echarts.apache.org"
            ],
            "description": "Line chart is used to visualize measurements taken over a given category. Line chart is a type of chart which displays information as a series of data points connected by straight line segments. It is a basic type of chart common in many fields.",
            "supportedAnnotationTypes": [
                "EVENT",
                "FORMULA",
                "INTERVAL",
                "TIME_SERIES"
            ],
            "behaviors": [
                "INTERACTIVE_CHART",
                "DRILL_TO_DETAIL",
                "DRILL_BY"
            ],
            "datasourceCount": 1,
            "enableNoResults": True,
            "tags": [
                "ECharts",
                "Predictive",
                "Advanced-Analytics",
                "Line",
                "Featured"
            ],
            "category": "Evolution",
        }
    }
    logger = logging.getLogger(__name__)
    datamodel = SQLAInterface(Database)
    route_base = "/assistant"
    default_view = "root"



    @expose("/")
    def root(self) -> FlaskResponse:
        """ Assistant Home Page """
        return self.render_app_template()
    
     # Api to interact with gemini and get table descriptions
    @expose("/gemini/table", methods=["POST"])
    @safe
    def gemini(self) -> FlaskResponse:
        
        """ Request schema 
        {
            data: string,
            table_name: string
        }

        'data' is a string containing the json schema of the database see ./samples/gemini_table_data.json

        """
        body = request.json
        data = body["data"]
        target = body["table_name"]
        ## get the table description from the table
        response = table_description(data,target)
        
        self.logger.info(f"Response: {response.text}")
        return self.json_response(response.text)
    
    # Api to interact with gemini and get visualization suggestions
    @expose("/gemini/viz-suggestions", methods=["POST"])
    @safe
    def geminiViz(self) -> FlaskResponse:
        """ Request schema
        {
            data: string,
            purpose: string,
        }

        'data' is a string containing the json schema of the database see ./samples/gemini_viz_suggestions_data.json
        """
        body = request.json
        data = body["data"]
        purpose = body["purpose"]
        ## get the table description from the table 
        response = vizresponse(data,purpose,self.available_charts)
        
        self.logger.info(f"Response: {response.text}")
        return self.json_response(response.text)



    @expose("/gemini/save-control-values", methods=["POST"])
    @safe
    def save_control_value_examples(self) -> FlaskResponse:
        """Request schema
        {
            viz_type: string,
            form_data: {},
            controls: {},

        }
        """
        body = request.json
        viz_type = body["viz_type"]
        formData = body["form_data"]
        controls = body["controls"]
        self.support.add_example(viz_type, formData, controls)
        return self.json_response({"message": "Saved"})
    
    @expose("/gemini/get-control-values", methods=["POST"])
    def get_control_values(self) -> FlaskResponse:
        """ Request schema
        {
            viz_type: string,
            datasource: {},
            prompt: string, from llm_optimized
        }
        """
        body = request.json
        viz_suggestion = body["viz_type"]
        datasource = body["datasource"]
        prompt = body["prompt"]

        self.logger.info(f"Viz Type: {viz_suggestion}")

        viz_examples = self.support.get_examples(viz_suggestion)
        viz_example_controls = self.support.get_controls(viz_suggestion)
        viz_example_datasource = self.support.get_datasource_from(viz_suggestion)

        self.logger.info(f"Viz Examples: {viz_examples}")
        self.logger.info(f"Viz Example Controls: {viz_example_controls}")
        self.logger.info(f"Viz Example Datasource: {viz_example_datasource}")
        
        chat_session = self.model.start_chat(
            history=[
                {
                    "role": "user",
                    "parts": [
                        f"""
                        The following is an example chart configuration for a {viz_suggestion} chart thats been created by the charts controls
                        {viz_suggestion}_Controls = {viz_example_controls} using the following datasource
                        {viz_suggestion}_Datasource = {viz_example_datasource}
                        {viz_suggestion}_Control_Values = {viz_examples}
                        Using the new {viz_suggestion}_Datasource below,
                        New_{viz_suggestion}_Datasource = {datasource},
                        Create a new {viz_suggestion}_Control_Values that will best FIT THE INSTRUCTIONS in the prompt below.
                        Prompt = {prompt}
                        Response should be a single json object with structure similar to the objects in {viz_suggestion}_Control_Values list
                        Do not use the {viz_suggestion}_Control_Values values in the response.
                        Do not add any new keys not present in the {viz_suggestion}_Control.
                         
                        Use specific column_name specified in the New_{viz_suggestion}_Datasource.
                        Do not use any column_name not listed in the New_{viz_suggestion}_Datasource.
                        Do not use any aggregate functions not supported by SQL.
                        
                        Please make sure all columns and metrics have a unique label.
                        
                        Response should be a valid json format i.e use correct boolean, integer and string values.
                        Boolean values should be true or false. not True or False. i.e lowercase.
                        Column names placed in lists NOT should be enclosed in quotes. ie ["column_name"] not ["\"column_name\""] E.G. "some_key": ["column_name", "column_name_2", "column_name_3"]
                        do not return keys with null or undefined values.
                        Response should be a single valid json object.
                        """
                    ],
                }
            ]
        )
        
        response = chat_session.send_message(f"""
            Using the instruction in the prompt below, create a new {viz_suggestion}_Control_Values that will best FIT THE INSTRUCTIONS in the prompt below.
            Prompt = {prompt}
        """)
        self.logger.info(f"Response: {response.text}")
        return self.json_response(response.text)
    
