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
LLM integration module for Superset.

This module provides a unified interface for LLM providers through OpenRouter
or direct API access, with support for per-feature model configuration.

Global Configuration (environment variables):
    SUPERSET_LLM_API_KEY: API key for OpenRouter or direct provider (required)
    SUPERSET_LLM_MODEL: Global default model (default: anthropic/claude-3.5-sonnet)
    SUPERSET_LLM_BASE_URL: API endpoint (default: https://openrouter.ai/api/v1)
    SUPERSET_LLM_TEMPERATURE: Response temperature (default: 0.3)
    SUPERSET_LLM_MAX_TOKENS: Max response tokens (default: 4096)
    SUPERSET_LLM_TIMEOUT: Request timeout in seconds (default: 120)

Per-Feature Configuration:
    Different AI features have different requirements. Each feature can use
    a different model optimized for its use case:

    Feature                    | Default Model           | Why
    ---------------------------|-------------------------|---------------------------
    database_analyzer          | gemini-2.0-flash-001    | 1M context for schemas
    dashboard_generator        | claude-3.5-sonnet       | Strong reasoning for SQL
    text2sql (future)          | gpt-4o-mini             | Fast user-facing queries
    chart_suggestions (future) | claude-3.5-haiku        | Creative, fast suggestions

    Override per-feature models via environment variables:
        SUPERSET_LLM_DATABASE_ANALYZER_MODEL=google/gemini-2.0-flash-001
        SUPERSET_LLM_DASHBOARD_GENERATOR_MODEL=anthropic/claude-sonnet-4

    Or via Flask config (superset_config.py):
        LLM_FEATURE_CONFIG = {
            "database_analyzer": {"model": "google/gemini-2.0-flash-001"},
            "dashboard_generator": {"model": "anthropic/claude-sonnet-4"},
        }

OpenRouter Usage:
    OpenRouter provides a unified API for multiple LLM providers.
    Set SUPERSET_LLM_BASE_URL=https://openrouter.ai/api/v1
    Use model names like "openai/gpt-4o" or "anthropic/claude-3.5-sonnet"
    Get your API key from https://openrouter.ai/keys

See superset/config_llm.py for detailed configuration options and model recommendations.
"""
from superset.llm.base import BaseLLMClient, LLMConfig, LLMResponse

__all__ = ["BaseLLMClient", "LLMConfig", "LLMResponse"]
