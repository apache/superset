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
LLM Configuration for Apache Superset.

This module provides a flexible LLM configuration system that supports:
- Per-feature model configuration (different models for different use cases)
- Global defaults with feature-specific overrides
- Environment variable and Flask config support

=============================================================================
ARCHITECTURE: Per-Feature LLM Configuration
=============================================================================

Superset's AI features have different requirements:

Feature                      | Best Model Type           | Why
-----------------------------|---------------------------|---------------------------
Database Analyzer            | Large context, fast       | Process large schemas
Dashboard Generator          | Strong reasoning          | Complex SQL generation
Text2SQL (future)            | Fast, good at SQL         | User-facing latency
Chart Suggestions (future)   | Creative, fast            | Many quick suggestions

Each feature can specify its preferred model while sharing a common API key.

=============================================================================
RECOMMENDED: OpenRouter (https://openrouter.ai)
=============================================================================

OpenRouter provides a unified API for multiple LLM providers through a single
endpoint. This allows switching between models without code changes.

Setup:
1. Get an API key from https://openrouter.ai/keys
2. Set environment variables:
   export SUPERSET_LLM_API_KEY=sk-or-v1-...

=============================================================================
MODEL RECOMMENDATIONS (as of December 2025)
=============================================================================

For large database schemas (need large context window):
- google/gemini-2.0-flash-001     1M context, fast, cost-effective
- google/gemini-1.5-pro           2M context, excellent reasoning
- meta-llama/llama-4-scout        10M context, open source

For complex reasoning tasks (SQL generation, mappings):
- anthropic/claude-sonnet-4       200K context, excellent reasoning
- openai/gpt-4o                   128K context, reliable
- anthropic/claude-3.5-sonnet     200K context, fast and capable

For fast, cost-effective tasks (descriptions, suggestions):
- anthropic/claude-3.5-haiku      200K context, very fast, cheap
- openai/gpt-4o-mini              128K context, fast and cheap
- google/gemini-2.0-flash-lite    1M context, very cheap

For advanced reasoning (complex multi-step tasks):
- openai/o1                       200K context, reasoning model
- openai/o3-mini                  200K context, fast reasoning

=============================================================================
ENVIRONMENT VARIABLES
=============================================================================

Global (shared across all features):
    SUPERSET_LLM_API_KEY          API key for the LLM provider (required)
    SUPERSET_LLM_BASE_URL         API endpoint (default: OpenRouter)

Per-feature model selection (optional, overrides global default):
    SUPERSET_LLM_MODEL                    Global default model
    SUPERSET_LLM_DATABASE_ANALYZER_MODEL  Model for database analysis
    SUPERSET_LLM_DASHBOARD_GENERATOR_MODEL Model for dashboard generation

Per-feature parameters (optional):
    SUPERSET_LLM_TEMPERATURE              Global temperature (default: 0.3)
    SUPERSET_LLM_MAX_TOKENS               Global max tokens (default: 4096)
    SUPERSET_LLM_TIMEOUT                  Global timeout seconds (default: 120)

=============================================================================
FLASK CONFIG (superset_config.py)
=============================================================================

# Global defaults
LLM_API_KEY = "sk-or-v1-..."
LLM_BASE_URL = "https://openrouter.ai/api/v1"
LLM_MODEL = "anthropic/claude-3.5-sonnet"  # Global default

# Per-feature model configuration
LLM_FEATURE_CONFIG = {
    "database_analyzer": {
        "model": "google/gemini-2.0-flash-001",  # Large context for schemas
        "temperature": 0.2,
        "max_tokens": 8192,
        "timeout": 180,
    },
    "dashboard_generator": {
        "model": "anthropic/claude-sonnet-4",  # Best reasoning for SQL
        "temperature": 0.2,
        "max_tokens": 8192,
        "timeout": 180,
    },
    "text2sql": {
        "model": "openai/gpt-4o-mini",  # Fast for user-facing
        "temperature": 0.1,
        "max_tokens": 2048,
        "timeout": 30,
    },
}

Environment variables take precedence over Flask config.
"""
import os
from dataclasses import dataclass, field
from typing import Any

# =============================================================================
# Global LLM Configuration Defaults
# =============================================================================

# API key for the LLM provider (OpenRouter or direct)
LLM_API_KEY = os.environ.get("SUPERSET_LLM_API_KEY")

# API base URL - default to OpenRouter
LLM_BASE_URL = os.environ.get(
    "SUPERSET_LLM_BASE_URL",
    "https://openrouter.ai/api/v1",
)

# Global default model (used when feature-specific model not configured)
LLM_MODEL = os.environ.get("SUPERSET_LLM_MODEL", "anthropic/claude-3.5-sonnet")

# Global default parameters
LLM_TEMPERATURE = float(os.environ.get("SUPERSET_LLM_TEMPERATURE", "0.3"))
LLM_MAX_TOKENS = int(os.environ.get("SUPERSET_LLM_MAX_TOKENS", "4096"))
LLM_TIMEOUT = int(os.environ.get("SUPERSET_LLM_TIMEOUT", "120"))

# OpenRouter-specific settings
LLM_APP_NAME = "Apache Superset"
LLM_SITE_URL = "https://superset.apache.org"


# =============================================================================
# Per-Feature Configuration
# =============================================================================


@dataclass
class LLMFeatureConfig:
    """
    Configuration for a specific LLM-powered feature.

    Each feature can specify its own model and parameters while
    sharing the global API key and base URL.
    """

    model: str | None = None  # None = use global default
    temperature: float | None = None
    max_tokens: int | None = None
    timeout: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def get_model(self, global_default: str) -> str:
        """Get model, falling back to global default."""
        return self.model or global_default

    def get_temperature(self, global_default: float) -> float:
        """Get temperature, falling back to global default."""
        return self.temperature if self.temperature is not None else global_default

    def get_max_tokens(self, global_default: int) -> int:
        """Get max tokens, falling back to global default."""
        return self.max_tokens if self.max_tokens is not None else global_default

    def get_timeout(self, global_default: int) -> int:
        """Get timeout, falling back to global default."""
        return self.timeout if self.timeout is not None else global_default


# Default per-feature configurations
# These can be overridden in superset_config.py via LLM_FEATURE_CONFIG
DEFAULT_FEATURE_CONFIGS: dict[str, LLMFeatureConfig] = {
    # Database Analyzer: needs large context for schema analysis
    "database_analyzer": LLMFeatureConfig(
        model="google/gemini-2.0-flash-001",  # 1M context, fast
        temperature=0.2,
        max_tokens=8192,
        timeout=180,
    ),
    # Dashboard Generator: needs strong reasoning for SQL generation
    "dashboard_generator": LLMFeatureConfig(
        model="anthropic/claude-3.5-sonnet",  # 200K context, excellent reasoning
        temperature=0.2,
        max_tokens=8192,
        timeout=180,
    ),
    # Text2SQL (future): needs to be fast for user-facing
    "text2sql": LLMFeatureConfig(
        model="openai/gpt-4o-mini",  # Fast and capable
        temperature=0.1,
        max_tokens=2048,
        timeout=30,
    ),
    # Chart Suggestions (future): creative suggestions
    "chart_suggestions": LLMFeatureConfig(
        model="anthropic/claude-3.5-haiku",  # Fast and cheap
        temperature=0.5,
        max_tokens=1024,
        timeout=15,
    ),
}


def get_feature_config(feature_name: str) -> LLMFeatureConfig:
    """
    Get LLM configuration for a specific feature.

    Priority order:
    1. Environment variable (SUPERSET_LLM_{FEATURE}_MODEL)
    2. Flask config (LLM_FEATURE_CONFIG[feature_name])
    3. Default feature config (DEFAULT_FEATURE_CONFIGS)
    4. Global defaults

    :param feature_name: Name of the feature (e.g., "database_analyzer")
    :return: LLMFeatureConfig for the feature
    """
    # Start with default feature config or empty
    config = DEFAULT_FEATURE_CONFIGS.get(feature_name, LLMFeatureConfig())

    # Check for Flask config override
    try:
        from flask import current_app

        flask_feature_configs = current_app.config.get("LLM_FEATURE_CONFIG", {})
        if feature_name in flask_feature_configs:
            flask_config = flask_feature_configs[feature_name]
            config = LLMFeatureConfig(
                model=flask_config.get("model", config.model),
                temperature=flask_config.get("temperature", config.temperature),
                max_tokens=flask_config.get("max_tokens", config.max_tokens),
                timeout=flask_config.get("timeout", config.timeout),
                extra=flask_config.get("extra", config.extra),
            )
    except RuntimeError:
        pass  # Outside Flask context

    # Check for environment variable override (highest priority)
    env_key = f"SUPERSET_LLM_{feature_name.upper()}_MODEL"
    env_model = os.environ.get(env_key)
    if env_model:
        config = LLMFeatureConfig(
            model=env_model,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
            timeout=config.timeout,
            extra=config.extra,
        )

    return config


# =============================================================================
# Model Registry (for documentation and validation)
# =============================================================================

RECOMMENDED_MODELS = {
    # Large context models
    "google/gemini-2.0-flash-001": {
        "context": 1_000_000,
        "description": "Fast, 1M context, cost-effective for large schemas",
        "best_for": ["database_analyzer"],
    },
    "google/gemini-1.5-pro": {
        "context": 2_000_000,
        "description": "2M context, excellent reasoning",
        "best_for": ["database_analyzer", "dashboard_generator"],
    },
    "meta-llama/llama-4-scout": {
        "context": 10_000_000,
        "description": "10M context, open source",
        "best_for": ["database_analyzer"],
    },
    # Reasoning models
    "anthropic/claude-sonnet-4": {
        "context": 200_000,
        "description": "Excellent reasoning, balanced speed/quality",
        "best_for": ["dashboard_generator", "text2sql"],
    },
    "anthropic/claude-3.5-sonnet": {
        "context": 200_000,
        "description": "Fast, capable, good all-rounder",
        "best_for": ["dashboard_generator", "text2sql"],
    },
    "openai/gpt-4o": {
        "context": 128_000,
        "description": "Reliable, good reasoning",
        "best_for": ["dashboard_generator", "text2sql"],
    },
    "openai/o1": {
        "context": 200_000,
        "description": "Advanced reasoning, slower",
        "best_for": ["complex_tasks"],
    },
    # Fast/cheap models
    "anthropic/claude-3.5-haiku": {
        "context": 200_000,
        "description": "Very fast, cheap, 200K context",
        "best_for": ["chart_suggestions", "quick_tasks"],
    },
    "openai/gpt-4o-mini": {
        "context": 128_000,
        "description": "Fast and cheap, good for user-facing",
        "best_for": ["text2sql", "chart_suggestions"],
    },
    "google/gemini-2.0-flash-lite": {
        "context": 1_000_000,
        "description": "Very cheap, 1M context",
        "best_for": ["database_analyzer", "quick_tasks"],
    },
}
