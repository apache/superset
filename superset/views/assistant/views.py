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
                            "llm_optimized":"The response should contain all relevant information that may be used by an llm to probe for more information. include data types and formats as well."
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
        inputPrompt =   """
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
                        The data contains information collected by by an organisation for the purpose of {purpose}
                        Using the Data provided by the Schema provide suggestions for visualizations that can be created from the data.
                        Avaliable visualizations are:{self.available_charts}
                        Order the suggestions according to importance and relevance to the organisation's purpose.
                        Response should be in the following format.
                        Avoid referencing the organisation or its purpose in the response.
                        Do not use data whose "selected" key is false.
                        Do not use tables whose "data" key is not present or is an empty list or dictionary.
                        Do not suggest a viz_type if the query needed to generate the vizualization can not provide the data needed for the visualization.
                        Do not suggest a viz_type not available in the Avaliable visualizations.
                        Only suggest a maximum of 5 visualizations.
                        Only use data from above to generate the response.
                        Format =
                        [
                            {{
                                "viz_type": "viz_type",
                                "description": "short on sentence description of the visualization in a way that a human can understand",
                                "reasoning": "reasoning behind the suggestion",
                                "llm_optimized": "descibe the visualization in a way that an llm can understand, include references to the data",
                                "viz_datasources": [
                                    "List of SQL queries that will be used as data sources for the visualization.
                                    The number of viz_datasource MUST be equal to the viz_type datasourceCount.
                                    The queries must be consistent with the data provided in the schema. For example, if the schema contains a table named 'bart_lines', the query should be 'SELECT * FROM bart_lines'.
                                    The queries should select only the columns that are relevant to the visualization and columns that are selected. For example, if the visualization is a bar chart that shows the number of passengers per line, the query should be 'SELECT line_name, passengers FROM bart_lines'
                                    The queries should filter out nulls for the columns selected.
                                    The queries should ensure that castings are done only when necessary. and filteres added to support valid casting.
                                    The query must always with a least one column that will be used for grouping.
                                    All column names and must be enclosed in double quotes.
                                    The query MUST be a valid SQL query.
                                    "
                                ],
                                "databaseId": "The id of the datasource that the visualization will be created from. This id should be consistent with the databaseId in the schema."
                                "schemaName: "The name of the schema that the visualization will be created from. This name should be consistent with the schemaName in the schema."
                            }}
                        ]
                        The response should be a valid json format.
                        """,
                        ],
                }
            ]
        )
        response = chat_session.send_message("Please provide suggestions for visualizations that can be created from the data.")
        self.logger.info(f"Response: {response.text}")
        return self.json_response(response.text)


    # Function takes viz-suggestion { type and controls } and data { sql query , data and sample control value return example }
    # and tries to return relevant values for the controls based on
    # 1. the type of visualization
    # 2. the data available
    # 3. the controls available for the visualization
    # 4. The users intent
    # 5. The users previous interactions with the assistant

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
                        Create a new {viz_suggestion}_Control_Values that will best answer the prompt below.
                        Prompt = {prompt}
                        Response should be a single json object with structure similar to the objects in {viz_suggestion}_Control_Values list
                        Do not use the {viz_suggestion}_Control_Values values in the response.
                        Do not add any new keys not present in the {viz_suggestion}_Control.
                        Do not use '*' in any sql expressions. Use specific column_name specified in the New_{viz_suggestion}_Datasource.
                        Response should be a valid json format.
                        """
                    ],
                }
            ]
        )
        
        response = chat_session.send_message(prompt)
        self.logger.info(f"Response: {response.text}")
        return self.json_response(response.text)
    
