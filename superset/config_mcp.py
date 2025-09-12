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

This module provides configuration settings for the MCP proxy service
integration with Superset. Import this module in superset_config.py
to enable MCP functionality.
"""

# MCP Service Configuration
# =========================

# Enable/disable MCP service integration
FEATURE_FLAGS = {
    "MCP_SERVICE": True,
}

# MCP Service Connection Settings
# ------------------------------
# Host where the FastMCP service is running
MCP_SERVICE_HOST = "localhost"

# Port where the FastMCP service is running
MCP_SERVICE_PORT = 5008

# HTTP client settings for proxy requests
MCP_HTTP_TIMEOUT = 30  # seconds
MCP_HTTP_MAX_KEEPALIVE_CONNECTIONS = 20
MCP_HTTP_MAX_CONNECTIONS = 100

# Rate Limiting Settings
# ---------------------
# Maximum requests per user within the time window
MCP_RATE_LIMIT_REQUESTS = 100

# Time window for rate limiting in seconds
MCP_RATE_LIMIT_WINDOW_SECONDS = 60

# Circuit Breaker Settings
# ------------------------
# Number of failures before opening circuit breaker
MCP_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5

# Recovery timeout in seconds before trying again
MCP_CIRCUIT_BREAKER_RECOVERY_TIMEOUT = 60

# Streaming Settings
# -----------------
# Maximum size of SSE responses in MB to prevent DoS
MCP_STREAMING_MAX_SIZE_MB = 10

# Chunk size for streaming responses in bytes
MCP_STREAMING_CHUNK_SIZE = 8192

# Security Settings
# ----------------
# Required permission for MCP access (default: can_explore on Superset)
MCP_REQUIRED_PERMISSION = "can_explore"
MCP_REQUIRED_PERMISSION_VIEW = "Superset"

# CORS Settings
# ------------
# Allow CORS for MCP endpoints (useful for development)
MCP_CORS_ENABLED = True
MCP_CORS_ORIGINS = ["*"]  # In production, specify exact origins

# Advanced Configuration
# =====================

# Custom header injection for multi-tenancy
MCP_INJECT_USER_CONTEXT = True
MCP_INJECT_TENANT_CONTEXT = True
MCP_INJECT_DATABASE_CONTEXT = True
MCP_INJECT_FEATURE_FLAGS = True
MCP_INJECT_TRACE_ID = True

# Health check settings
MCP_HEALTH_CHECK_TIMEOUT = 5  # seconds

# Logging configuration
MCP_LOG_REQUESTS = True  # Log all MCP requests for debugging
MCP_LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR

# Development vs Production Settings
# =================================

import os

if os.environ.get("SUPERSET_ENV") == "development":
    # Development-specific MCP settings
    MCP_LOG_LEVEL = "DEBUG"
    MCP_LOG_REQUESTS = True
    MCP_STREAMING_MAX_SIZE_MB = 50  # Allow larger responses in dev

elif os.environ.get("SUPERSET_ENV") == "production":
    # Production-specific MCP settings
    MCP_LOG_REQUESTS = False  # Disable request logging in production
    MCP_CORS_ORIGINS = []  # Disable CORS in production
    MCP_RATE_LIMIT_REQUESTS = 50  # Stricter rate limiting

# Docker/Kubernetes Configuration
# ==============================

# If running in Docker, MCP service might be in a different container
if os.environ.get("MCP_SERVICE_HOST"):
    MCP_SERVICE_HOST = os.environ["MCP_SERVICE_HOST"]

if os.environ.get("MCP_SERVICE_PORT"):
    MCP_SERVICE_PORT = int(os.environ["MCP_SERVICE_PORT"])

# Redis Configuration for Production Rate Limiting
# ================================================
# In production, consider using Redis for distributed rate limiting
# Uncomment and configure these settings:

# MCP_REDIS_URL = os.environ.get("MCP_REDIS_URL", "redis://localhost:6379/0")
# MCP_USE_REDIS_RATE_LIMITING = True

# Multi-tenant Configuration Examples
# ==================================
# For preset.io style multi-tenant deployments:

# MCP_TENANT_RATE_LIMITS = {
#     "default": 100,
#     "enterprise": 500,
#     "premium": 200,
# }

# MCP_TENANT_FEATURES = {
#     "default": ["basic_charts"],
#     "enterprise": ["basic_charts", "advanced_charts", "custom_charts"],
#     "premium": ["basic_charts", "advanced_charts"],
# }

# Export all MCP settings for easy import
MCP_CONFIG = {
    "FEATURE_FLAGS": FEATURE_FLAGS,
    "MCP_SERVICE_HOST": MCP_SERVICE_HOST,
    "MCP_SERVICE_PORT": MCP_SERVICE_PORT,
    "MCP_HTTP_TIMEOUT": MCP_HTTP_TIMEOUT,
    "MCP_HTTP_MAX_KEEPALIVE_CONNECTIONS": MCP_HTTP_MAX_KEEPALIVE_CONNECTIONS,
    "MCP_HTTP_MAX_CONNECTIONS": MCP_HTTP_MAX_CONNECTIONS,
    "MCP_RATE_LIMIT_REQUESTS": MCP_RATE_LIMIT_REQUESTS,
    "MCP_RATE_LIMIT_WINDOW_SECONDS": MCP_RATE_LIMIT_WINDOW_SECONDS,
    "MCP_CIRCUIT_BREAKER_FAILURE_THRESHOLD": MCP_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    "MCP_CIRCUIT_BREAKER_RECOVERY_TIMEOUT": MCP_CIRCUIT_BREAKER_RECOVERY_TIMEOUT,
    "MCP_STREAMING_MAX_SIZE_MB": MCP_STREAMING_MAX_SIZE_MB,
    "MCP_STREAMING_CHUNK_SIZE": MCP_STREAMING_CHUNK_SIZE,
    "MCP_REQUIRED_PERMISSION": MCP_REQUIRED_PERMISSION,
    "MCP_REQUIRED_PERMISSION_VIEW": MCP_REQUIRED_PERMISSION_VIEW,
    "MCP_CORS_ENABLED": MCP_CORS_ENABLED,
    "MCP_CORS_ORIGINS": MCP_CORS_ORIGINS,
    "MCP_INJECT_USER_CONTEXT": MCP_INJECT_USER_CONTEXT,
    "MCP_INJECT_TENANT_CONTEXT": MCP_INJECT_TENANT_CONTEXT,
    "MCP_INJECT_DATABASE_CONTEXT": MCP_INJECT_DATABASE_CONTEXT,
    "MCP_INJECT_FEATURE_FLAGS": MCP_INJECT_FEATURE_FLAGS,
    "MCP_INJECT_TRACE_ID": MCP_INJECT_TRACE_ID,
    "MCP_HEALTH_CHECK_TIMEOUT": MCP_HEALTH_CHECK_TIMEOUT,
    "MCP_LOG_REQUESTS": MCP_LOG_REQUESTS,
    "MCP_LOG_LEVEL": MCP_LOG_LEVEL,
}
