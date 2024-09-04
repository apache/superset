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

    geminiApiKey = current_app.config.get("GEMINI_API_KEY")
    genai.configure(api_key=geminiApiKey)
    generationConfig = {
        "temperature": 1,
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json",
    }

    model = genai.GenerativeModel(
        model_name="gemini-1.5-flash",
        generation_config=generationConfig,
        # safety_settings = Adjust safety settings
        # See https://ai.google.dev/gemini-api/docs/safety-settings
        )



    logger.info(f"GEMINI API Key: {geminiApiKey}")


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
        """
        body = request.json
        data = body["data"]
        target = body["table_name"]
        chat_session = self.model.start_chat(
            history=[
                {
                    "role": "user",
                    "parts": [
                        f""" 
                        The following is a json schema containing data about a database Schema = {data}
                        Using the Data provided by the Schema Answer the question in the prompt below. in the following format.
                        Ensure the Format is a valid json format.
                        Format =
                            {{ 
                            "human_understandable: "The response should be assertive, The response should be a single line only and include column descriptions as well".
                            "llm_optimized":"The response should contain all relevant information that may be used by an llm to probe for more information. include data types and formats as well. Include potential relationships with other selected tables"
                            }}
                        """,
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        """
                        {{
                            "human_understandable":"The table 'bart_lines' contains data about different BART lines, including the line's name, color, a path represented in a JSON format and a polyline.", 
                            "llm_optimized":"The table 'bart_lines' contains data about different BART lines. Each row represents a different BART line. The columns contain the following information: 'name': the name of the BART line, 'color': the color of the BART line, 'path_json': the path of the BART line in JSON format, 'polyline': a polyline representing the path of the BART line."
                        }}
                        """
                    ],
                },
            ]
        )
        inputPrompt =   f"""
                        Prompt = Please give a reasonable description of the data contained in the table named {target}.
                    """

        response = chat_session.send_message(inputPrompt)
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
        """
        body = request.json
        data = body["data"]
        purpose = body["purpose"]
        chat_session = self.model.start_chat(
            history=[
            {
                "role": "user",
                "parts": [
                f"""
                The following is a json schema containing data about a database Schema = {data}
                The data contains information collected by an organization for the purpose of {purpose}.
                Using the Data provided by the Schema, provide suggestions for visualizations that can be created from the data that may be useful to the organization.
                Available visualizations are: {self.available_charts}.
                Order the suggestions according to importance and relevance to the organization's purpose.
                The response should be in the following format:
                - Avoid referencing the organization or its purpose in the response.
                - Do not use data whose "selected" key is false.
                - Do not use tables whose "data" key is not present or is an empty list or dictionary.
                - Do not suggest a viz_type if the query needed to generate the visualization cannot provide the data needed for the visualization.
                - Do not suggest a viz_type that is not available in the Available visualizations.
                - Only suggest a maximum of 5 visualizations.
                - Only use data from above to generate the response.
                
                Format:
                [
                    {{
                    "viz_type": "viz_type",
                    "description": "short one-sentence description of the visualization in a way that a human can understand",
                    "reasoning": "reasoning behind the suggestion",
                    "viz_datasources": [
                        "List of SQL queries that will be used as data sources for the visualization.",
                        "The number of viz_datasource MUST be equal to the viz_type datasourceCount.",
                        "The queries must be consistent with the data provided in the schema.",
                        "For example, if the schema contains a table named 'bart_lines', the query should be 'SELECT `column` FROM `schemaname`."bart_lines".",
                        "The queries should select only the columns that are relevant to the visualization and columns that are selected.",
                        "For example, if the visualization is a bar chart that shows the number of passengers per line, the query should be 'SELECT `line_name`, `passengers` FROM `schemaname`."bart_lines";",
                        "The queries should filter out nulls for the columns selected.",
                        "The queries should ensure that castings are done only when necessary and filters added to support valid casting.",
                        "The queries should not include any grouping as the grouping will be done by the visualization based on the llm_optimized description.",
                        "The queries should not include any ordering as the ordering will be done by the visualization based on the llm_optimized description.",
                        "The queries should not include any limit as the limit will be done by the visualization based on the llm_optimized description.",
                        "The queries should try to standardize the data.",
                        "For example, if the data is in different units, the queries should convert the data to a single unit.",
                        "If the data is a mix of upper and lower case, the queries should convert the data to a single case.",
                        "All column names must be enclosed in quotes i.e `column_name`",
                        "The query MUST be a valid SQL query.",
                        "Join queries are allowed accross schemas in the same database.",
                        "The queries should try and make vizualizations labels are human readable. E.G for queries returning ids, the queries should join with tables that have human readable names. ONLY if the human readable names are available AND selected in the schema.",
                        "Make no assumptions about the data in the database.",
                    ],
                    "llm_optimized": "detailed description of the vizualization, explain how viz_datasources should be used to create the visualization, explain how the data from viz_datasources can be modified using sql expressions to create the visualization. do not reference columns that are not provided by the viz_datasources",
                    "databaseId": "The id of the datasource that the visualization will be created from. This id should be consistent with the databaseId in the schema.",
                    "schemaName": "The name of the schema that the visualization will be created from. This name should be consistent with the schemaName in the schema."
                    }}
                ]
                
                The response should be in a valid JSON format.
                """,
                ],
            }
            ]
        )
        response = chat_session.send_message("Please provide suggestions for visualizations that can be created from the data.")
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
    
