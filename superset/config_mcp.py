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
MCP (Model Context Protocol) Service Configuration for Superset.

IMPORTANT: This file is NOT automatically loaded by Superset!

To enable MCP functionality, you must either:

1. Import this file in your superset_config.py:
   from superset.config_mcp import *

2. Or copy the settings you need directly into superset_config.py

The minimum required settings are:
- FEATURE_FLAGS["MCP_SERVICE"] = True  (to enable the feature)
- MCP_SERVICE_HOST = "localhost"       (where FastMCP is running)
- MCP_SERVICE_PORT = 5008              (FastMCP port)

All other settings have defaults in mcp_proxy.py and are optional.
"""

import os

# ============================================================================
# AVAILABLE MCP CONFIGURATION SETTINGS
# ============================================================================
# Below are all available MCP settings with their defaults from mcp_proxy.py
# Copy only the ones you need to your superset_config.py
# ============================================================================

# REQUIRED SETTINGS (must be set to enable MCP)
# ----------------------------------------------
# Enable/disable MCP service integration
FEATURE_FLAGS = {
    "MCP_SERVICE": True,  # REQUIRED: Set to True to enable MCP proxy
}

# MCP Service Connection (REQUIRED)
MCP_SERVICE_HOST = "localhost"  # REQUIRED: Where FastMCP service is running
MCP_SERVICE_PORT = 5008  # REQUIRED: Port for FastMCP service

# OPTIONAL SETTINGS (all have defaults in mcp_proxy.py)
# ------------------------------------------------------

# HTTP Client Settings
MCP_HTTP_TIMEOUT = 30  # Default: 30 seconds
MCP_HTTP_MAX_KEEPALIVE_CONNECTIONS = 20  # Default: 20
MCP_HTTP_MAX_CONNECTIONS = 100  # Default: 100

# Rate Limiting (per-user limits)
MCP_RATE_LIMIT_REQUESTS = 100  # Default: 100 requests
MCP_RATE_LIMIT_WINDOW_SECONDS = 60  # Default: 60 second window

# Circuit Breaker (prevents cascading failures)
MCP_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5  # Default: 5 failures
MCP_CIRCUIT_BREAKER_RECOVERY_TIMEOUT = 60  # Default: 60 seconds

# SSE Streaming Settings
MCP_STREAMING_MAX_SIZE_MB = 10  # Default: 10 MB max response size
MCP_STREAMING_CHUNK_SIZE = 8192  # Default: 8192 bytes per chunk

# Security & Permissions
MCP_REQUIRED_PERMISSION = "can_explore"  # Default: "can_explore"
MCP_REQUIRED_PERMISSION_VIEW = "Superset"  # Default: "Superset"

# CORS Settings (for cross-origin requests)
MCP_CORS_ENABLED = True  # Default: False
MCP_CORS_ORIGINS = ["*"]  # Default: [] (no CORS). Use specific origins in production!

# Header Injection (for multi-tenancy and debugging)
MCP_INJECT_USER_CONTEXT = True  # Default: True - adds X-Superset-User
MCP_INJECT_TENANT_CONTEXT = (
    True  # Default: False - adds X-Superset-Tenant (if available)
)
MCP_INJECT_DATABASE_CONTEXT = True  # Default: False - adds X-Superset-Database
MCP_INJECT_FEATURE_FLAGS = True  # Default: False - adds X-Superset-Features
MCP_INJECT_TRACE_ID = True  # Default: True - adds X-Trace-Id for debugging

# Health Check
MCP_HEALTH_CHECK_TIMEOUT = 5  # Default: 5 seconds

# Logging
MCP_LOG_REQUESTS = True  # Default: False - logs all MCP requests
MCP_LOG_LEVEL = "INFO"  # Default: "INFO" - options: DEBUG, INFO, WARNING, ERROR

# ============================================================================
# ENVIRONMENT-SPECIFIC EXAMPLES
# ============================================================================

# Example: Development environment overrides
if os.environ.get("SUPERSET_ENV") == "development":
    MCP_LOG_LEVEL = "DEBUG"
    MCP_LOG_REQUESTS = True
    MCP_STREAMING_MAX_SIZE_MB = 50

# Example: Production environment overrides
elif os.environ.get("SUPERSET_ENV") == "production":
    MCP_LOG_REQUESTS = False
    MCP_CORS_ORIGINS = []  # Disable CORS in production
    MCP_RATE_LIMIT_REQUESTS = 50

# Example: Docker/Kubernetes - read from environment
if os.environ.get("MCP_SERVICE_HOST"):
    MCP_SERVICE_HOST = os.environ["MCP_SERVICE_HOST"]
if os.environ.get("MCP_SERVICE_PORT"):
    MCP_SERVICE_PORT = int(os.environ["MCP_SERVICE_PORT"])

# ============================================================================
# ADVANCED CONFIGURATION EXAMPLES
# ============================================================================

# Redis-based rate limiting (for distributed deployments)
# MCP_REDIS_URL = os.environ.get("MCP_REDIS_URL", "redis://localhost:6379/0")
# MCP_USE_REDIS_RATE_LIMITING = True

# Multi-tenant rate limits (preset.io style)
# MCP_TENANT_RATE_LIMITS = {
#     "default": 100,
#     "enterprise": 500,
#     "premium": 200,
# }

# Multi-tenant feature flags
# MCP_TENANT_FEATURES = {
#     "default": ["basic_charts"],
#     "enterprise": ["basic_charts", "advanced_charts", "custom_charts"],
#     "premium": ["basic_charts", "advanced_charts"],
# }

# ============================================================================
# QUICK START - MINIMAL CONFIGURATION
# ============================================================================
# Copy this to your superset_config.py to get started:
#
# # Enable MCP proxy
# FEATURE_FLAGS = {
#     **FEATURE_FLAGS,  # Keep existing flags
#     "MCP_SERVICE": True,
# }
# MCP_SERVICE_HOST = "localhost"
# MCP_SERVICE_PORT = 5008
#
# That's it! All other settings will use defaults from mcp_proxy.py
