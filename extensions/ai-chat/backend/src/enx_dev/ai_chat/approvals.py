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
arguments. Approvals live in the metadata database through the shared
key-value table, so enforcement holds across workers and never depends on
what the browser sends. Changing any bound property invalidates the
approval, and a consumed approval cannot be replayed.

The ``resource`` column is a free-form string, so the extension namespaces
its own rows with :data:`RESOURCE` instead of needing an entry in the host's
resource enumeration. Rows are reached through the generic DAO methods for
the same reason: the host's resource-typed helpers (``create_entry`` and
``get_entry``) only accept members of that enumeration.
"""

from __future__ import annotations

import hashlib
import json  # noqa: TID251  (superset.utils.json is host-internal)
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from enx_dev.ai_chat.exceptions import (
    AiChatApprovalExpiredError,
    AiChatApprovalMismatchError,
)
from enx_dev.ai_chat.settings import get_ai_chat_config

# Imported as modules rather than by name: the host swaps these attributes in
# during startup, and binding the names at import time would freeze whichever
# placeholder happened to be in place first.
from superset_core.common import daos as core_daos, models as core_models

#: Namespace for this extension's rows in the shared key-value table.
RESOURCE = "ai_chat_approval"


@dataclass
class Approval:
    approval_id: str
    expires_at: str


def canonicalize_arguments(arguments: dict[str, Any]) -> str:
    """Stable serialization of tool arguments for fingerprinting."""
    return json.dumps(arguments, sort_keys=True, separators=(",", ":"), default=str)


def arguments_fingerprint(arguments: dict[str, Any]) -> str:
    return hashlib.sha256(canonicalize_arguments(arguments).encode("utf-8")).hexdigest()


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
    key = uuid4()
    session = core_models.get_session()

    try:
        # Drop expired approvals so the table stays small
        session.query(core_models.KeyValue).filter(
            core_models.KeyValue.resource == RESOURCE,
            core_models.KeyValue.expires_on < datetime.now(),
        ).delete(synchronize_session=False)

        core_daos.KeyValueDAO.create(
            attributes={
                "resource": RESOURCE,
                "uuid": key,
                "value": json.dumps(
                    {
                        "user_id": user_id,
                        "conversation_id": conversation_id,
                        "tool_name": tool_name,
                        "args_hash": arguments_fingerprint(arguments),
                    }
                ).encode("utf-8"),
                "expires_on": expires_on,
            }
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    return Approval(
        approval_id=str(key),
        expires_at=expires_on.isoformat(),
    )


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

    session = core_models.get_session()
    try:
        entry = core_daos.KeyValueDAO.find_one_or_none(resource=RESOURCE, uuid=key)
        if entry is None or (
            entry.expires_on is not None and entry.expires_on < datetime.now()
        ):
            raise AiChatApprovalExpiredError()

        value = json.loads(entry.value.decode("utf-8"))
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
            session.query(core_models.KeyValue)
            .filter(
                core_models.KeyValue.resource == RESOURCE,
                core_models.KeyValue.uuid == key,
            )
            .delete(synchronize_session=False)
        )
        session.commit()
    except Exception:
        session.rollback()
        raise

    if rowcount == 0:
        raise AiChatApprovalExpiredError()
