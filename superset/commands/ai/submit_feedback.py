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
"""Recording a user's verdict on an assistant answer."""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

from superset.ai.types import MessageRole
from superset.commands.ai.exceptions import (
    AIChatFeedbackCreateFailedError,
    AIChatFeedbackInvalidError,
    AIChatMessageNotFoundError,
)
from superset.commands.base import BaseCommand, CreateMixin
from superset.daos.ai import AIChatFeedbackDAO, AIChatMessageDAO
from superset.models.ai import AIChatFeedback, AIChatMessage
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class SubmitAIChatFeedbackCommand(CreateMixin, BaseCommand):
    """
    Record a thumbs up or down on an assistant message.

    A user has one verdict per message, so submitting again revises the earlier
    one. Inspect :attr:`created` to tell a first verdict from a revision.
    """

    def __init__(
        self,
        message_uuid: str | UUID,
        user_id: int,
        *,
        liked: bool,
        comment: str | None = None,
    ) -> None:
        """
        :param message_uuid: The public identifier of the message being rated
        :param user_id: The user leaving the verdict, who must own the thread
        :param liked: Whether the answer was helpful
        :param comment: Optional free-text remark
        """
        self._message_uuid = message_uuid
        self._user_id = user_id
        self._liked = liked
        self._comment = comment
        self._model: AIChatMessage | None = None
        self._created = False

    @property
    def created(self) -> bool:
        """Whether :meth:`run` stored a first verdict rather than revising one."""
        return self._created

    @transaction(on_error=partial(on_error, reraise=AIChatFeedbackCreateFailedError))
    def run(self) -> AIChatFeedback:
        self.validate()
        assert self._model

        feedback, self._created = AIChatFeedbackDAO.upsert(
            self._model,
            self._user_id,
            liked=self._liked,
            comment=self._comment,
        )
        return feedback

    def validate(self) -> None:
        # Resolved through the message DAO's join on thread ownership, so a
        # message in somebody else's conversation is reported as missing.
        self._model = AIChatMessageDAO.find_by_uuid_for_user(
            self._message_uuid,
            self._user_id,
        )
        if not self._model:
            raise AIChatMessageNotFoundError(self._message_uuid)

        # Rating one's own question, or a system turn, carries no signal and
        # would pollute any aggregate built from this table.
        if self._model.role != MessageRole.ASSISTANT:
            raise AIChatFeedbackInvalidError("Only assistant messages can be rated.")
