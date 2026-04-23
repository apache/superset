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
MCP server for Apache Superset

Supports both single-pod (in-memory) and multi-pod (Redis) deployments.
For multi-pod deployments, configure MCP_EVENT_STORE_CONFIG with Redis URL.
"""

import logging
import os
from collections.abc import Sequence
from typing import Annotated, Any, Callable

import uvicorn
from fastmcp.server.middleware import Middleware

from superset.mcp_service.app import create_mcp_app, init_fastmcp_server
from superset.mcp_service.mcp_config import (
    get_mcp_factory_config,
    MCP_STORE_CONFIG,
    MCP_TOOL_SEARCH_CONFIG,
)
from superset.mcp_service.middleware import (
    create_response_size_guard_middleware,
    GlobalErrorHandlerMiddleware,
    LoggingMiddleware,
    StructuredContentStripperMiddleware,
)
from superset.mcp_service.privacy import (
    tool_requires_data_model_metadata_access,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.storage import _create_redis_store
from superset.utils import json

logger = logging.getLogger(__name__)


def _suppress_third_party_warnings() -> None:
    """Suppress known third-party deprecation warnings from MCP responses.

    The MCP SDK captures Python warnings and forwards them to clients via
    ``mcp.server.lowlevel.server:Warning:`` log entries.  This wastes LLM
    tokens and causes clients to try to "fix" irrelevant internal warnings.

    Suppressed warnings:
    - marshmallow ``RemovedInMarshmallow4Warning`` (triggered during
      database engine schema instantiation)
    - google.api_core ``FutureWarning`` (Python version support notices)
    """
    import warnings

    warnings.filterwarnings(
        "ignore",
        category=DeprecationWarning,
        module=r"marshmallow\..*",
    )
    warnings.filterwarnings(
        "ignore",
        category=FutureWarning,
        module=r"google\..*",
    )


def configure_logging(debug: bool = False) -> None:
    """Configure logging for the MCP service."""
    import sys

    if debug or os.environ.get("SQLALCHEMY_DEBUG"):
        # Only configure basic logging if no handlers exist (respects logging.ini)
        root_logger = logging.getLogger()
        if not root_logger.handlers:
            logging.basicConfig(
                level=logging.INFO,
                format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                stream=sys.stderr,  # Always log to stderr, not stdout
            )

        # Only override SQLAlchemy logger levels if they're not explicitly configured
        for logger_name in [
            "sqlalchemy.engine",
            "sqlalchemy.pool",
            "sqlalchemy.dialects",
        ]:
            logger = logging.getLogger(logger_name)
            # Only set level if it's still at default (WARNING for SQLAlchemy)
            if logger.level == logging.WARNING or logger.level == logging.NOTSET:
                logger.setLevel(logging.INFO)

        # Use logging instead of print to avoid stdout contamination
        logging.info("🔍 SQL Debug logging enabled")


def create_event_store(config: dict[str, Any] | None = None) -> Any | None:
    """
    Create an EventStore for MCP session management.

    For multi-pod deployments, uses Redis-backed storage to share session state
    across pods. For single-pod deployments, returns None (uses in-memory).

    Args:
        config: Optional config dict. If None, reads from MCP_STORE_CONFIG.

    Returns:
        EventStore instance if Redis URL is configured, None otherwise.
    """
    if config is None:
        config = MCP_STORE_CONFIG

    if not config.get("CACHE_REDIS_URL"):
        logging.info("EventStore: Using in-memory storage (single-pod mode)")
        return None

    try:
        from fastmcp.server.event_store import EventStore

        # Get prefix from config (allows Preset to customize for multi-tenancy)
        # Default prefix prevents key collisions in shared Redis environments
        prefix = config.get("event_store_prefix", "mcp_events_")

        # Create wrapped Redis store with prefix for key namespacing
        redis_store = _create_redis_store(config, prefix=prefix, wrap=True)
        if redis_store is None:
            logging.warning("Failed to create Redis store, falling back to in-memory")
            return None

        # Create EventStore with Redis backend
        event_store = EventStore(
            storage=redis_store,
            max_events_per_stream=config.get("event_store_max_events", 100),
            ttl=config.get("event_store_ttl", 3600),
        )

        logging.info("EventStore: Using Redis storage (multi-pod mode)")
        return event_store

    except ImportError as e:
        logging.error(
            "Failed to import EventStore dependencies: %s. "
            "Ensure fastmcp package is installed.",
            e,
        )
        return None
    except Exception as e:
        logging.error("Failed to create Redis EventStore: %s", e)
        return None


def _strip_titles(obj: Any, in_properties_map: bool = False) -> Any:
    """Recursively strip schema metadata ``title`` keys.

    Keeps real field names inside ``properties`` (e.g. a property literally
    named ``title``), while removing auto-generated schema title metadata.
    """
    if isinstance(obj, dict):
        result: dict[str, Any] = {}
        for key, value in obj.items():
            if key == "title" and not in_properties_map:
                continue
            result[key] = _strip_titles(value, in_properties_map=(key == "properties"))
        return result
    if isinstance(obj, list):
        return [_strip_titles(item, in_properties_map=False) for item in obj]
    return obj


def _simplify_optional_union(result: dict[str, Any]) -> dict[str, Any]:
    """Collapse ``anyOf``/``oneOf`` with exactly one non-null variant.

    Pydantic encodes ``Optional[X]`` as ``{"anyOf": [<X>, {"type": "null"}]}``.
    This replaces the union with the non-null variant while preserving any
    ``description`` or ``default`` from the parent node.
    """
    for union_key in ("anyOf", "oneOf"):
        variants = result.get(union_key)
        if not isinstance(variants, list) or len(variants) != 2:
            continue
        non_null = [v for v in variants if v.get("type") != "null"]
        if len(non_null) != 1:
            continue
        simplified = dict(non_null[0])
        for keep in ("description", "default"):
            if keep in result and keep not in simplified:
                simplified[keep] = result[keep]
        result.pop(union_key)
        result.pop("description", None)
        result.pop("default", None)
        result.update(simplified)
    return result


def _compact_schema(obj: Any) -> Any:
    """Collapse ``$defs`` and ``$ref`` pointers in a JSON Schema.

    Search results only need enough schema detail for the LLM to identify
    which tool to call and construct a basic invocation.  Full schemas
    (with all nested model definitions) are still available when the tool
    is actually invoked via ``call_tool``.

    Transformations applied:

    * ``$defs`` sections are removed entirely.
    * ``{"$ref": "..."}`` is replaced with ``{"type": "object"}``.
    * ``anyOf``/``oneOf`` lists containing only a ``$ref`` and
      ``{"type": "null"}`` (Pydantic's Optional encoding) are collapsed
      to the simplified non-null variant.
    """
    if isinstance(obj, list):
        return [_compact_schema(item) for item in obj]
    if not isinstance(obj, dict):
        return obj

    # Direct $ref → generic object type
    if "$ref" in obj:
        replacement: dict[str, Any] = {"type": "object"}
        if desc := obj.get("description"):
            replacement["description"] = desc
        return replacement

    result: dict[str, Any] = {}
    for key, value in obj.items():
        if key == "$defs":
            continue
        result[key] = _compact_schema(value)

    return _simplify_optional_union(result)


def _truncate_description(text: str, max_length: int) -> str:
    """Truncate a tool description for search results.

    Cuts at the last sentence boundary before *max_length*, or at
    *max_length* with an ellipsis if no sentence boundary is found.
    """
    if not text or len(text) <= max_length:
        return text
    # Try to cut at the last sentence boundary
    truncated = text[:max_length]
    last_period = truncated.rfind(". ")
    if last_period > max_length // 2:
        return truncated[: last_period + 1]
    return truncated.rstrip() + "..."


def _extract_parameter_names(input_schema: dict[str, Any]) -> str:
    """Extract top-level parameter names from a JSON Schema as a hint string.

    Returns a comma-separated string of property names from the schema's
    ``properties`` key, or an empty string if none are found.

    Example: ``"page, page_size, search, filters, select_columns"``
    """
    properties = input_schema.get("properties", {})
    if not properties:
        return ""
    return ", ".join(properties.keys())


def _serialize_tools_without_output_schema(
    tools: Sequence[Any],
) -> list[dict[str, Any]]:
    """Serialize tools to JSON, stripping outputSchema and titles to reduce tokens.

    LLMs only need inputSchema to call tools. outputSchema accounts for
    50-80% of the per-tool schema size, and auto-generated 'title' fields
    add ~12% bloat. Stripping both cuts search result tokens significantly.
    """
    results = []
    for tool in tools:
        data = tool.to_mcp_tool().model_dump(
            mode="json", exclude_none=True, exclude={"outputSchema"}
        )
        data.pop("outputSchema", None)
        if input_schema := data.get("inputSchema"):
            data["inputSchema"] = _strip_titles(input_schema)
        results.append(data)
    return results


def _build_summary_serializer(max_desc: int) -> Any:
    """Build a summary-mode serializer that omits ``inputSchema``.

    Returns a callable that serializes each tool to ``name``,
    ``description`` (optionally truncated), and a ``parameters_hint``
    string listing top-level parameter names.  ``inputSchema`` and
    ``outputSchema`` are stripped entirely.
    """

    def _summary_serializer(tools: Sequence[Any]) -> list[dict[str, Any]]:
        results = []
        for tool in tools:
            data = tool.to_mcp_tool().model_dump(
                mode="json", exclude_none=True, exclude={"outputSchema"}
            )
            data.pop("outputSchema", None)
            if input_schema := data.pop("inputSchema", None):
                hint = _extract_parameter_names(input_schema)
                if hint:
                    data["parameters_hint"] = hint
            if max_desc and (desc := data.get("description")):
                data["description"] = _truncate_description(desc, max_desc)
            results.append(data)
        return results

    return _summary_serializer


def _tool_allowed_for_current_user(tool: Any) -> bool:
    """Return whether the current Flask user can see this tool in search results."""
    try:
        from flask import current_app, g

        if not current_app.config.get("MCP_RBAC_ENABLED", True):
            return True

        from superset import security_manager
        from superset.mcp_service.auth import (
            CLASS_PERMISSION_ATTR,
            METHOD_PERMISSION_ATTR,
            PERMISSION_PREFIX,
        )

        tool_func = getattr(tool, "fn", None)
        if tool_requires_data_model_metadata_access(tool_func):
            return user_can_view_data_model_metadata()

        class_permission_name = getattr(tool_func, CLASS_PERMISSION_ATTR, None)
        if not class_permission_name:
            return True

        if not getattr(g, "user", None):
            return False

        method_permission_name = getattr(tool_func, METHOD_PERMISSION_ATTR, "read")
        permission_name = f"{PERMISSION_PREFIX}{method_permission_name}"
        return security_manager.can_access(permission_name, class_permission_name)
    except (AttributeError, RuntimeError, ValueError):
        logger.debug("Could not evaluate tool search permission", exc_info=True)
        return False


def _filter_tools_by_current_user_permission(tools: Sequence[Any]) -> list[Any]:
    """Filter search candidates to tools the current user can execute."""
    return [tool for tool in tools if _tool_allowed_for_current_user(tool)]


def _create_search_result_serializer(
    config: dict[str, Any],
) -> Any:
    """Build a search-result serializer from the tool-search config.

    When ``include_schemas`` is False (default), delegates to
    :func:`_build_summary_serializer`, which strips ``inputSchema``
    entirely and adds a ``parameters_hint`` field with comma-separated
    top-level parameter names.  This reduces per-search token cost by
    ~80% vs compact mode while still conveying what parameters a tool
    accepts.

    When ``include_schemas`` is True, the full ``compact_schemas``/
    ``max_description_length`` pipeline applies (existing behavior):

    * ``$defs`` sections and ``$ref`` pointers are collapsed when
      ``compact_schemas`` is True (see :func:`_compact_schema`).
    * Tool descriptions are truncated to ``max_description_length`` chars.

    Full schemas remain available when the tool is invoked via ``call_tool``.
    """
    include_schemas = config.get("include_schemas", False)

    if not include_schemas:
        max_desc = config.get("max_description_length", 300)
        return _build_summary_serializer(max_desc)

    # include_schemas=True: apply full compact_schemas/max_description_length pipeline
    compact = config.get("compact_schemas", True)
    # Description truncation defaults to 300 when compact_schemas is on,
    # but is disabled when compact_schemas is off (unless explicitly set).
    max_desc_default = 300 if compact else 0
    max_desc = config.get("max_description_length", max_desc_default)

    if not compact and not max_desc:
        return _serialize_tools_without_output_schema

    def _serializer(tools: Sequence[Any]) -> list[dict[str, Any]]:
        results = _serialize_tools_without_output_schema(tools)
        for data in results:
            if compact:
                if input_schema := data.get("inputSchema"):
                    data["inputSchema"] = _compact_schema(input_schema)
            if max_desc and (desc := data.get("description")):
                data["description"] = _truncate_description(desc, max_desc)
        return results

    return _serializer


def _fix_call_tool_arguments(tool: Any) -> Any:
    """Fix anyOf schema in call_tool ``arguments`` for MCP bridge compatibility.

    FastMCP's BaseSearchTransform defines ``arguments`` as
    ``dict[str, Any] | None`` which emits an ``anyOf`` JSON Schema.
    Some MCP bridges (mcp-remote, Claude Desktop) don't handle ``anyOf``
    and strip it, leaving the field without a ``type`` — causing all
    call_tool invocations to fail with "Input should be a valid dictionary".

    Replaces the ``anyOf`` with a flat ``type: object``.
    """
    if "arguments" in (props := (tool.parameters or {}).get("properties", {})):
        props["arguments"] = {
            "additionalProperties": True,
            "default": None,
            "description": "Arguments to pass to the tool",
            "type": "object",
        }
    return tool


def _normalize_call_tool_arguments(
    arguments: dict[str, Any] | None,
    tool_schema: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """JSON-serialize dict/list values when the tool schema accepts both
    string and object variants (anyOf or oneOf with a string type).

    When the BM25/regex ``call_tool`` proxy forwards arguments to the
    actual tool, dict/list values must be serialized if the tool's schema
    declares ``anyOf``/``oneOf`` with a string variant
    (e.g. ``request: str | RequestModel``).

    Without this, the MCP transport calls ``bytes(dict, 'utf-8')``
    which raises ``TypeError: encoding without a string argument``.
    """
    if not arguments or not isinstance(tool_schema, dict):
        return arguments

    properties = tool_schema.get("properties", {})
    result = dict(arguments)
    for key, value in result.items():
        if not isinstance(value, (dict, list)) or key not in properties:
            continue
        prop_schema = properties[key]
        variants = prop_schema.get("oneOf") or prop_schema.get("anyOf") or []
        has_string = any(v.get("type") == "string" for v in variants)
        if has_string:
            result[key] = json.dumps(value)
    return result


def _apply_tool_search_transform(mcp_instance: Any, config: dict[str, Any]) -> None:
    """Apply tool search transform to reduce initial context size.

    When enabled, replaces the full tool catalog with a search interface.
    LLMs see only synthetic search/call tools plus pinned tools, and
    discover other tools on-demand via natural language search.

    Uses subclassing (not monkey-patching) to override ``_make_call_tool``
    and fix the ``arguments`` schema for MCP bridge compatibility, and
    normalize forwarded arguments to prevent encoding errors.

    NOTE: ``_make_call_tool`` is a private API in FastMCP 3.x
    (fastmcp>=3.1.0,<4.0). If FastMCP changes or removes this method
    in a future major version, these subclasses will need to be updated.
    """
    from fastmcp.server.context import Context
    from fastmcp.tools.tool import Tool, ToolResult

    strategy = config.get("strategy", "bm25")
    kwargs: dict[str, Any] = {
        "max_results": config.get("max_results", 5),
        "always_visible": config.get("always_visible", []),
        "search_tool_name": config.get("search_tool_name", "search_tools"),
        "call_tool_name": config.get("call_tool_name", "call_tool"),
        "search_result_serializer": _create_search_result_serializer(config),
    }

    def _make_normalizing_call_tool(transform: Any) -> Tool:
        """Create a call_tool proxy that normalizes arguments before forwarding.

        This fixes two issues:
        1. anyOf schema incompatibility with MCP bridges (schema fix).
        2. ``encoding without a string argument`` TypeError when dict/list
           values are forwarded for parameters declared as
           ``str | SomeModel`` (argument normalization).
        """

        async def call_tool(
            name: Annotated[str, "The name of the tool to call"],
            arguments: Annotated[
                dict[str, Any] | None, "Arguments to pass to the tool"
            ] = None,
            ctx: Context = None,
        ) -> ToolResult:
            """Call a tool by name with the given arguments.

            Use this to execute tools discovered via search_tools.
            """
            if name in {transform._call_tool_name, transform._search_tool_name}:
                raise ValueError(
                    f"'{name}' is a synthetic search tool and cannot be "
                    f"called via the call_tool proxy"
                )
            if arguments:
                target_tool = await ctx.fastmcp.get_tool(name)
                if target_tool is not None:
                    arguments = _normalize_call_tool_arguments(
                        arguments, target_tool.parameters
                    )
            return await ctx.fastmcp.call_tool(name, arguments)

        tool = Tool.from_function(fn=call_tool, name=transform._call_tool_name)
        return _fix_call_tool_arguments(tool)

    transform = _create_search_transform(
        strategy=strategy,
        kwargs=kwargs,
        make_normalizing_call_tool=_make_normalizing_call_tool,
    )

    mcp_instance.add_transform(transform)
    logger.info(
        "Tool search transform enabled (strategy=%s, max_results=%d, pinned=%s)",
        strategy,
        kwargs["max_results"],
        kwargs["always_visible"],
    )


def _create_search_transform(
    *,
    strategy: str,
    kwargs: dict[str, Any],
    make_normalizing_call_tool: Callable[[Any], Any],
) -> Any:
    """Create the configured search transform with tool-permission filtering."""
    from fastmcp.server.context import Context

    if strategy == "regex":
        from fastmcp.server.transforms.search import RegexSearchTransform

        class _FixedRegexSearchTransform(RegexSearchTransform):
            """Regex search with fixed call_tool schema and arg normalization."""

            async def _get_visible_tools(self, ctx: Context) -> Sequence[Any]:
                tools = await super()._get_visible_tools(ctx)
                return _filter_tools_by_current_user_permission(tools)

            def _make_call_tool(self) -> Any:
                return make_normalizing_call_tool(self)

        return _FixedRegexSearchTransform(**kwargs)

    from fastmcp.server.transforms.search import BM25SearchTransform

    class _FixedBM25SearchTransform(BM25SearchTransform):
        """BM25 search with fixed call_tool schema and arg normalization."""

        async def _get_visible_tools(self, ctx: Context) -> Sequence[Any]:
            tools = await super()._get_visible_tools(ctx)
            return _filter_tools_by_current_user_permission(tools)

        def _make_call_tool(self) -> Any:
            return make_normalizing_call_tool(self)

    return _FixedBM25SearchTransform(**kwargs)


def _create_auth_provider(flask_app: Any) -> Any | None:
    """Create an auth provider from Flask app config.

    Tries MCP_AUTH_FACTORY first, then falls back to the default factory
    when MCP_AUTH_ENABLED is True.
    """
    auth_provider = None
    if auth_factory := flask_app.config.get("MCP_AUTH_FACTORY"):
        try:
            auth_provider = auth_factory(flask_app)
            logger.info(
                "Auth provider created from MCP_AUTH_FACTORY: %s",
                type(auth_provider).__name__ if auth_provider else "None",
            )
        except Exception:
            # Do not log the exception — it may contain secrets
            logger.error("Failed to create auth provider from MCP_AUTH_FACTORY")
    elif flask_app.config.get("MCP_AUTH_ENABLED", False):
        from superset.mcp_service.mcp_config import (
            create_default_mcp_auth_factory,
        )

        try:
            auth_provider = create_default_mcp_auth_factory(flask_app)
            logger.info(
                "Auth provider created from default factory: %s",
                type(auth_provider).__name__ if auth_provider else "None",
            )
        except Exception:
            # Do not log the exception — it may contain secrets
            logger.error("Failed to create auth provider from default factory")
    return auth_provider


def build_middleware_list() -> list[Middleware]:
    """Build the core MCP middleware list in the correct order.

    FastMCP wraps handlers so that the FIRST-added middleware is
    outermost.  Order here is outermost → innermost:

    1. StructuredContentStripper — safety net, converts exceptions
       to safe ToolResult text for transports that can't encode errors
    2. LoggingMiddleware — logs tool calls with success/failure status
    3. GlobalErrorHandler — catches tool exceptions, raises ToolError
    """
    return [
        StructuredContentStripperMiddleware(),
        LoggingMiddleware(),
        GlobalErrorHandlerMiddleware(),
    ]


def run_server(
    host: str = "127.0.0.1",
    port: int = 5008,
    debug: bool = False,
    use_factory_config: bool = False,
    event_store_config: dict[str, Any] | None = None,
) -> None:
    """
    Run the MCP service server with FastMCP endpoints.
    Uses streamable-http transport for HTTP server mode.

    For multi-pod deployments, configure MCP_EVENT_STORE_CONFIG with Redis URL
    to share session state across pods.

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug logging
        use_factory_config: Use configuration from get_mcp_factory_config()
        event_store_config: Optional EventStore configuration dict.
            If None, reads from MCP_EVENT_STORE_CONFIG.
    """

    configure_logging(debug)
    _suppress_third_party_warnings()

    # DO NOT IMPORT TOOLS HERE!! IMPORT THEM IN app.py!!!!!

    if use_factory_config:
        # Use factory configuration for customization
        logging.info("Creating MCP app from factory configuration...")
        factory_config = get_mcp_factory_config()
        mcp_instance = create_mcp_app(**factory_config)

        # Apply tool search transform if configured
        tool_search_config = MCP_TOOL_SEARCH_CONFIG
        if tool_search_config.get("enabled", False):
            _apply_tool_search_transform(mcp_instance, tool_search_config)
    else:
        # Use default initialization with auth from Flask config
        logging.info("Creating MCP app with default configuration...")
        from superset.mcp_service.caching import create_response_caching_middleware
        from superset.mcp_service.flask_singleton import get_flask_app

        flask_app = get_flask_app()
        auth_provider = _create_auth_provider(flask_app)

        middleware_list = build_middleware_list()

        # Add optional middleware (innermost, closest to tool)
        size_guard_middleware = create_response_size_guard_middleware()
        if size_guard_middleware:
            middleware_list.append(size_guard_middleware)

        if caching_middleware := create_response_caching_middleware():
            middleware_list.append(caching_middleware)

        mcp_instance = init_fastmcp_server(
            auth=auth_provider,
            middleware=middleware_list or None,
        )

        # Apply tool search transform if configured
        tool_search_config = flask_app.config.get(
            "MCP_TOOL_SEARCH_CONFIG", MCP_TOOL_SEARCH_CONFIG
        )
        if tool_search_config.get("enabled", False):
            _apply_tool_search_transform(mcp_instance, tool_search_config)
            # Ensure the configured search tool name is excluded from the
            # response size guard (search results are intentionally large)
            if size_guard_middleware:
                search_name = tool_search_config.get("search_tool_name", "search_tools")
                size_guard_middleware.excluded_tools.add(search_name)

    # Create EventStore for session management (Redis for multi-pod, None for in-memory)
    event_store = create_event_store(event_store_config)

    env_key = f"FASTMCP_RUNNING_{port}"
    if not os.environ.get(env_key):
        os.environ[env_key] = "1"
        try:
            logging.info("Starting FastMCP on %s:%s", host, port)

            if event_store is not None:
                # Multi-pod: Use http_app with Redis EventStore, run with uvicorn
                logging.info("Running in multi-pod mode with Redis EventStore")
                app = mcp_instance.http_app(
                    transport="streamable-http",
                    event_store=event_store,
                    stateless_http=True,
                )
                uvicorn.run(app, host=host, port=port)
            else:
                # Single-pod mode: Use built-in run() with in-memory sessions
                logging.info("Running in single-pod mode with in-memory sessions")
                mcp_instance.run(
                    transport="streamable-http",
                    host=host,
                    port=port,
                    stateless_http=True,
                )
        except Exception as e:
            logging.error("FastMCP failed: %s", e)
            os.environ.pop(env_key, None)
    else:
        logging.info("FastMCP already running on %s:%s", host, port)


if __name__ == "__main__":
    run_server()
