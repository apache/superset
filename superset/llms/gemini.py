import datetime
import json
import logging
import time

from google import genai
from google.genai import types

from typing import List

from superset.daos.database import DatabaseDAO
from superset.llms.base_llm import BaseLlm


logger = logging.getLogger(__name__)


class GeminiLlm(BaseLlm):
    llm_type = "Gemini"
    cache_name = None
    cache_expiry = None
    cache_model = None
    cached_size = None
    cached_size_cache_name = None

    def _create_schema_cache(self, gemini_client, model, user_instructions) -> types.CachedContent:
        cached_content = gemini_client.caches.create(
            model=model,
            config=types.CreateCachedContentConfig(
                contents=[json.dumps(self.context)],
                system_instruction=user_instructions if user_instructions else self.get_system_instructions(self.dialect),
                display_name=f"DB({self.pk}) context for {model}",
                ttl='86400s',
            ),
        )
        return cached_content

    def _get_cache_name(self, gemini_client, model, user_instructions) -> str:
        """
        Get the cache name for the LLM. If we have a cache and we think it's valid,
        just return it. Otherwise, generate a new cache.
        """
        logger.info(f"Current time is {datetime.datetime.now(tz=datetime.timezone.utc)}")
        logger.info(f"Cache expiry is {self.cache_expiry}")

        # First check if the cache has expired
        if self.cache_expiry and self.cache_expiry < datetime.datetime.now(datetime.timezone.utc):
            self.cache_name = None
            self.cache_expiry = None

        # We'll also check if the model has changed
        logger.info(f"Current model is {model}, cache model is {self.cache_model}")
        if self.cache_model != model:
            self.cache_name = None
            self.cache_expiry = None

        if not self.cache_name:
            logger.info(f"Creating new cache for model {model}...")
            start_time = time.perf_counter()
            created_cache = self._create_schema_cache(gemini_client, model, user_instructions)
            end_time = time.perf_counter()
            logger.info(f"Cache created in {end_time - start_time:.2f} seconds")
            self.cache_name = created_cache.name
            self.cache_expiry = created_cache.expire_time
            self.cache_model = model

        return self.cache_name

    def _get_response_error(self, response: types.GenerateContentResponse) -> str:
        error = "-- Failed to generate SQL: "
        match response.candidates[0].finish_reason:
            case types.FinishReason.FINISH_REASON_UNSPECIFIED:
                return error + "Gemini failed for an unspecified reason"
            case types.FinishReason.MAX_TOKENS:
                return error + "Gemini exceeded the maximum token limit"
            case types.FinishReason.SAFETY:
                return error + "Gemini detected unsafe content"
            case types.FinishReason.RECITATION:
                return error + "Gemini detected training data in the output"
            case types.FinishReason.OTHER:
                return error + "Gemini failed for an 'other' reason"
            case types.FinishReason.BLOCKLIST:
                return error + "Gemini detected blocklisted content"
            case types.FinishReason.PROHIBITED_CONTENT:
                return error + "Gemini detected prohibited content in the output"
            case types.FinishReason.SPII:
                return error + "Gemini detected personally identifiable information in the output"
            case types.FinishReason.MALFORMED_FUNCTION_CALL:
                return error + "Gemini detected a malformed function call in the output"

        return error + "Gemini failed for an unknown reason"

    def _trim_markdown(self, text: str) -> bool:
        # Check the body for SQL wrapped in markdown ```{language}\n...\n```
        try:
            sql_start = text.index('```')
            # Find the first newline after the start of the SQL block
            sql_start_len = text.index('\n', sql_start) + 1 if sql_start != -1 else 0
            sql_end = text.index('\n```')
            sql = text[sql_start + sql_start_len:sql_end]
        except ValueError:
            # There was no markdown, so assume for now the whole response is the SQL
            sql = text

        return sql

    @classmethod
    def get_system_instructions(cls, dialect) -> str:
        system_instructions = f"""You are a {dialect} database expert. Given an input question, create a syntactically correct {dialect} query. You MUST only answer with the SQL query, nothing else. Unless the user specifies a specific number of results they wish to obtain, always limit your query to at most return {cls.max_results} results. You can order the results by relevant columns. You MUST check that the query doesn't contain syntax errors or incorrect table, views, column names or joins on wrong columns. Fix any error you might find before returning your answer. DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database. To construct your database query you MUST ALWAYS use the database metadata information provided to you as a JSON file. Do NOT skip this step. This JSON file specifies all the database schemas, for each schema all its relations (which are tables, and views) and for each table its columns, indexes, and foreign key constraints. The unique indexes are very useful to understand what differentiates one record to another in the same relation. The foreign key constraints are very useful to find the correct columns to join. Do not include any markdown syntax in your response."""
        return system_instructions

    @staticmethod
    def get_models():
        return {
            'models/gemini-1.5-flash-002': {
                'name': 'Gemini 1.5 Flash',
                'input_token_limit': 1000000
            },
            'models/gemini-2.0-flash': {
                'name': 'Gemini 2.0 Flash',
                'input_token_limit': 1048576
            },
            'models/gemini-2.0-flash-thinking-exp': {
                'name': 'Gemini 2.5 Flash Preview',
                'input_token_limit': 1048576
            },
            'models/gemini-1.5-pro-002': {
                'name': 'Gemini 1.5 Pro',
                'input_token_limit': 2000000
            },
            'models/gemini-2.0-pro-exp': {
                'name': 'Gemini 2.0 Pro Experimental',
                'input_token_limit': 1048576
            },
        }

    def generate_sql(self, prompt: str, history: str, schemas: List[str] | None) -> str:
        """
        Generate SQL from a user prompt.
        """
        db = DatabaseDAO.find_by_id(self.pk, True)
        if not db:
            logger.error(f"Database {self.pk} not found.")
            return

        # TODO(AW): We should throw here instead of returning None
        if not db.llm_connection.enabled:
            logger.error(f"LLM is not enabled for database {self.pk}.")
            return

        if not db.llm_connection.provider == self.llm_type:
            logger.error(f"LLM provider is not {self.llm_type} for database {self.pk}.")
            return

        llm_api_key = db.llm_connection.api_key
        if not llm_api_key:
            logger.error(f"API key not set for database {self.pk}.")
            return

        llm_model = db.llm_connection.model
        if not llm_model:
            logger.error(f"Model not set for database {self.pk}.")
            return

        user_instructions = db.llm_context_options.instructions

        logger.info(f"Using API key {llm_api_key} and model {llm_model} for database {self.pk}")

        gemini_client = genai.Client(api_key=llm_api_key)

        if schemas:
            # Check and see if all the schemas are in the context
            for schema in schemas:
                if not any(schema == context_schema['schema_name'] for context_schema in self.context):
                    logger.error(f"Schema {schema} not found in context")
                    return

            context = json.dumps([schema for schema in self.context if schema['schema_name'] in schemas])
            instructions = user_instructions if user_instructions else self.get_system_instructions(self.dialect)

            contents = [context, instructions, history, prompt] if history else [context, instructions, prompt]
            response = gemini_client.models.generate_content(
                model=llm_model,
                contents=contents,
            )
        else:
            cache_name = self._get_cache_name(gemini_client, llm_model, user_instructions)
            logger.info(f"Using cache {self.cache_name}")

            contents = [history, prompt] if history else [prompt]
            try:
                response = gemini_client.models.generate_content(
                    model=llm_model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        cached_content=cache_name,
                    ),
                )
            except genai.errors.ServerError as e:
                logger.error(f"Server error: {e}")
                return f"-- Failed to generate SQL: {e.message}"

        # Check if the response is an error by looking at the finish reason of every candidate
        for candidate in response.candidates:
            if candidate.finish_reason != types.FinishReason.STOP:
                logger.error(f"Failed to generate SQL: {candidate.finish_reason}")

        success = any(candidate.finish_reason == types.FinishReason.STOP for candidate in response.candidates)
        if not success or not response.text:
            return self._get_response_error(response)

        sql = self._trim_markdown(response.text)
        if not sql:
            return "-- Unable to find valid SQL in the LLM response"

        logger.info(f"Generated SQL: {sql}")
        return sql

    def get_context_size(self) -> int:
        """
        Count the number of tokens in a prompt.
        Cache the result in self.cached_size, which expires when self.cache_expiry changes.
        """
        db = DatabaseDAO.find_by_id(self.pk, True)
        if not db:
            logger.error(f"Database {self.pk} not found.")
            return

        if not db.llm_connection.provider == self.llm_type:
            logger.error(f"LLM provider is not {self.llm_type} for database {self.pk}.")
            return

        llm_api_key = db.llm_connection.api_key
        if not llm_api_key:
            logger.error(f"API key not set for database {self.pk}.")
            return

        llm_model = db.llm_connection.model
        if not llm_model:
            logger.error(f"Model not set for database {self.pk}.")
            return

        # If we have a cached size and a valid cache_expiry, return the cached size
        if self.cached_size is not None and self.cache_name == self.cached_size_cache_name:
            logger.info(f"Using cached context size: {self.cached_size}")
            return self.cached_size
        else:
            # Invalidate any old cached size
            self.cached_size = None
            self.cached_size_cache_name = None

        user_instructions = db.llm_context_options.instructions

        gemini_client = genai.Client(api_key=llm_api_key)
        response = gemini_client.models.count_tokens(
            model=llm_model,
            contents=[json.dumps(self.context), user_instructions if user_instructions else self.get_system_instructions(self.dialect)],
        )
        logger.info(f"Calculated context size: {response.total_tokens}")

        # Cache the size until cache_expiry changes or is reached
        self.cached_size = response.total_tokens
        self.cached_size_cache_name = self.cache_name
        return self.cached_size
