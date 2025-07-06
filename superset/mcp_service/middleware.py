import logging
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.exceptions import ToolError
from superset.extensions import event_logger
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)

class LoggingMiddleware(Middleware):
    """
    Middleware that logs every MCP message (request and response) using Superset's event logger.
    This matches the core Superset audit log system (Action Log UI, logs table, custom loggers).
    Also attempts to log dashboard_id, chart_id (slice_id), and dataset_id if present in tool params.
    """
    async def on_message(self, context: MiddlewareContext, call_next):
        # Extract agent_id and user_id
        agent_id = None
        user_id = None
        dashboard_id = None
        slice_id = None
        dataset_id = None
        params = getattr(context.message, "params", {}) or {}
        if hasattr(context, "metadata") and context.metadata:
            agent_id = context.metadata.get("agent_id")
        if not agent_id and hasattr(context, "session") and context.session:
            agent_id = getattr(context.session, "agent_id", None)
        try:
            user_id = get_user_id()
        except Exception:
            user_id = None
        # Try to extract IDs from params
        if isinstance(params, dict):
            dashboard_id = params.get("dashboard_id")
            # Chart ID may be under 'chart_id' or 'slice_id'
            slice_id = params.get("chart_id") or params.get("slice_id")
            dataset_id = params.get("dataset_id")
        # Log to Superset's event logger (DB, Action Log UI, or custom)
        event_logger.log(
            user_id=user_id,
            action="mcp_tool_call",
            dashboard_id=dashboard_id,
            duration_ms=None,
            slice_id=slice_id,
            referrer=None,
            curated_payload={
                "tool": getattr(context.message, "name", None),
                "agent_id": agent_id,
                "params": params,
                "method": context.method,
                "dashboard_id": dashboard_id,
                "slice_id": slice_id,
                "dataset_id": dataset_id,
            }
        )
        # (Optional) also log to standard logger for debugging
        logger.info(f"MCP tool call: tool={getattr(context.message, 'name', None)}, agent_id={agent_id}, user_id={user_id}, method={context.method}, dashboard_id={dashboard_id}, slice_id={slice_id}, dataset_id={dataset_id}")
        return await call_next(context)

class PrivateToolMiddleware(Middleware):
    """
    Middleware that blocks access to tools tagged as 'private'.
    """
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)
        if "private" in getattr(tool, "tags", set()):
            raise ToolError(f"Access denied to private tool: {context.message.name}")
        return await call_next(context) 