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
# pylint: disable=unused-argument
from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timedelta
from uuid import UUID

import pytest
from enx_dev.ai_chat.approvals import (
    arguments_fingerprint,
    canonicalize_arguments,
    consume_approval,
    create_approval,
    RESOURCE,
)
from enx_dev.ai_chat.exceptions import (
    AiChatApprovalExpiredError,
    AiChatApprovalMismatchError,
)
from flask.ctx import AppContext
from superset_core.common import models as core_models

CONVERSATION_ID = "conv_approvals_test"
TOOL_NAME = "delete_dashboard"
USER_ID = 1000
ARGUMENTS = {"request": {"identifier": 42}}


@pytest.fixture(autouse=True)
def cleanup_approvals(app_context: AppContext) -> Generator[None, None, None]:
    yield

    core_models.get_session().query(core_models.KeyValue).filter(
        core_models.KeyValue.resource == RESOURCE
    ).delete()
    core_models.get_session().commit()


def test_canonicalization_is_order_independent() -> None:
    assert canonicalize_arguments({"b": 1, "a": {"y": 2, "x": 3}}) == (
        canonicalize_arguments({"a": {"x": 3, "y": 2}, "b": 1})
    )
    assert arguments_fingerprint({"a": 1}) != arguments_fingerprint({"a": 2})


def test_create_and_consume_roundtrip(app_context: AppContext) -> None:
    approval = create_approval(USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS)
    assert UUID(approval.approval_id)
    # Equivalent (re-ordered) arguments hash identically, so consumption
    # succeeds with a semantically identical payload.
    consume_approval(
        approval.approval_id,
        USER_ID,
        CONVERSATION_ID,
        TOOL_NAME,
        {"request": {"identifier": 42}},
    )


def test_consume_is_single_use(app_context: AppContext) -> None:
    approval = create_approval(USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS)
    consume_approval(
        approval.approval_id, USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS
    )
    with pytest.raises(AiChatApprovalExpiredError):
        consume_approval(
            approval.approval_id, USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS
        )


def test_consume_unknown_id_rejected(app_context: AppContext) -> None:
    with pytest.raises(AiChatApprovalExpiredError):
        consume_approval(
            "3e7a2ab8-bcaf-49b0-a5df-dfb432f291cc",
            USER_ID,
            CONVERSATION_ID,
            TOOL_NAME,
            ARGUMENTS,
        )
    with pytest.raises(AiChatApprovalExpiredError):
        consume_approval("not-a-uuid", USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS)


def test_consume_expired_rejected(app_context: AppContext) -> None:
    approval = create_approval(USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS)

    entry = (
        core_models.get_session()
        .query(core_models.KeyValue)
        .filter(core_models.KeyValue.uuid == UUID(approval.approval_id))
        .one()
    )
    entry.expires_on = datetime.now() - timedelta(seconds=1)
    core_models.get_session().flush()
    with pytest.raises(AiChatApprovalExpiredError):
        consume_approval(
            approval.approval_id, USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS
        )


def test_consume_for_other_user_rejected(app_context: AppContext) -> None:
    approval = create_approval(USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS)
    with pytest.raises(AiChatApprovalMismatchError):
        consume_approval(
            approval.approval_id,
            USER_ID + 1,
            CONVERSATION_ID,
            TOOL_NAME,
            ARGUMENTS,
        )
    # The mismatch attempt did not burn the approval.
    consume_approval(
        approval.approval_id, USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS
    )


def test_consume_for_other_conversation_rejected(
    app_context: AppContext,
) -> None:
    approval = create_approval(USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS)
    with pytest.raises(AiChatApprovalMismatchError):
        consume_approval(
            approval.approval_id,
            USER_ID,
            "another_conversation",
            TOOL_NAME,
            ARGUMENTS,
        )


def test_consume_with_modified_tool_or_arguments_rejected(
    app_context: AppContext,
) -> None:
    approval = create_approval(USER_ID, CONVERSATION_ID, TOOL_NAME, ARGUMENTS)
    with pytest.raises(AiChatApprovalMismatchError):
        consume_approval(
            approval.approval_id,
            USER_ID,
            CONVERSATION_ID,
            "update_dashboard",
            ARGUMENTS,
        )
    with pytest.raises(AiChatApprovalMismatchError):
        consume_approval(
            approval.approval_id,
            USER_ID,
            CONVERSATION_ID,
            TOOL_NAME,
            {"request": {"identifier": 43}},
        )
