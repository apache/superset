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


class AssistantView(BaseSupersetView):
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
    
     # Api to interact with gemini 
    @expose("/gemini", methods=["POST"])
    @safe
    def gemini(self) -> FlaskResponse:
        
        """ Request schema 
        {
            data: string,
            table_name: string
        }
        """
        self.logger.info(f"Gemini API called : {request}")
        body = request.json
        self.logger.info(f"Request Body: {body}")
        data = body["data"]
        table_name = body["table_name"]
        self.logger.info(f"Data: {data}")
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
                        {{{
                            "human_understandable":"The table 'bart_lines' contains data about different BART lines, including the line's name, color, a path represented in a JSON format and a polyline.", 
                            "llm_optimized":"The table 'bart_lines' contains data about different BART lines. Each row represents a different BART line. The columns contain the following information: 'name': the name of the BART line, 'color': the color of the BART line, 'path_json': the path of the BART line in JSON format, 'polyline': a polyline representing the path of the BART line."
                        }}}
                        """
                    ],
                },
            ]
        )
        inputPrompt =   """
                        Prompt = Please give a reasonable description of the data contained in the table named {table_name}.
                    """

        response = chat_session.send_message(inputPrompt)
        self.logger.info(f"Response: {response.text}")
        return self.json_response(response.text)

   