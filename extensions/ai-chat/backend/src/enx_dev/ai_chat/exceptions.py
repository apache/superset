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
"""Exceptions for the AI chat gateway.

Every exception carries a stable ``error_code`` so the frontend can react to
specific failures without parsing prose, and a message safe to return to the
browser: no tracebacks, no provider payloads, no secrets.
"""

from __future__ import annotations


class AiChatError(Exception):
    """Base class for AI chat gateway errors."""

    error_code = "AI_CHAT_ERROR"
    status = 500

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.default_message)
        self.message = message or self.default_message

    default_message = "An unexpected AI chat error occurred."


class AiChatDisabledError(AiChatError):
    """The AI chat feature is not enabled in configuration."""

    error_code = "AI_CHAT_DISABLED"
    status = 404
    default_message = (
        "AI chat is not enabled on this Superset instance. "
        "An administrator can enable it via AI_CHAT_CONFIG."
    )


class AiChatConfigurationError(AiChatError):
    """The AI chat feature is enabled but misconfigured."""

    error_code = "AI_CHAT_MISCONFIGURED"
    status = 422
    default_message = (
        "The AI chat provider is not configured correctly. "
        "Please contact an administrator."
    )


class AiChatIdentityMismatchError(AiChatConfigurationError):
    """MCP would resolve tool calls to a different user than the session user.

    Raised when ``MCP_DEV_USERNAME``, which takes priority over the ``g.user``
    fallback in the MCP authentication chain, names a user other than the
    authenticated web user. Executing tools in that state would confuse
    identities, so the gateway fails closed.
    """

    error_code = "AI_CHAT_IDENTITY_MISMATCH"
    default_message = (
        "MCP tool execution is unavailable: the MCP service is configured "
        "with a fixed development user that differs from your account."
    )


class AiChatProviderError(AiChatError):
    """The model provider request failed."""

    error_code = "AI_CHAT_PROVIDER_ERROR"
    status = 422
    default_message = "The AI model provider request failed. Please try again."


class AiChatProviderTimeoutError(AiChatProviderError):
    """The model provider did not respond within the configured timeout."""

    error_code = "AI_CHAT_PROVIDER_TIMEOUT"
    default_message = "The AI model provider timed out. Please try again."


class AiChatRequestTooLargeError(AiChatError):
    """The request exceeds configured size limits."""

    error_code = "AI_CHAT_REQUEST_TOO_LARGE"
    status = 400
    default_message = (
        "The conversation is too large. Start a new conversation and try again."
    )


class AiChatUnsupportedPrincipalError(AiChatError):
    """The requester has no database-backed account.

    Guest tokens authenticate a user object without a numeric id, so an
    approval cannot be bound to an account. Read-only chat still works; only
    the mutating path needs an owner to bind to.
    """

    error_code = "AI_CHAT_UNSUPPORTED_PRINCIPAL"
    status = 403
    default_message = (
        "Actions that change Superset are only available to signed-in "
        "accounts. You can still ask questions."
    )


class AiChatApprovalError(AiChatError):
    """Base class for approval failures."""

    error_code = "AI_CHAT_APPROVAL_ERROR"
    status = 400
    default_message = "The approval is invalid."


class AiChatApprovalExpiredError(AiChatApprovalError):
    """The approval does not exist, was already used, or has expired.

    A single message covers all three cases so the response cannot be used to
    probe which approvals exist.
    """

    error_code = "AI_CHAT_APPROVAL_EXPIRED"
    default_message = (
        "This approval is no longer valid. It may have expired or already "
        "been used. Ask the assistant to propose the action again."
    )


class AiChatApprovalMismatchError(AiChatApprovalError):
    """The approval exists but is bound to different parameters.

    Raised when the user, conversation, tool name, or tool arguments differ
    from what was approved. Changing any of these invalidates the approval.
    """

    error_code = "AI_CHAT_APPROVAL_MISMATCH"
    default_message = (
        "The requested action does not match what was approved. "
        "Ask the assistant to propose the action again."
    )
