import json
import logging
from typing import List

import openai
import tiktoken

from superset.daos.database import DatabaseDAO
from superset.llms.base_llm import BaseLlm

logger = logging.getLogger(__name__)


class OpenAiLlm(BaseLlm):
    llm_type = "OpenAI"
    cached_context_size = None

    def _trim_markdown(self, text: str) -> bool:
        # Check the body for SQL wrapped in markdown ```{language}\n...\n```
        try:
            sql_start = text.index("```")
            # Find the first newline after the start of the SQL block
            sql_start_len = text.index("\n", sql_start) + 1 if sql_start != -1 else 0
            sql_end = text.index("\n```")
            sql = text[sql_start + sql_start_len : sql_end]
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
            "gpt-4.1-nano": {"name": "GPT-4.1 nano", "input_token_limit": 1047576},
            "gpt-4.1-mini": {"name": "GPT-4.1 mini", "input_token_limit": 1047576},
            "o4-mini": {"name": "o4-mini", "input_token_limit": 200000},
            "o3": {"name": "o3", "input_token_limit": 200000},
            "gpt-4o-mini": {"name": "GPT-4o mini", "input_token_limit": 128000},
        }

    def generate_sql(self, prompt: str, history: str, schemas: List[str] | None) -> str:
        """
        Generate SQL from a user prompt using the OpenAI SDK.
        """
        db = DatabaseDAO.find_by_id(self.pk, True)
        if not db:
            logger.error(f"Database {self.pk} not found.")
            return

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

        logger.info(
            f"Using API key {llm_api_key} and model {llm_model} for database {self.pk}"
        )

        user_instructions = db.llm_context_options.instructions
        client = openai.OpenAI(api_key=llm_api_key)

        # Compose system prompt and context
        system_prompt = (
            user_instructions
            if user_instructions
            else self.get_system_instructions(self.dialect)
        )
        context_json = json.dumps(
            [
                schema
                for schema in self.context
                if not schemas or schema["schema_name"] in schemas
            ]
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Database metadata:\n{context_json}"},
        ]
        if history:
            messages.append({"role": "user", "content": history})
        messages.append({"role": "user", "content": prompt})

        try:
            response = client.chat.completions.create(
                model=llm_model,
                messages=messages,
            )
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return f"-- Failed to generate SQL: {str(e)}"

        if not response or not response.choices or len(response.choices) < 1:
            logger.error("No response from OpenAI API.")
            return "-- Failed to generate SQL: No response from OpenAI API."

        reply = response.choices[0].message.content.strip()
        sql = self._trim_markdown(reply)
        if not sql:
            return "-- Unable to find valid SQL in the LLM response"

        logger.info(f"Generated SQL: {sql}")
        return sql

    def get_context_size(self) -> int:
        """
        Count the number of tokens in a prompt using the OpenAI SDK.
        Cache the result in self.cached_context_size.
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

        if self.cached_context_size is not None:
            logger.info(f"Using cached context size: {self.cached_context_size}")
            return self.cached_context_size

        user_instructions = db.llm_context_options.instructions
        system_prompt = (
            user_instructions
            if user_instructions
            else self.get_system_instructions(self.dialect)
        )
        context_json = json.dumps(self.context)

        try:
            encoding = tiktoken.encoding_for_model(llm_model)
        except Exception:
            encoding = tiktoken.get_encoding("cl100k_base")

        # Compose the prompt as OpenAI would receive it
        prompt_parts = [context_json, system_prompt]
        prompt_text = "\n".join(prompt_parts)
        tokens = encoding.encode(prompt_text)
        total_tokens = len(tokens)

        logger.info(f"Calculated context size: {total_tokens}")
        self.cached_context_size = total_tokens
        return self.cached_context_size
