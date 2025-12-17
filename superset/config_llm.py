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
Configuration settings for the LLM service used by the Database Analyzer.

To use the database analyzer with LLM capabilities, set these environment variables:
- SUPERSET_LLM_API_KEY: Your API key for the LLM provider
- SUPERSET_LLM_MODEL: Model name (default: gpt-4o)
- SUPERSET_LLM_BASE_URL: API base URL (default: https://api.openai.com/v1)
"""

import os

# LLM configuration for database analyzer
# Set to None to disable LLM features (will still extract schema without AI descriptions)
LLM_API_KEY = os.environ.get("SUPERSET_LLM_API_KEY")

# LLM model to use (e.g., "gpt-4o", "gpt-4", "gpt-3.5-turbo", "claude-3-opus")
LLM_MODEL = os.environ.get("SUPERSET_LLM_MODEL", "gpt-4o")

# LLM API base URL (change for different providers or self-hosted models)
LLM_BASE_URL = os.environ.get("SUPERSET_LLM_BASE_URL", "https://api.openai.com/v1")

# Temperature for LLM responses (lower = more deterministic)
LLM_TEMPERATURE = float(os.environ.get("SUPERSET_LLM_TEMPERATURE", "0.3"))

# Maximum tokens for LLM responses
LLM_MAX_TOKENS = int(os.environ.get("SUPERSET_LLM_MAX_TOKENS", "4096"))