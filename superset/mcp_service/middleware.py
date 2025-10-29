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
Minimal middleware for MCP service.
This provides basic error handling for MCP tool calls.

Future enhancements (to be added in separate PRs):
- Rate limiting middleware
- Field-level permissions middleware
- Comprehensive audit logging middleware
- Private tool blocking middleware
- Advanced error sanitization
"""

import logging
from typing import Any, Awaitable, Callable

from fastmcp.exceptions import ToolError
from fastmcp.server.middleware import Middleware, MiddlewareContext

logger = logging.getLogger(__name__)


class BasicErrorHandlerMiddleware(Middleware):
    """
    Basic error handler middleware for MCP tools.

    Provides simple error handling and logging for tool calls.

    TODO (future PR): Add error sanitization for security
    TODO (future PR): Add comprehensive error categorization
    TODO (future PR): Add integration with Superset event logging
    """

    async def on_message(
        self,
        context: MiddlewareContext,
        call_next: Callable[[MiddlewareContext], Awaitable[Any]],
    ) -> Any:
        """Handle messages with basic error handling"""
        tool_name = getattr(context.message, "name", "unknown")

        try:
            return await call_next(context)
        except Exception as e:
            # Log the error
            logger.error(
                "MCP tool error: tool=%s, error_type=%s, error=%s",
                tool_name,
                type(e).__name__,
                str(e),
            )

            # If it's already a ToolError, re-raise it
            if isinstance(e, ToolError):
                raise

            # Convert to ToolError for consistent error format
            raise ToolError(f"Error in {tool_name}: {str(e)}") from e
