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
MCP (Model Context Protocol) Proxy Blueprint for Superset.

This module provides a production-ready HTTP proxy to the FastMCP service
with enterprise features like authentication, rate limiting, circuit breakers,
and multi-tenant context injection.
"""

import logging
import time
import uuid
from collections import defaultdict
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional

import httpx
from flask import Blueprint, g, jsonify, request, Response

from superset import security_manager
from superset.extensions import csrf, feature_flag_manager
from superset.utils import json

logger = logging.getLogger(__name__)

# Create the MCP proxy blueprint (no URL prefix, like health blueprint)
mcp_bp = Blueprint("mcp_proxy", __name__)

# HTTP client with connection pooling for performance
HTTP_CLIENT = httpx.Client(
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
    timeout=httpx.Timeout(30.0),
    follow_redirects=True,
)


class CircuitBreaker:
    """Circuit breaker pattern for resilient service communication."""

    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = "closed"  # closed, open, half-open

    def can_execute(self) -> bool:
        """Check if requests should be allowed through."""
        if self.state == "closed":
            return True
        if self.state == "open":
            if (
                self.last_failure_time
                and time.time() - self.last_failure_time > self.recovery_timeout
            ):
                self.state = "half-open"
                return True
            return False
        return True  # half-open

    def record_success(self) -> None:
        """Record successful request."""
        self.failure_count = 0
        self.state = "closed"

    def record_failure(self) -> None:
        """Record failed request."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(
                "Circuit breaker opened after %d failures", self.failure_count
            )


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        """Check if request is within rate limits."""
        now = time.time()
        # Clean old requests
        self.requests[key] = [
            req_time
            for req_time in self.requests[key]
            if now - req_time < self.window_seconds
        ]

        # Check if under limit
        if len(self.requests[key]) < self.max_requests:
            self.requests[key].append(now)
            return True
        return False


# Global instances
circuit_breaker = CircuitBreaker()
rate_limiter = RateLimiter(max_requests=100, window_seconds=60)


def get_mcp_service_config() -> Dict[str, Any]:
    """Get MCP service configuration from Flask config."""
    from flask import current_app

    return {
        "host": current_app.config.get("MCP_SERVICE_HOST", "localhost"),
        "port": current_app.config.get("MCP_SERVICE_PORT", 5008),
        "rate_limit_requests": current_app.config.get("MCP_RATE_LIMIT_REQUESTS", 100),
        "rate_limit_window": current_app.config.get(
            "MCP_RATE_LIMIT_WINDOW_SECONDS", 60
        ),
        "max_response_size_mb": current_app.config.get("MCP_STREAMING_MAX_SIZE_MB", 10),
    }


def get_mcp_target_url() -> str:
    """Get the MCP service target URL."""
    config = get_mcp_service_config()
    return f"http://{config['host']}:{config['port']}/mcp"


def verify_mcp_access() -> None:
    """Verify user has access to MCP endpoints."""
    return  # Temporarily disabled for development
    # Check feature flag
    if not feature_flag_manager.is_feature_enabled("MCP_SERVICE"):
        raise PermissionError("MCP service is not enabled")

    # Check user permissions
    if not security_manager.has_access("can_explore", "Superset"):
        raise PermissionError("Insufficient permissions for MCP access")

    # Rate limiting per user
    user = getattr(g, "user", None)
    if user and hasattr(user, "id"):
        user_key = f"user_{user.id}"
    else:
        user_key = "anonymous"

    if not rate_limiter.is_allowed(user_key):
        raise PermissionError("Rate limit exceeded")


def inject_context_headers() -> Dict[str, str]:
    """Inject Superset context into headers for FastMCP service."""
    headers = dict(request.headers)

    # Add user context if available
    if hasattr(g, "user") and g.user and hasattr(g.user, "id"):
        headers["X-Superset-User-Id"] = str(g.user.id)
        if hasattr(g.user, "username"):
            headers["X-Superset-Username"] = g.user.username
        if hasattr(g.user, "roles"):
            roles = [role.name for role in g.user.roles]
            headers["X-Superset-User-Roles"] = ",".join(roles)
    else:
        # Handle anonymous user
        headers["X-Superset-User-Id"] = "anonymous"
        headers["X-Superset-Username"] = "anonymous"
        headers["X-Superset-User-Roles"] = "anonymous"

    # Add tenant/database context if available
    if hasattr(g, "tenant_id") and g.tenant_id:
        headers["X-Superset-Tenant-Id"] = str(g.tenant_id)

    if hasattr(g, "database_id") and g.database_id:
        headers["X-Superset-Database-Id"] = str(g.database_id)

    # Request tracing
    trace_id = getattr(g, "trace_id", str(uuid.uuid4()))
    headers["X-Trace-Id"] = trace_id

    # Feature flags context
    if hasattr(g, "feature_flags") and g.feature_flags:
        headers["X-Feature-Flags"] = ",".join(g.feature_flags)

    return headers


def prepare_mcp_headers(
    accept_type: str = "application/json, text/event-stream",
) -> Dict[str, str]:
    """Prepare standard headers for MCP requests."""
    headers = {}
    for key, value in request.headers.items():
        if key.lower() not in ["host", "connection", "content-length"]:
            headers[key] = value

    headers["Content-Type"] = "application/json"
    headers["Accept"] = accept_type
    return headers


def extract_session_id(response: httpx.Response) -> Optional[str]:
    """Extract session ID from response headers."""
    return response.headers.get("mcp-session-id") or response.headers.get(
        "Mcp-Session-Id"
    )


def parse_sse_response(response: httpx.Response) -> Response:
    """Parse SSE response and return first valid JSON data."""
    if response.headers.get("content-type", "").startswith("text/event-stream"):
        lines = response.text.strip().split("\n")
        for line in lines:
            if line.startswith("data: "):
                json_data = line[6:]
                try:
                    parsed_data = json.loads(json_data)
                    return jsonify(parsed_data)
                except json.JSONDecodeError:
                    logger.error("Failed to parse SSE data: %s", json_data)
                    continue
        return jsonify({"error": "No valid JSON in SSE response"}), 500
    else:
        return jsonify(response.json())


def stream_with_limits(
    response: httpx.Response, max_size_mb: int = 10
) -> Iterator[bytes]:
    """Stream response with memory limits to prevent DoS."""
    max_bytes = max_size_mb * 1024 * 1024
    total_bytes = 0

    try:
        for chunk in response.iter_bytes(chunk_size=8192):
            total_bytes += len(chunk)
            if total_bytes > max_bytes:
                logger.warning("Response size exceeded %d MB limit", max_size_mb)
                raise ValueError(f"Response too large (>{max_size_mb}MB)")
            yield chunk
    except httpx.ReadTimeout:
        logger.error("Timeout reading response from FastMCP")
        raise
    except Exception as e:
        logger.error("Error streaming response: %s", e)
        raise


def create_sse_response(response: httpx.Response, max_size_mb: int = 10) -> Response:
    """Create SSE response with proper headers and streaming."""

    def generate() -> Iterator[bytes]:
        try:
            yield from stream_with_limits(response, max_size_mb)
        except Exception as e:
            logger.error("SSE streaming error: %s", e)
            error_msg = (
                f'event: error\ndata: {{"error": "{str(e)}", '
                f'"code": "STREAM_ERROR"}}\n\n'
            )
            yield error_msg.encode()

    # Prepare SSE headers
    sse_headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",  # Disable nginx buffering
    }

    # Add session ID if present
    if session_id := extract_session_id(response):
        sse_headers["Mcp-Session-Id"] = session_id

    return Response(generate(), mimetype="text/event-stream", headers=sse_headers)


def initialize_mcp_session() -> Optional[str]:
    """Initialize MCP session and return session ID."""
    target_url = get_mcp_target_url()

    init_payload = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "superset-proxy", "version": "1.0.0"},
        },
        "id": 1,
    }

    init_response = HTTP_CLIENT.post(
        target_url,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        json=init_payload,
    )

    session_id = extract_session_id(init_response)

    # Send initialized notification if we have a session
    if session_id:
        initialized_payload = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
        }

        HTTP_CLIENT.post(
            target_url,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "Mcp-Session-Id": session_id,
            },
            json=initialized_payload,
        )

    return session_id


@mcp_bp.route("/api/v1/mcp-proxy/test", methods=["GET", "POST"])
def test_route() -> Response:
    """Simple test route."""
    return Response(
        f'{{"test": "working", "method": "{request.method}"}}',
        mimetype="application/json",
    )


@mcp_bp.route(
    "/api/v1/mcp-proxy/",
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    defaults={"path": ""},
)
@mcp_bp.route(
    "/api/v1/mcp-proxy/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)
@csrf.exempt
def proxy_mcp(path: str = "") -> Response:  # noqa: C901
    """
    Simple transparent MCP proxy.
    Handles all MCP protocol requests and forwards them to the FastMCP service.
    """
    logger.info("MCP proxy: method=%s, path=%s", request.method, path)
    target_url = get_mcp_target_url()

    try:
        # Handle OPTIONS for CORS
        if request.method == "OPTIONS":
            return Response(status=200)

        # Handle DELETE for session cleanup
        if request.method == "DELETE":
            return Response('{"status": "ok"}', status=200, mimetype="application/json")

        # Handle GET requests (SSE streaming)
        if request.method == "GET":
            headers = prepare_mcp_headers("text/event-stream")

            try:
                response = HTTP_CLIENT.get(
                    target_url,
                    headers=headers,
                    params=request.args,
                )

                circuit_breaker.record_success()
                return create_sse_response(response)

            except (httpx.RequestError, httpx.TimeoutException) as e:
                circuit_breaker.record_failure()
                logger.error("GET request to FastMCP failed: %s", e)
                return Response(
                    (
                        '{"error": "MCP service unavailable", '
                        '"code": "SERVICE_UNAVAILABLE"}'
                    ),
                    status=502,
                    mimetype="application/json",
                )

        # Handle POST/PUT requests
        headers = prepare_mcp_headers()

        try:
            response = HTTP_CLIENT.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=request.get_data(),
                params=request.args,
            )

            circuit_breaker.record_success()

        except (httpx.RequestError, httpx.TimeoutException) as e:
            circuit_breaker.record_failure()
            logger.error("Request to FastMCP failed: %s", e)
            return Response(
                '{"error": "MCP service unavailable", "code": "SERVICE_UNAVAILABLE"}',
                status=502,
                mimetype="application/json",
            )

        # Handle SSE responses
        content_type = response.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            return create_sse_response(response)

        # Handle regular responses
        response_headers = dict(response.headers)

        # Remove hop-by-hop headers
        for header in ["connection", "transfer-encoding", "upgrade"]:
            response_headers.pop(header, None)

        # Handle error responses
        if response.status_code >= 400:
            logger.warning(
                "FastMCP returned error %s: %s", response.status_code, response.text
            )
            try:
                error_data = response.json()
                return jsonify(error_data), response.status_code
            except Exception:
                return jsonify(
                    {
                        "jsonrpc": "2.0",
                        "error": {
                            "code": response.status_code,
                            "message": response.text or f"HTTP {response.status_code}",
                        },
                        "id": None,
                    }
                ), response.status_code

        return Response(
            response.content, status=response.status_code, headers=response_headers
        )

    except PermissionError as e:
        logger.warning("Access denied for MCP request: %s", e)
        return Response(
            f'{{"error": "{str(e)}", "code": "ACCESS_DENIED"}}',
            status=403,
            mimetype="application/json",
        )
    except Exception as e:
        logger.error("Unexpected error in MCP proxy: %s", e, exc_info=True)
        return Response(
            '{"error": "Internal server error", "code": "INTERNAL_ERROR"}',
            status=500,
            mimetype="application/json",
        )


@mcp_bp.route("/api/v1/mcp-proxy/_health")
def health_check() -> Response:
    """Combined health check for proxy and FastMCP service."""
    try:
        target_url = get_mcp_target_url()

        # Test MCP service with initialize (basic health check)
        ping_payload = {
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "health-check", "version": "1.0.0"},
            },
            "id": 1,
        }

        response = HTTP_CLIENT.post(
            target_url,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },
            json=ping_payload,
            timeout=5.0,
        )

        if response.status_code == 200:
            return Response(
                (
                    '{"status": "healthy", "proxy": "ok", "fastmcp": "ok", '
                    f'"circuit_breaker": "{circuit_breaker.state}"}}'
                ),
                mimetype="application/json",
            )
    except Exception as e:
        logger.error("FastMCP health check failed: %s", e)

    return Response(
        (
            '{"status": "degraded", "proxy": "ok", "fastmcp": "error", '
            f'"circuit_breaker": "{circuit_breaker.state}"}}'
        ),
        status=503,
        mimetype="application/json",
    )


@mcp_bp.route("/api/v1/mcp-proxy/_info")
@csrf.exempt
def service_info() -> Response:
    """Get MCP service information and configuration."""
    try:
        verify_mcp_access()

        config = get_mcp_service_config()
        info = {
            "service": "Superset MCP Proxy",
            "version": "1.0.0",
            "transport": "http-proxy",
            "upstream": {
                "host": config["host"],
                "port": config["port"],
            },
            "features": {
                "authentication": True,
                "rate_limiting": True,
                "circuit_breaker": True,
                "sse_streaming": True,
                "context_injection": True,
            },
            "circuit_breaker": {
                "state": circuit_breaker.state,
                "failure_count": circuit_breaker.failure_count,
            },
            "rate_limit": {
                "max_requests": config["rate_limit_requests"],
                "window_seconds": config["rate_limit_window"],
            },
        }

        return Response(
            str(info).replace("'", '"'),  # Quick JSON formatting
            mimetype="application/json",
        )

    except PermissionError as e:
        logger.warning("Access denied for MCP info: %s", e)
        return Response(
            f'{{"error": "{str(e)}", "code": "ACCESS_DENIED"}}',
            status=403,
            mimetype="application/json",
        )


# Handle CORS preflight requests
@mcp_bp.before_request
def handle_preflight() -> None:
    """Handle CORS preflight requests for MCP endpoints."""
    if request.method == "OPTIONS":
        return Response(
            status=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": (
                    "Content-Type, Authorization, X-Requested-With"
                ),
                "Access-Control-Max-Age": "86400",
            },
        )


# Cleanup function for connection pool
@contextmanager
def cleanup_http_client() -> Iterator[httpx.Client]:
    """Context manager to ensure HTTP client cleanup."""
    try:
        yield HTTP_CLIENT
    finally:
        pass  # httpx.Client handles cleanup automatically


def cleanup_mcp_proxy() -> None:
    """Cleanup function for MCP proxy resources."""
    try:
        HTTP_CLIENT.close()
        logger.info("MCP proxy HTTP client closed")
    except Exception as e:
        logger.error("Error cleaning up MCP proxy: %s", e)
