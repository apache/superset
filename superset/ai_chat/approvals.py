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
"""Server-enforced approvals for mutating tool calls.

An approval is a short-lived, single-use record bound to the requesting user,
the conversation, the exact tool name and a hash of the canonicalized tool
arguments. Approvals live in the metadata database through the key-value
store, so enforcement holds across workers and never depends on what the
browser sends. Changing any bound property invalidates the approval, and a
consumed approval cannot be replayed.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from superset import db
from superset.ai_chat.exceptions import (
    AiChatApprovalExpiredError,
    AiChatApprovalMismatchError,
)
from superset.ai_chat.settings import get_ai_chat_config
from superset.daos.key_value import KeyValueDAO
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
from superset.key_value.utils import get_filter
from superset.utils import json
from superset.utils.decorators import transaction

RESOURCE = KeyValueResource.AI_CHAT_APPROVAL
CODEC = JsonKeyValueCodec()


@dataclass
class Approval:
    approval_id: str
    expires_at: str


def canonicalize_arguments(arguments: dict[str, Any]) -> str:
    """Stable serialization of tool arguments for fingerprinting."""
    return json.dumps(arguments, sort_keys=True, separators=(",", ":"), default=str)


def arguments_fingerprint(arguments: dict[str, Any]) -> str:
    return hashlib.sha256(canonicalize_arguments(arguments).encode("utf-8")).hexdigest()


@transaction()
def create_approval(
    user_id: int,
    conversation_id: str,
    tool_name: str,
    arguments: dict[str, Any],
) -> Approval:
    """Create a pending approval and return its id and expiry."""
    config = get_ai_chat_config()
    ttl_seconds = int(config.get("APPROVAL_TTL_SECONDS") or 300)
    expires_on = datetime.now() + timedelta(seconds=ttl_seconds)

    # Drop expired approvals so the table stays small
    KeyValueDAO.delete_expired_entries(RESOURCE)

    entry = KeyValueDAO.create_entry(
        resource=RESOURCE,
        value={
            "user_id": user_id,
            "conversation_id": conversation_id,
            "tool_name": tool_name,
            "args_hash": arguments_fingerprint(arguments),
        },
        codec=CODEC,
        expires_on=expires_on,
    )
    db.session.flush()
    return Approval(
        approval_id=str(entry.uuid),
        expires_at=expires_on.isoformat(),
    )


@transaction()
def consume_approval(
    approval_id: str,
    user_id: int,
    conversation_id: str,
    tool_name: str,
    arguments: dict[str, Any],
) -> None:
    """Validate and atomically consume an approval, which is single use.

    Raises :class:`AiChatApprovalExpiredError` when the approval does not
    exist, has expired, or was already consumed, and
    :class:`AiChatApprovalMismatchError` when any bound property differs from
    what was approved: user, conversation, tool or arguments. A mismatch does
    not consume the approval, so the originally proposed action can still be
    approved.
    """
    try:
        key = UUID(approval_id)
    except (ValueError, AttributeError, TypeError) as ex:
        raise AiChatApprovalExpiredError() from ex

    entry = KeyValueDAO.get_entry(RESOURCE, key)
    if entry is None or entry.is_expired():
        raise AiChatApprovalExpiredError()

    value = CODEC.decode(entry.value)
    if (
        value.get("user_id") != user_id
        or value.get("conversation_id") != conversation_id
        or value.get("tool_name") != tool_name
        or value.get("args_hash") != arguments_fingerprint(arguments)
    ):
        raise AiChatApprovalMismatchError()

    # Atomic single-use consumption: exactly one concurrent request deletes
    # the row and every other request observes rowcount == 0.
    rowcount = (
        db.session.query(KeyValueEntry).filter_by(**get_filter(RESOURCE, key)).delete()
    )
    if rowcount == 0:
        raise AiChatApprovalExpiredError()
