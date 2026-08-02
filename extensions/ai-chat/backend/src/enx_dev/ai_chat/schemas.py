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
"""Request schemas for the AI chat gateway.

Static hard bounds live here. The gateway enforces the configurable limits,
such as message count and total input size, on top of them.
"""

from marshmallow import fields, Schema
from marshmallow.validate import Length, OneOf, Regexp

# Client-generated opaque conversation handle
CONVERSATION_ID_REGEX = r"^[A-Za-z0-9_-]{8,64}$"

# Hard bound regardless of configuration
MAX_MESSAGES_HARD_LIMIT = 200

# A display name is a label rather than a payload, so anything longer is an
# accident or an attempt to smuggle instructions into the prompt.
RESOURCE_NAME_MAX_CHARS = 200
MAX_MESSAGE_CONTENT_CHARS = 100_000

# Objects the user pins to the conversation by dragging them in. Kept small:
# every one of them is restated in the prompt on every turn.
MAX_CONTEXT_REFERENCES = 5

# Image attachments. Clients downscale before sending; these are the bounds
# the gateway accepts regardless of what the client did.
ALLOWED_IMAGE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"]
MAX_IMAGES_PER_MESSAGE = 3
# Roughly 3 MB of binary once decoded, below the tightest provider per-image
# limit.
MAX_IMAGE_BASE64_CHARS = 4_000_000
# Across every message of one request, so a replayed history stays bounded
MAX_TOTAL_IMAGE_BASE64_CHARS = 8_000_000


class ToolCallSchema(Schema):
    id = fields.String(required=True, validate=Length(1, 128))
    name = fields.String(required=True, validate=Length(1, 128))
    arguments = fields.Dict(load_default=dict)


class ImageAttachmentSchema(Schema):
    """An image attached by the user, base64-encoded by the browser."""

    media_type = fields.String(
        required=True,
        validate=OneOf(ALLOWED_IMAGE_MEDIA_TYPES),
        metadata={"description": "Media type of the attached image."},
    )
    data = fields.String(
        required=True,
        # Strict base64 alphabet, since the value is forwarded to the model
        # provider and nothing else is accepted through this field.
        validate=[
            Length(1, MAX_IMAGE_BASE64_CHARS),
            Regexp(r"^[A-Za-z0-9+/]+={0,2}$"),
        ],
    )
    name = fields.String(
        load_default=None, allow_none=True, validate=Length(max=RESOURCE_NAME_MAX_CHARS)
    )


class ChatMessageSchema(Schema):
    role = fields.String(
        required=True,
        validate=OneOf(["user", "assistant", "tool"]),
        metadata={"description": "Message author role."},
    )
    content = fields.String(
        load_default="",
        allow_none=True,
        validate=Length(max=MAX_MESSAGE_CONTENT_CHARS),
    )
    tool_calls = fields.List(
        fields.Nested(ToolCallSchema),
        load_default=list,
        validate=Length(max=16),
    )
    tool_call_id = fields.String(
        load_default=None, allow_none=True, validate=Length(max=128)
    )
    name = fields.String(load_default=None, allow_none=True, validate=Length(max=128))
    images = fields.List(
        fields.Nested(ImageAttachmentSchema),
        load_default=list,
        validate=Length(max=MAX_IMAGES_PER_MESSAGE),
        metadata={"description": "Images attached to a user message."},
    )


class ResourceContextSchema(Schema):
    kind = fields.String(
        required=True, validate=OneOf(["dashboard", "chart", "dataset"])
    )
    id_or_slug = fields.String(
        required=True,
        validate=[Length(1, 250), Regexp(r"^[\w-]+$")],
        metadata={
            "description": "Resource hint parsed from the URL, which the "
            "assistant verifies with tools before relying on it."
        },
    )
    name = fields.String(
        load_default=None,
        allow_none=True,
        validate=Length(max=RESOURCE_NAME_MAX_CHARS),
        metadata={
            "description": "Display name the client resolved for the "
            "resource. Free text authored by users, so the gateway treats "
            "it as untrusted content."
        },
    )


class PageContextSchema(Schema):
    page = fields.String(required=True, validate=Length(1, 50))
    resource = fields.Nested(ResourceContextSchema, load_default=None, allow_none=True)
    references = fields.List(
        fields.Nested(ResourceContextSchema),
        load_default=list,
        validate=Length(max=MAX_CONTEXT_REFERENCES),
        metadata={
            "description": "Objects the user attached to the conversation, "
            "which stay attached until removed. Hints like `resource`: the "
            "assistant verifies each with a tool before acting on it."
        },
    )


class ChatRequestSchema(Schema):
    conversation_id = fields.String(
        required=True, validate=Regexp(CONVERSATION_ID_REGEX)
    )
    messages = fields.List(
        fields.Nested(ChatMessageSchema),
        required=True,
        validate=Length(min=1, max=MAX_MESSAGES_HARD_LIMIT),
    )
    context = fields.Nested(PageContextSchema, load_default=None, allow_none=True)


class ToolApprovalRequestSchema(ChatRequestSchema):
    # An approval continuation replays history like a chat request, plus the
    # approval decision and the exact pending tool call. The messages list may
    # be the prior history as-is, since the gateway reconstructs the pending
    # assistant tool-call message from tool_call.
    messages = fields.List(
        fields.Nested(ChatMessageSchema),
        required=True,
        validate=Length(min=0, max=MAX_MESSAGES_HARD_LIMIT),
    )
    approval_id = fields.String(required=True, validate=Length(1, 64))
    decision = fields.String(required=True, validate=OneOf(["approve", "reject"]))
    tool_call = fields.Nested(ToolCallSchema, required=True)
