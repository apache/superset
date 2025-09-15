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
MCP (Model Context Protocol) Service Configuration.

Copy these settings to your superset_config.py to enable MCP:

    FEATURE_FLAGS = {
        **FEATURE_FLAGS,  # Keep existing flags
        "MCP_SERVICE": True,
    }
    MCP_SERVICE_HOST = "localhost"
    MCP_SERVICE_PORT = 5008
"""

import os

# Enable MCP service integration
FEATURE_FLAGS = {
    "MCP_SERVICE": True,
}

# MCP Service Connection
MCP_SERVICE_HOST = os.environ.get("MCP_SERVICE_HOST", "localhost")
MCP_SERVICE_PORT = int(os.environ.get("MCP_SERVICE_PORT", 5008))

# Optional: Adjust rate limits if needed (defaults work for most cases)
# MCP_RATE_LIMIT_REQUESTS = 100  # requests per window
# MCP_RATE_LIMIT_WINDOW_SECONDS = 60  # window size in seconds
# MCP_STREAMING_MAX_SIZE_MB = 10  # max response size
