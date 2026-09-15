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
"""Appending a turn to an AI assistant conversation."""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

from superset.ai.types import MessageRole, MessageStatus
from superset.commands.ai.exceptions import (
    AIChatMessageCreateFailedError,
    AIChatMessageInvalidError,
    AIChatThreadNotFoundError,
)
from superset.commands.base import BaseCommand, CreateMixin
from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO
from superset.models.ai import AIChatMessage, AIChatThread
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)

#: Read off the column so the check and the schema cannot drift apart.
REQUEST_ID_MAX_LENGTH: int = AIChatMessage.__table__.c.request_id.type.length


class AppendAIChatMessageCommand(CreateMixin, BaseCommand):
    """
    Append one turn to a conversation the acting user owns.

    Idempotent on the client's ``request_id``: a replayed request yields the
    turn the first attempt stored rather than a second copy of the same
    question. Inspect :attr:`created` to tell an insert from a replay — an API
    layer can use it to answer 201 or 200.
    """

    def __init__(
        self,
        thread_uuid: str | UUID,
        user_id: int,
        role: MessageRole | str,
        content: str,
        *,
        request_id: str | None = None,
        status: MessageStatus | str | None = None,
    ) -> None:
        """
        :param thread_uuid: The public identifier of the thread
        :param user_id: The user who must own the thread
        :param role: The author of the turn
        :param content: The turn's text, which may be empty for an assistant
            row opened before inference starts
        :param request_id: Optional client-supplied idempotency key
        :param status: Optional initial lifecycle value
        """
        self._thread_uuid = thread_uuid
        self._user_id = user_id
        self._role: MessageRole | str = role
        self._content = content
        self._request_id = request_id
        self._status: MessageStatus | str | None = status
        self._model: AIChatThread | None = None
        self._created = False

    @property
    def created(self) -> bool:
        """Whether :meth:`run` stored a new turn, as opposed to replaying one."""
        return self._created

    @transaction(on_error=partial(on_error, reraise=AIChatMessageCreateFailedError))
    def run(self) -> AIChatMessage:
        self.validate()
        assert self._model

        message, self._created = AIChatMessageDAO.create_idempotent(
            self._model,
            self._role,
            self._content,
            user_id=self._user_id,
            request_id=self._request_id,
            status=self._status,
        )
        return message

    def validate(self) -> None:
        try:
            self._role = MessageRole(self._role).value
        except ValueError as ex:
            raise AIChatMessageInvalidError(
                f"Unknown message role: {self._role}"
            ) from ex

        if self._status is not None:
            try:
                self._status = MessageStatus(self._status).value
            except ValueError as ex:
                raise AIChatMessageInvalidError(
                    f"Unknown message status: {self._status}"
                ) from ex

        # An over-long key would be truncated by the database on some backends,
        # which would silently break the idempotency the client is relying on.
        if self._request_id is not None and len(self._request_id) > (
            REQUEST_ID_MAX_LENGTH
        ):
            raise AIChatMessageInvalidError(
                f"Request id cannot exceed {REQUEST_ID_MAX_LENGTH} characters."
            )

        self._model = AIChatThreadDAO.find_by_uuid_for_user(
            self._thread_uuid,
            self._user_id,
        )
        if not self._model:
            raise AIChatThreadNotFoundError(self._thread_uuid)
