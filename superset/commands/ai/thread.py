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
Lifecycle of an AI assistant conversation: open, rename or archive, delete.

Each command takes the acting user's identifier and resolves the thread through
the owner-scoped DAO, so a thread belonging to somebody else is indistinguishable
from one that never existed.
"""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

from superset.ai.types import ThreadStatus
from superset.commands.ai.exceptions import (
    AIChatThreadCreateFailedError,
    AIChatThreadDeleteFailedError,
    AIChatThreadInvalidError,
    AIChatThreadNotFoundError,
    AIChatThreadUpdateFailedError,
)
from superset.commands.base import BaseCommand, CreateMixin, UpdateMixin
from superset.daos.ai import AIChatThreadDAO
from superset.models.ai import AIChatThread
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)

#: Read off the column so the check and the schema cannot drift apart.
TITLE_MAX_LENGTH: int = AIChatThread.__table__.c.title.type.length


def _normalise_title(title: str) -> str:
    """
    Trim a title and reject one the column cannot hold.

    An over-long title is refused rather than truncated, because storing
    something other than what the user typed is worse than saying no. A title
    that is blank once trimmed is refused too: it is a client bug, and the
    alternative — quietly clearing the label — destroys the existing one.
    """
    trimmed = title.strip()
    if not trimmed:
        raise AIChatThreadInvalidError("Thread title cannot be blank.")
    if len(trimmed) > TITLE_MAX_LENGTH:
        raise AIChatThreadInvalidError(
            f"Thread title cannot exceed {TITLE_MAX_LENGTH} characters."
        )
    return trimmed


def _normalise_status(status: ThreadStatus | str) -> str:
    """
    Reject a lifecycle value the model does not define.

    The model's validator refuses one too, but as a ``ValueError`` raised at
    assignment time, which the API layer would report as a server fault. Checked
    here it stays what it is: a bad request.
    """
    try:
        return ThreadStatus(status).value
    except ValueError as ex:
        raise AIChatThreadInvalidError(f"Unknown thread status: {status}") from ex


class CreateAIChatThreadCommand(CreateMixin, BaseCommand):
    """Open a conversation owned by the acting user."""

    def __init__(
        self,
        user_id: int,
        *,
        title: str | None = None,
        agent_key: str | None = None,
    ) -> None:
        """
        :param user_id: The user who will own the thread
        :param title: Optional human-readable label
        :param agent_key: Optional agent profile the thread runs with
        """
        self._user_id = user_id
        self._title = title
        self._agent_key = agent_key

    @transaction(on_error=partial(on_error, reraise=AIChatThreadCreateFailedError))
    def run(self) -> AIChatThread:
        self.validate()
        return AIChatThreadDAO.create_for_user(
            self._user_id,
            title=self._title,
            agent_key=self._agent_key,
        )

    def validate(self) -> None:
        if self._title is not None:
            self._title = _normalise_title(self._title)


class UpdateAIChatThreadCommand(UpdateMixin, BaseCommand):
    """
    Rename or archive a conversation.

    The two properties are independently optional, so archiving does not
    require the client to restate a title it is not changing.
    """

    def __init__(
        self,
        thread_uuid: str | UUID,
        user_id: int,
        *,
        title: str | None = None,
        status: ThreadStatus | str | None = None,
    ) -> None:
        """
        :param thread_uuid: The public identifier of the thread
        :param user_id: The user who must own the thread
        :param title: New label, or ``None`` to leave it alone
        :param status: New lifecycle value, or ``None`` to leave it alone
        """
        self._thread_uuid = thread_uuid
        self._user_id = user_id
        self._title = title
        self._status = status
        self._model: AIChatThread | None = None

    @transaction(on_error=partial(on_error, reraise=AIChatThreadUpdateFailedError))
    def run(self) -> AIChatThread:
        self.validate()
        assert self._model

        if self._title is not None:
            self._model.title = self._title
        if self._status is not None:
            self._model.status = self._status

        return AIChatThreadDAO.update(self._model)

    def validate(self) -> None:
        if self._title is not None:
            self._title = _normalise_title(self._title)
        if self._status is not None:
            self._status = _normalise_status(self._status)

        self._model = AIChatThreadDAO.find_by_uuid_for_user(
            self._thread_uuid,
            self._user_id,
        )
        if not self._model:
            raise AIChatThreadNotFoundError(self._thread_uuid)


class DeleteAIChatThreadCommand(BaseCommand):
    """
    Delete a conversation and everything said in it.

    The messages go with the thread through the ORM relationship's cascade, so
    no transcript outlives the thread its owner deleted.
    """

    def __init__(self, thread_uuid: str | UUID, user_id: int) -> None:
        """
        :param thread_uuid: The public identifier of the thread
        :param user_id: The user who must own the thread
        """
        self._thread_uuid = thread_uuid
        self._user_id = user_id
        self._model: AIChatThread | None = None

    @transaction(on_error=partial(on_error, reraise=AIChatThreadDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model
        AIChatThreadDAO.delete([self._model])

    def validate(self) -> None:
        self._model = AIChatThreadDAO.find_by_uuid_for_user(
            self._thread_uuid,
            self._user_id,
        )
        if not self._model:
            raise AIChatThreadNotFoundError(self._thread_uuid)
