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
"""REST API for the AI chat gateway.

All routes require an authenticated session and the ``can read on AiChat``
permission, which lets operators grant or revoke the assistant per role.
Object-level authorization for everything the assistant does is enforced by
the MCP tools themselves under the requesting user.

Routes are served under ``/extensions/{publisher}/{name}/`` — the ``@api``
decorator resolves the prefix from the ambient extension context, so the
class never spells out its own mount point.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from typing import Any

from enx_dev.ai_chat.exceptions import (
    AiChatDisabledError,
    AiChatError,
    AiChatIdentityMismatchError,
)
from enx_dev.ai_chat.mcp_bridge import (
    assert_identity_alignment,
    is_mcp_available,
    list_allowed_tools,
)
from enx_dev.ai_chat.orchestrator import ChatTurnRunner
from enx_dev.ai_chat.providers import is_provider_configured
from enx_dev.ai_chat.schemas import (
    ChatRequestSchema,
    ToolApprovalRequestSchema,
)
from enx_dev.ai_chat.settings import get_ai_chat_config, get_tool_approval_mode
from enx_dev.ai_chat.types import ToolCall
from flask import g, request, Response
from flask_appbuilder.api import expose, protect, safe
from marshmallow import Schema, ValidationError
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api

logger = logging.getLogger(__name__)


@api(
    id="ai_chat",
    name="AI Chat",
    description="Gateway backing the AI assistant chat extension",
)
class AiChatRestApi(RestApi):
    """Gateway endpoints backing the AI assistant chat extension."""

    # Flask-AppBuilder exempts APIs from CSRF by default, on the assumption
    # that they are token-authenticated. These routes are reached from the
    # browser with the session cookie, so the exemption has to be lifted --
    # otherwise any site could POST a conversation turn on the user's behalf.
    csrf_exempt = False
    class_permission_name = "AiChat"
    method_permission_name = {
        "config": "read",
        "chat": "read",
        "tool_approval": "read",
    }
    openapi_spec_tag = "AI Chat"
    openapi_spec_component_schemas = (
        ChatRequestSchema,
        ToolApprovalRequestSchema,
    )

    chat_request_schema = ChatRequestSchema()
    tool_approval_request_schema = ToolApprovalRequestSchema()

    def _check_enabled(self) -> None:
        if not get_ai_chat_config().get("ENABLED"):
            raise AiChatDisabledError()

    def _check_message_count(self, messages: list[dict[str, Any]]) -> None:
        max_messages = int(get_ai_chat_config().get("MAX_MESSAGES_PER_REQUEST") or 80)
        if len(messages) > max_messages:
            raise ValidationError(
                {"messages": [f"At most {max_messages} messages per request."]}
            )

    def _error_response(self, ex: AiChatError) -> Response:
        return self.response(ex.status, message=ex.message, error_code=ex.error_code)

    @staticmethod
    def _mcp_status_and_tools(
        enabled: bool,
    ) -> tuple[bool, list[dict[str, Any]]]:
        """Return whether tool execution is usable, and the visible tools.

        Tools are reported as unavailable when the MCP identity guard fails,
        since the gateway refuses tool execution in that state and listing
        tools the user cannot invoke would misrepresent the session.
        """
        if not (enabled and is_mcp_available()):
            return False, []
        try:
            assert_identity_alignment(g.user)
        except AiChatIdentityMismatchError:
            return False, []
        try:
            specs = asyncio.run(list_allowed_tools())
        except Exception:  # pylint: disable=broad-except
            logger.exception("AI chat tool listing failed")
            specs = []
        return True, [
            {
                "name": spec.name,
                "title": spec.title,
                "classification": spec.classification.value,
            }
            for spec in specs
        ]

    def _run_turn(
        self,
        schema: Schema,
        run: Callable[[ChatTurnRunner, dict[str, Any]], list[dict[str, Any]]],
    ) -> Response:
        """Shared body for the two turn-producing routes.

        Both validate the same envelope and return the same result shape, and
        differ only in schema and runner entry point. Route registration,
        authentication and CSRF stay on the public methods.
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            self._check_enabled()
            payload = schema.load(request.json)
            self._check_message_count(payload["messages"])
            runner = ChatTurnRunner(
                user=g.user,
                conversation_id=payload["conversation_id"],
                raw_messages=payload["messages"],
                context=payload.get("context"),
            )
            events = run(runner, payload)
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        except AiChatError as ex:
            return self._error_response(ex)
        return self.response(
            200,
            result={
                "conversation_id": payload["conversation_id"],
                "events": events,
            },
        )

    @expose("/config", methods=("GET",))
    @protect()
    @safe
    def config(self) -> Response:
        """Get AI chat availability and capability information.
        ---
        get:
          summary: Get AI chat availability and capability information
          description: >-
            Returns whether the AI chat feature is enabled, whether the model
            provider is configured, whether MCP tool execution is available,
            the classified tool list, and the configured tool approval mode.
            The approval mode is informational, for what the UI displays; the
            server enforces it regardless. Never includes secrets.
          responses:
            200:
              description: AI chat configuration status
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            401:
              description: Unauthorized
            403:
              description: Forbidden
            500:
              description: Fatal error
        """
        config = get_ai_chat_config()
        enabled = bool(config.get("ENABLED"))
        try:
            approval_mode = get_tool_approval_mode(config)
        except AiChatError as ex:
            return self._error_response(ex)
        tools_available, tools = self._mcp_status_and_tools(enabled)
        return self.response(
            200,
            result={
                "enabled": enabled,
                "provider": config.get("PROVIDER") if enabled else None,
                "provider_configured": enabled and is_provider_configured(config),
                "mcp_available": tools_available,
                # Informational: the UI describes the instance with it, and
                # the server still decides which calls are gated.
                "tool_approval_mode": approval_mode.value,
                "tools": tools,
                "limits": {
                    "max_messages_per_request": int(
                        config.get("MAX_MESSAGES_PER_REQUEST") or 80
                    ),
                    "max_input_chars": int(config.get("MAX_INPUT_CHARS") or 100_000),
                },
            },
        )

    @expose("/chat", methods=("POST",))
    @protect()
    @safe
    def chat(self) -> Response:
        """Run one conversation turn.
        ---
        post:
          summary: Run one AI chat conversation turn
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ChatRequestSchema'
          responses:
            200:
              description: Ordered protocol events for this turn
            400:
              description: Bad request
            401:
              description: Unauthorized
            403:
              description: Forbidden
            404:
              description: Not found
            422:
              description: Could not process entity
            500:
              description: Fatal error
        """
        return self._run_turn(
            self.chat_request_schema,
            lambda runner, _payload: runner.run_chat(),
        )

    @expose("/tool_approval", methods=("POST",))
    @protect()
    @safe
    def tool_approval(self) -> Response:
        """Approve or reject a proposed tool call and continue the turn.
        ---
        post:
          summary: Approve or reject a proposed AI chat tool call
          description: >-
            Consumes a single-use, server-generated approval bound to the
            current user, conversation, tool name and exact arguments. On
            approval the tool executes under the user's authorization and
            the turn continues; on rejection the assistant is informed and
            responds without executing. Only reachable when TOOL_APPROVAL_MODE
            gates something; with approval disabled, no approval exists to
            consume and the request is refused.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ToolApprovalRequestSchema'
          responses:
            200:
              description: Ordered protocol events for the continuation
            400:
              description: Bad request
            401:
              description: Unauthorized
            403:
              description: Forbidden
            404:
              description: Not found
            422:
              description: Could not process entity
            500:
              description: Fatal error
        """

        def run(
            runner: ChatTurnRunner, payload: dict[str, Any]
        ) -> list[dict[str, Any]]:
            return runner.run_approval(
                approval_id=payload["approval_id"],
                decision=payload["decision"],
                tool_call=ToolCall(
                    id=payload["tool_call"]["id"],
                    name=payload["tool_call"]["name"],
                    arguments=payload["tool_call"].get("arguments") or {},
                ),
            )

        return self._run_turn(self.tool_approval_request_schema, run)
