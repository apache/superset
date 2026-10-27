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
"""Request and response schemas for the AI assistant API."""

from __future__ import annotations

from marshmallow import fields, Schema, validate

from superset.ai.types import MessageRole, ThreadStatus

#: Matches the ``title`` column width.
TITLE_MAX_LENGTH = 512

#: Matches the ``request_id`` column width.
REQUEST_ID_MAX_LENGTH = 96

#: A generous ceiling on one user message. Long enough for a pasted query plus
#: context, short enough that a runaway client cannot fill the metadata database
#: with a single request.
CONTENT_MAX_LENGTH = 100_000


class ThreadPostSchema(Schema):
    """Create a conversation."""

    title = fields.String(
        allow_none=True,
        validate=validate.Length(min=1, max=TITLE_MAX_LENGTH),
        metadata={"description": "Optional human-readable title."},
    )
    agent_key = fields.String(
        allow_none=True,
        metadata={"description": "Agent profile to use for this conversation."},
    )


class ThreadPutSchema(Schema):
    """Rename or archive a conversation."""

    title = fields.String(
        allow_none=True,
        validate=validate.Length(min=1, max=TITLE_MAX_LENGTH),
    )
    status = fields.String(
        allow_none=True,
        validate=validate.OneOf([s.value for s in ThreadStatus]),
    )


class MessagePostSchema(Schema):
    """Post a user message and start a run."""

    content = fields.String(
        required=True,
        validate=validate.Length(min=1, max=CONTENT_MAX_LENGTH),
        metadata={"description": "The user's message."},
    )
    request_id = fields.String(
        allow_none=True,
        validate=validate.Length(min=1, max=REQUEST_ID_MAX_LENGTH),
        metadata={
            "description": (
                "Client-generated idempotency key. Re-posting the same key "
                "returns the original message rather than creating a duplicate."
            )
        },
    )
    agent_key = fields.String(
        allow_none=True,
        metadata={"description": "Agent profile for this turn."},
    )
    model = fields.String(
        allow_none=True,
        metadata={
            "description": (
                "Pin a specific model, which must be one the deployment has "
                "configured. Omit to use the profile's model tier."
            )
        },
    )
    page_context = fields.Dict(
        allow_none=True,
        metadata={
            "description": (
                "What the user is looking at: the page type, and for SQL Lab the "
                "editor's SQL and tables, for a chart its datasource and controls, "
                "for a dashboard its title, active tab, charts, active filters and "
                "markdown. Without it the assistant cannot answer questions like "
                "'why is this number wrong' about the thing on screen."
            )
        },
    )


class CancelPostSchema(Schema):
    """Ask a run to stop."""

    run_id = fields.String(required=True)


class FeedbackPostSchema(Schema):
    """Rate an assistant message."""

    message_uuid = fields.String(required=True)
    liked = fields.Boolean(required=True)
    comment = fields.String(allow_none=True, validate=validate.Length(max=5_000))


class SuggestedPromptsPostSchema(Schema):
    """Ask for openers for the page the user is on."""

    page_context = fields.Dict(
        allow_none=True,
        metadata={
            "description": (
                "What the user is looking at, in the same shape the message "
                "endpoint accepts. Suggestions name what is on screen, so "
                "omitting this yields an empty list rather than a generic one."
            )
        },
    )


class MessageResponseSchema(Schema):
    """One stored message."""

    uuid = fields.String()
    role = fields.String(validate=validate.OneOf([r.value for r in MessageRole]))
    content = fields.String()
    status = fields.String()
    created_on = fields.DateTime()
    #: Tool calls, token usage and outcome. Present so the transcript can show
    #: what the assistant did — including the SQL it ran — after a reload.
    extra = fields.Dict()
    #: The reading user's own rating, or null. Drives the thumb state so a
    #: verdict left before a reload is shown rather than offered again.
    liked = fields.Boolean(allow_none=True)


class ThreadResponseSchema(Schema):
    """One conversation, without its messages."""

    uuid = fields.String()
    title = fields.String(allow_none=True)
    status = fields.String()
    agent_key = fields.String(allow_none=True)
    message_count = fields.Integer()
    created_on = fields.DateTime()
    changed_on = fields.DateTime()


class ThreadDetailResponseSchema(ThreadResponseSchema):
    """One conversation with its messages."""

    messages = fields.List(fields.Nested(MessageResponseSchema))


class AgentResponseSchema(Schema):
    """One selectable agent profile."""

    key = fields.String()
    name = fields.String()
    description = fields.String()
    tools = fields.List(fields.String())


class RunAcceptedResponseSchema(Schema):
    """Acknowledgement that a turn was accepted."""

    message_uuid = fields.String()
    assistant_message_uuid = fields.String()
    run_id = fields.String()
