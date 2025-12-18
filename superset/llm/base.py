# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Base LLM client for Superset.

Provides a unified interface for LLM providers, with OpenRouter as the
recommended routing layer for provider flexibility.

OpenRouter (https://openrouter.ai) allows routing to multiple LLM providers
(OpenAI, Anthropic, Google, etc.) through a single API endpoint.

Per-Feature Configuration
=========================
Different Superset features have different LLM requirements:
- database_analyzer: Large context window for processing schemas
- dashboard_generator: Strong reasoning for SQL generation
- text2sql: Fast response for user-facing queries
- chart_suggestions: Creative, fast suggestions

Use feature_name parameter to get feature-specific configuration:
    config = LLMConfig.from_env(feature_name="dashboard_generator")
    client = BaseLLMClient(feature_name="dashboard_generator")

See superset/config_llm.py for detailed configuration options.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

import requests
from flask import current_app
from langchain_core.utils.json import parse_json_markdown

from superset.utils import json

logger = logging.getLogger(__name__)

# Default to OpenRouter as the routing layer
DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "anthropic/claude-3.5-sonnet"
DEFAULT_TEMPERATURE = 0.3
DEFAULT_MAX_TOKENS = 4096
DEFAULT_TIMEOUT = 120


@dataclass
class LLMConfig:
    """
    Configuration for LLM service.

    Attributes:
        api_key: API key for the LLM provider (OpenRouter or direct)
        model: Model identifier. For OpenRouter, use provider/model format
               (e.g., "openai/gpt-4o", "anthropic/claude-3.5-sonnet")
        base_url: API endpoint URL
        temperature: Response randomness (0.0 = deterministic, 1.0 = creative)
        max_tokens: Maximum tokens in response
        timeout: Request timeout in seconds
        app_name: Application name for OpenRouter tracking
        site_url: Site URL for OpenRouter tracking
    """

    api_key: str | None = None
    model: str = DEFAULT_MODEL
    base_url: str = DEFAULT_BASE_URL
    temperature: float = DEFAULT_TEMPERATURE
    max_tokens: int = DEFAULT_MAX_TOKENS
    timeout: int = DEFAULT_TIMEOUT
    app_name: str = "Apache Superset"
    site_url: str = "https://superset.apache.org"

    @classmethod
    def from_env(cls, feature_name: str | None = None) -> LLMConfig:
        """
        Load configuration from environment variables and Flask config.

        If feature_name is provided, feature-specific configuration is loaded
        from config_llm.py with the following priority order:
        1. Environment variable (SUPERSET_LLM_{FEATURE}_MODEL)
        2. Flask config (LLM_FEATURE_CONFIG[feature_name])
        3. Default feature config (DEFAULT_FEATURE_CONFIGS)
        4. Global defaults

        :param feature_name: Optional feature name for feature-specific config
                            (e.g., "database_analyzer", "dashboard_generator")

        Environment variables:
            SUPERSET_LLM_API_KEY: API key (required for LLM features)
            SUPERSET_LLM_MODEL: Global model name
            SUPERSET_LLM_BASE_URL: API URL (default: https://openrouter.ai/api/v1)
            SUPERSET_LLM_{FEATURE}_MODEL: Feature-specific model override
        """
        # Try Flask config for base settings
        try:
            flask_config = current_app.config
        except RuntimeError:
            flask_config = {}

        # Get API key and base URL (shared across all features)
        # Check both SUPERSET_LLM_API_KEY and LLM_API_KEY for Flask config compatibility
        api_key = (
            os.environ.get("SUPERSET_LLM_API_KEY")
            or flask_config.get("SUPERSET_LLM_API_KEY")
            or flask_config.get("LLM_API_KEY")
        )
        base_url = os.environ.get("SUPERSET_LLM_BASE_URL") or flask_config.get(
            "LLM_BASE_URL", DEFAULT_BASE_URL
        )
        app_name = flask_config.get("LLM_APP_NAME", "Apache Superset")
        site_url = flask_config.get("LLM_SITE_URL", "https://superset.apache.org")

        # Get global defaults
        global_model = os.environ.get("SUPERSET_LLM_MODEL") or flask_config.get(
            "LLM_MODEL", DEFAULT_MODEL
        )
        global_temperature = float(
            os.environ.get("SUPERSET_LLM_TEMPERATURE")
            or flask_config.get("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)
        )
        global_max_tokens = int(
            os.environ.get("SUPERSET_LLM_MAX_TOKENS")
            or flask_config.get("LLM_MAX_TOKENS", DEFAULT_MAX_TOKENS)
        )
        global_timeout = int(
            os.environ.get("SUPERSET_LLM_TIMEOUT")
            or flask_config.get("LLM_TIMEOUT", DEFAULT_TIMEOUT)
        )

        # If feature_name is provided, get feature-specific configuration
        if feature_name:
            from superset.config_llm import get_feature_config

            feature_config = get_feature_config(feature_name)

            return cls(
                api_key=api_key,
                model=feature_config.get_model(global_model),
                base_url=base_url,
                temperature=feature_config.get_temperature(global_temperature),
                max_tokens=feature_config.get_max_tokens(global_max_tokens),
                timeout=feature_config.get_timeout(global_timeout),
                app_name=app_name,
                site_url=site_url,
            )

        # No feature specified - use global defaults
        return cls(
            api_key=api_key,
            model=global_model,
            base_url=base_url,
            temperature=global_temperature,
            max_tokens=global_max_tokens,
            timeout=global_timeout,
            app_name=app_name,
            site_url=site_url,
        )


@dataclass
class LLMResponse:
    """
    Response from LLM API call.

    Attributes:
        content: Raw response content (may include markdown code blocks)
        json_content: Parsed JSON content (if response is valid JSON)
        success: Whether the call was successful
        error: Error message if unsuccessful
        model: Model that generated the response
        usage: Token usage information
    """

    content: str = ""
    json_content: dict[str, Any] | list[Any] | None = None
    success: bool = True
    error: str | None = None
    model: str | None = None
    usage: dict[str, int] = field(default_factory=dict)


class BaseLLMClient:
    """
    Base client for LLM API interactions.

    Supports OpenRouter (recommended) and direct provider APIs.
    OpenRouter provides unified access to multiple LLM providers.

    Per-Feature Configuration:
        Different features can use different models optimized for their needs.
        Pass feature_name to use feature-specific configuration:

        # Uses dashboard_generator model (claude-3.5-sonnet for reasoning)
        client = BaseLLMClient(feature_name="dashboard_generator")

        # Uses database_analyzer model (gemini-2.0-flash for large context)
        client = BaseLLMClient(feature_name="database_analyzer")

    Example usage with OpenRouter:
        export SUPERSET_LLM_API_KEY=sk-or-v1-...
        export SUPERSET_LLM_BASE_URL=https://openrouter.ai/api/v1
        export SUPERSET_LLM_MODEL=anthropic/claude-3.5-sonnet

    Example usage with direct OpenAI:
        export SUPERSET_LLM_API_KEY=sk-...
        export SUPERSET_LLM_BASE_URL=https://api.openai.com/v1
        export SUPERSET_LLM_MODEL=gpt-4o

    Feature-specific model override:
        export SUPERSET_LLM_DATABASE_ANALYZER_MODEL=google/gemini-2.0-flash-001
        export SUPERSET_LLM_DASHBOARD_GENERATOR_MODEL=anthropic/claude-sonnet-4
    """

    # Feature name for this client (set by subclasses)
    feature_name: str | None = None

    def __init__(
        self,
        config: LLMConfig | None = None,
        feature_name: str | None = None,
    ) -> None:
        """
        Initialize the LLM client.

        :param config: LLM configuration. If None, loads from environment.
        :param feature_name: Optional feature name for feature-specific config.
                            If provided, overrides the class-level feature_name.
                            Examples: "database_analyzer", "dashboard_generator"
        """
        # Use provided feature_name or fall back to class attribute
        effective_feature = feature_name or self.feature_name
        self.config = config or LLMConfig.from_env(feature_name=effective_feature)

    def is_available(self) -> bool:
        """Check if LLM service is configured and available."""
        return bool(self.config.api_key)

    def chat(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """
        Send a chat completion request to the LLM.

        :param prompt: User prompt/message
        :param system_prompt: System prompt for context
        :param temperature: Override default temperature
        :param max_tokens: Override default max tokens
        :return: LLMResponse with content and metadata
        """
        if not self.is_available():
            return LLMResponse(
                success=False,
                error="LLM service not configured. Set SUPERSET_LLM_API_KEY.",
            )

        headers = self._build_headers()
        payload = self._build_payload(
            prompt,
            system_prompt,
            temperature or self.config.temperature,
            max_tokens or self.config.max_tokens,
        )

        try:
            response = requests.post(
                f"{self.config.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=self.config.timeout,
            )

            if response.status_code != 200:
                logger.error(
                    "LLM API error: %d - %s", response.status_code, response.text
                )
                return LLMResponse(
                    success=False,
                    error=f"API error: {response.status_code}",
                )

            return self._parse_response(response.json())

        except requests.exceptions.Timeout:
            logger.error("LLM API timeout after %d seconds", self.config.timeout)
            return LLMResponse(success=False, error="Request timeout")
        except requests.exceptions.RequestException as e:
            logger.error("LLM API request error: %s", str(e))
            return LLMResponse(success=False, error=str(e))
        except Exception as e:
            logger.error("Unexpected error in LLM call: %s", str(e))
            return LLMResponse(success=False, error=str(e))

    def chat_json(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        """
        Send a chat request expecting JSON response.

        Automatically cleans markdown code blocks from response.

        :param prompt: User prompt/message
        :param system_prompt: System prompt (will append JSON instruction)
        :param temperature: Override default temperature
        :param max_tokens: Override default max tokens
        :return: LLMResponse with parsed json_content
        """
        # Append JSON instruction to system prompt
        json_system = system_prompt
        if json_system:
            json_system += " Respond only with valid JSON."
        else:
            json_system = "Respond only with valid JSON."

        response = self.chat(
            prompt=prompt,
            system_prompt=json_system,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        if response.success and response.content:
            response.json_content = self._parse_json_content(response.content)

        return response

    def _build_headers(self) -> dict[str, str]:
        """Build request headers with provider-specific additions."""
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

        # OpenRouter-specific headers for tracking and routing
        if self._is_openrouter():
            headers["HTTP-Referer"] = self.config.site_url
            headers["X-Title"] = self.config.app_name

        return headers

    def _build_payload(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float,
        max_tokens: int,
    ) -> dict[str, Any]:
        """Build the API request payload."""
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        return {
            "model": self.config.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

    def _parse_response(self, response_data: dict[str, Any]) -> LLMResponse:
        """Parse the API response into LLMResponse."""
        try:
            choice = response_data.get("choices", [{}])[0]
            content = choice.get("message", {}).get("content", "")
            model = response_data.get("model")
            usage = response_data.get("usage", {})

            return LLMResponse(
                content=content,
                success=True,
                model=model,
                usage=usage,
            )
        except (KeyError, IndexError) as e:
            logger.error("Failed to parse LLM response: %s", str(e))
            return LLMResponse(success=False, error="Invalid response format")

    def _parse_json_content(self, content: str) -> dict[str, Any] | list[Any] | None:
        """
        Parse JSON from LLM response, handling markdown code blocks and extra text.

        Uses langchain-core's parse_json_markdown first, with custom fallback
        handling for SQL strings with unescaped newlines.

        Handles common LLM issues like:
        - Markdown code blocks (```json ... ```)
        - Unescaped newlines in string values (common in SQL)
        - Extra explanatory text before/after JSON

        :param content: Raw response content
        :return: Parsed JSON or None if parsing fails
        """
        if not content:
            return None

        # Try langchain-core's parser first (handles markdown well)
        try:
            result = parse_json_markdown(content)
            if result is not None:
                return result
        except Exception:
            # Fall through to custom parsing for edge cases
            pass

        # Custom parsing for edge cases (especially SQL with newlines)
        return self._parse_json_fallback(content)

    def _parse_json_fallback(self, content: str) -> dict[str, Any] | list[Any] | None:
        """
        Custom JSON parsing fallback for cases langchain-core doesn't handle.

        Specifically handles SQL strings with unescaped newlines, which is
        common when LLMs generate SQL in JSON responses.
        """
        # Clean up markdown code blocks
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        # Try direct parsing first
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Try fixing unescaped newlines in strings (common LLM issue with SQL)
        fixed = self._fix_unescaped_newlines(cleaned)
        if fixed != cleaned:
            try:
                return json.loads(fixed)
            except json.JSONDecodeError:
                pass

        # If that fails, try to extract JSON object or array
        # Handle cases where LLM adds explanatory text before/after JSON
        extracted = self._extract_json_from_text(cleaned)
        if extracted:
            try:
                return json.loads(extracted)
            except json.JSONDecodeError:
                pass

            # Try fixing unescaped newlines in extracted JSON
            fixed_extracted = self._fix_unescaped_newlines(extracted)
            try:
                return json.loads(fixed_extracted)
            except json.JSONDecodeError as e:
                logger.warning("Failed to parse extracted JSON: %s", str(e))

        logger.warning("Could not extract JSON from LLM response")
        return None

    def _extract_json_from_text(self, text: str) -> str | None:
        """Extract JSON object or array from text with surrounding content."""
        # Find JSON object
        obj_start = text.find("{")
        if obj_start >= 0:
            brace_count = 0
            for i, char in enumerate(text[obj_start:], obj_start):
                if char == "{":
                    brace_count += 1
                elif char == "}":
                    brace_count -= 1
                    if brace_count == 0:
                        return text[obj_start : i + 1]

        # Try JSON array if no object found
        arr_start = text.find("[")
        if arr_start >= 0:
            bracket_count = 0
            for i, char in enumerate(text[arr_start:], arr_start):
                if char == "[":
                    bracket_count += 1
                elif char == "]":
                    bracket_count -= 1
                    if bracket_count == 0:
                        return text[arr_start : i + 1]

        return None

    def _fix_unescaped_newlines(self, content: str) -> str:
        """
        Fix unescaped newlines inside JSON string values.

        LLMs often return JSON with literal newlines inside strings (especially SQL),
        which is invalid JSON. This method escapes them properly.

        :param content: JSON string that may have unescaped newlines
        :return: Fixed JSON string with properly escaped newlines in strings
        """
        result = []
        in_string = False
        escape_next = False
        i = 0

        while i < len(content):
            char = content[i]

            if escape_next:
                result.append(char)
                escape_next = False
                i += 1
                continue

            if char == "\\":
                result.append(char)
                escape_next = True
                i += 1
                continue

            if char == '"':
                in_string = not in_string
                result.append(char)
                i += 1
                continue

            if in_string and char == "\n":
                # Escape the newline inside a string
                result.append("\\n")
                i += 1
                continue

            if in_string and char == "\r":
                # Skip carriage returns or escape them
                i += 1
                continue

            if in_string and char == "\t":
                # Escape tabs inside strings
                result.append("\\t")
                i += 1
                continue

            result.append(char)
            i += 1

        return "".join(result)

    def _is_openrouter(self) -> bool:
        """Check if using OpenRouter as the provider."""
        return "openrouter" in self.config.base_url.lower()
