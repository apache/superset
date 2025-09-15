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
MCP (Model Context Protocol) Direct Service Proxy for Superset.

This module provides a direct integration with the MCP service
by instantiating it directly instead of using subprocess STDIO.
"""

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, Iterator, Optional

from fastmcp import Client
from flask import Blueprint, jsonify, request, Response

from superset.extensions import csrf

# Import the MCP service instance
from superset.mcp_service.app import mcp as mcp_server
from superset.utils import json as superset_json

# Import helper functions from the existing HTTP proxy
from superset.views.mcp_http_proxy import (
    CircuitBreaker,
    get_mcp_service_config,
    RateLimiter,
    verify_mcp_access,
)

logger = logging.getLogger(__name__)

# Create the MCP STDIO proxy blueprint (keeping the same name for compatibility)
mcp_client_bp = Blueprint("mcp_client_proxy", __name__)

# Global instances
circuit_breaker = CircuitBreaker()
rate_limiter = RateLimiter(max_requests=100, window_seconds=60)

# Global session tracking
_session_id: Optional[str] = None
_initialized: bool = False
_request_counter: int = 1


def get_next_request_id() -> int:
    """Get next request ID."""
    global _request_counter
    request_id = _request_counter
    _request_counter += 1
    return request_id


def _get_initialize_response() -> Dict[str, Any]:
    """Get initialize response."""
    return {
        "jsonrpc": "2.0",
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "experimental": {},
                "prompts": {"listChanged": False},
                "resources": {"subscribe": False, "listChanged": False},
                "tools": {"listChanged": True},
            },
            "serverInfo": {
                "name": "Superset MCP Server (Direct)",
                "version": "1.14.0",
            },
        },
    }


async def _handle_tools_list(client: Client) -> Dict[str, Any]:
    """Handle tools/list method."""
    tools = await client.list_tools()
    return {
        "jsonrpc": "2.0",
        "result": {
            "tools": [
                {
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": (
                        tool.inputSchema if hasattr(tool, "inputSchema") else {}
                    ),
                }
                for tool in tools
            ]
        },
    }


def _format_tool_result(result: Any) -> Dict[str, Any]:
    """Format tool result content."""
    if hasattr(result, "content") and result.content:
        content_text = None
        if hasattr(result.content[0], "text"):
            content_text = result.content[0].text
        elif hasattr(result.content[0], "data"):
            content_text = result.content[0].data

        if content_text and isinstance(content_text, str):
            try:
                content_data = superset_json.loads(content_text)
                return {
                    "jsonrpc": "2.0",
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": superset_json.dumps(content_data),
                            }
                        ]
                    },
                }
            except superset_json.JSONDecodeError:
                return {
                    "jsonrpc": "2.0",
                    "result": {"content": [{"type": "text", "text": content_text}]},
                }
        else:
            return {
                "jsonrpc": "2.0",
                "result": {"content": [{"type": "text", "text": str(content_text)}]},
            }
    else:
        return {
            "jsonrpc": "2.0",
            "result": {"content": [{"type": "text", "text": str(result)}]},
        }


async def call_mcp_tool(
    method: str, params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Call an MCP tool using the Client."""
    try:
        async with Client(mcp_server) as client:
            if method == "initialize":
                return _get_initialize_response()
            elif method == "tools/list":
                return await _handle_tools_list(client)
            elif method == "tools/call":
                tool_name = params.get("name") if params else None
                tool_arguments = params.get("arguments", {}) if params else {}

                if not tool_name:
                    return {
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32602,
                            "message": "Invalid params: missing tool name",
                        },
                    }

                result = await client.call_tool(tool_name, tool_arguments)
                return _format_tool_result(result)
            else:
                # Direct tool call
                result = await client.call_tool(method, params or {})
                return _format_tool_result(result)
    except Exception as e:
        logger.error("Error calling MCP tool %s: %s", method, e)
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32603, "message": f"Internal error: {str(e)}"},
        }


def call_mcp_tool_sync(
    method: str, params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Synchronous wrapper for calling MCP tools."""
    # Get or create event loop
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is already running (shouldn't happen in Flask), create a new one
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, call_mcp_tool(method, params))
                return future.result(timeout=30)
        else:
            return loop.run_until_complete(call_mcp_tool(method, params))
    except RuntimeError:
        # No event loop, create a new one
        return asyncio.run(call_mcp_tool(method, params))


def create_sse_response(response_data: Dict[str, Any]) -> Response:
    """Create SSE response from JSON data."""

    def generate() -> Iterator[bytes]:
        try:
            # Format as SSE event
            data_json = superset_json.dumps(response_data)
            sse_data = f"data: {data_json}\n\n"
            yield sse_data.encode()
        except Exception as e:
            logger.error("SSE generation error: %s", e)
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

    # Add session ID if available
    global _session_id
    if _session_id:
        sse_headers["Mcp-Session-Id"] = _session_id

    return Response(generate(), mimetype="text/event-stream", headers=sse_headers)


@mcp_client_bp.route("/api/v1/mcp-client/test", methods=["GET", "POST"])
def test_route() -> Response:
    """Simple test route."""
    return Response(
        f'{{"test": "working", "method": "{request.method}", "transport": "direct"}}',
        mimetype="application/json",
    )


@mcp_client_bp.route(
    "/api/v1/mcp-client/", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)
@csrf.exempt
def proxy_mcp_native(path: str = "") -> Response:  # noqa: C901
    """
    MCP Direct proxy handler.
    Directly calls the MCP service without subprocess.
    """
    logger.info("MCP Direct proxy: method=%s, path=%s", request.method, path)

    # Handle OPTIONS requests for CORS
    if request.method == "OPTIONS":
        return Response(
            "",
            status=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": (
                    "Content-Type, Accept, Mcp-Session-Id, User-Agent"
                ),
            },
        )

    try:
        # Verify access
        verify_mcp_access()

        # Check circuit breaker
        if not circuit_breaker.can_execute():
            return Response(
                '{"error": "Circuit breaker open", "code": "SERVICE_UNAVAILABLE"}',
                status=503,
                mimetype="application/json",
            )

        # Handle DELETE for session cleanup
        if request.method == "DELETE":
            # Don't actually do anything - just acknowledge
            logger.info("Received DELETE request, session cleanup (no-op)")
            return Response('{"status": "ok"}', status=200, mimetype="application/json")

        # Handle GET requests (SSE streaming)
        if request.method == "GET":
            # GET requests establish SSE connection for streaming responses
            # Just keep the connection open without sending any data
            def generate() -> Iterator[str]:
                # Keep connection alive without sending invalid messages
                # The client will handle the empty stream
                while True:
                    time.sleep(60)  # Keep alive for 60 seconds
                    # Send a comment line to keep connection alive (SSE comment)
                    yield ": keepalive\n\n"

            global _session_id
            if not _session_id:
                _session_id = str(uuid.uuid4())

            return Response(
                generate(),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                    "Mcp-Session-Id": _session_id,
                },
            )

        # Handle POST/PUT requests
        try:
            # Get raw request data
            raw_data = request.get_data(as_text=True)

            # If empty, just return OK
            if not raw_data or not raw_data.strip():
                # Empty connectivity test
                return Response(
                    '{"status": "ok"}',
                    status=200,
                    mimetype="application/json",
                )

            # Parse JSON request
            try:
                request_data = superset_json.loads(raw_data)
            except superset_json.JSONDecodeError as e:
                logger.error("Failed to parse JSON: %s", e)
                return Response(
                    '{"error": "Invalid JSON", "code": "INVALID_REQUEST"}',
                    status=400,
                    mimetype="application/json",
                )

            # Handle notifications (no response expected)
            if "id" not in request_data:
                # This is a notification - just acknowledge it
                if request_data.get("method") == "notifications/initialized":
                    global _initialized
                    _initialized = True
                    logger.info("MCP session initialized notification received")
                    return Response(
                        '{"status": "ok"}',
                        status=200,
                        mimetype="application/json",
                    )
                # Other methods need an ID
                request_data["id"] = get_next_request_id()

            # Get method and params
            method = request_data.get("method")
            params = request_data.get("params", {})
            request_id = request_data.get("id")

            # Remove empty params for methods that don't expect them
            if method == "tools/list" and params == {}:
                params = None

            # Handle initialize specially - if already initialized, return response
            if method == "initialize" and _initialized:
                response = {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "experimental": {},
                            "prompts": {"listChanged": False},
                            "resources": {"subscribe": False, "listChanged": False},
                            "tools": {"listChanged": True},
                        },
                        "serverInfo": {
                            "name": "Superset MCP Server (Direct)",
                            "version": "1.14.0",
                        },
                    },
                }
            else:
                # Call the MCP service directly
                logger.debug("Calling MCP tool: method=%s, params=%s", method, params)
                response = call_mcp_tool_sync(method, params)

                # Add request ID to response
                if "id" not in response:
                    response["id"] = request_id

                # Set initialized flag if this was an initialize call
                if method == "initialize" and not response.get("error"):
                    _initialized = True
                    if not _session_id:
                        _session_id = str(uuid.uuid4())

                logger.debug(
                    "Got response: %s", str(response)[:200] if response else "None"
                )

            if response is None:
                circuit_breaker.record_failure()
                logger.error(
                    "No response from MCP service for request: %s", request_data
                )
                return Response(
                    '{"error": "No response from MCP service", '
                    '"code": "SERVICE_ERROR"}',
                    status=502,
                    mimetype="application/json",
                )

            circuit_breaker.record_success()

            # Check if client expects SSE response
            accept_header = request.headers.get("Accept", "")
            if "text/event-stream" in accept_header:
                return create_sse_response(response)

            # Return regular JSON response
            return jsonify(response)

        except Exception as e:
            circuit_breaker.record_failure()
            logger.error("Request to MCP Direct failed: %s", e)
            return Response(
                '{"error": "MCP service error", "code": "SERVICE_ERROR"}',
                status=502,
                mimetype="application/json",
            )

    except PermissionError as e:
        logger.warning("Access denied for MCP Direct request: %s", e)
        return Response(
            f'{{"error": "{str(e)}", "code": "ACCESS_DENIED"}}',
            status=403,
            mimetype="application/json",
        )
    except Exception as e:
        logger.error("Unexpected error in MCP Direct proxy: %s", e, exc_info=True)
        return Response(
            '{"error": "Internal server error", "code": "INTERNAL_ERROR"}',
            status=500,
            mimetype="application/json",
        )


@mcp_client_bp.route("/api/v1/mcp-client/_health")
def health_check() -> Response:
    """Health check for Direct proxy."""
    try:
        # Try a simple tools/list call to verify the service is working
        test_response = call_mcp_tool_sync("tools/list")

        if test_response and not test_response.get("error"):
            return Response(
                f'{{"status": "healthy", "proxy": "ok", "mcp_direct": "ok", '
                f'"circuit_breaker": "{circuit_breaker.state}"}}',
                mimetype="application/json",
            )
        else:
            error_msg = (
                test_response.get("error", "unknown")
                if test_response
                else "no_response"
            )
            return Response(
                f'{{"status": "degraded", "proxy": "ok", "mcp_direct": "error", '
                f'"circuit_breaker": "{circuit_breaker.state}", '
                f'"error": "{error_msg}"}}',
                status=503,
                mimetype="application/json",
            )

    except Exception as e:
        logger.error("MCP Direct health check failed: %s", e)
        return Response(
            f'{{"status": "error", "proxy": "ok", "mcp_direct": "error", '
            f'"circuit_breaker": "{circuit_breaker.state}", "error": "{str(e)}"}}',
            status=503,
            mimetype="application/json",
        )


@mcp_client_bp.route("/api/v1/mcp-client/_info")
@csrf.exempt
def service_info() -> Response:
    """Get MCP Direct service information and configuration."""
    try:
        verify_mcp_access()

        config = get_mcp_service_config()

        info = {
            "service": "Superset MCP Direct Proxy",
            "version": "1.0.0",
            "transport": "direct-instantiation",
            "session": {
                "session_id": _session_id,
                "initialized": _initialized,
            },
            "features": {
                "authentication": True,
                "rate_limiting": True,
                "circuit_breaker": True,
                "sse_streaming": True,
                "context_injection": True,
                "direct_integration": True,
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
            superset_json.dumps(info),
            mimetype="application/json",
        )

    except PermissionError as e:
        logger.warning("Access denied for MCP Direct info: %s", e)
        return Response(
            f'{{"error": "{str(e)}", "code": "ACCESS_DENIED"}}',
            status=403,
            mimetype="application/json",
        )


# Handle CORS preflight requests
@mcp_client_bp.before_request
def handle_preflight() -> None:
    """Handle CORS preflight requests for MCP Direct endpoints."""
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
