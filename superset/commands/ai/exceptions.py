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
Exceptions raised by the AI assistant commands.

A conversation the caller does not own is reported as *missing*, never as
forbidden: a 403 would confirm that the identifier names a real conversation,
which is itself something its owner did not share. There is therefore no
"forbidden" case for the API layer to map on these resources — the same 404
covers a wrong identifier and somebody else's thread.
"""

from __future__ import annotations

from uuid import UUID

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ObjectNotFoundError,
    UpdateFailedError,
)


class AIChatThreadNotFoundError(ObjectNotFoundError):
    """No such conversation, or it belongs to somebody else."""

    def __init__(
        self,
        thread_uuid: str | UUID | None = None,
        exception: Exception | None = None,
    ) -> None:
        super().__init__(
            "AI chat thread",
            str(thread_uuid) if thread_uuid else None,
            exception,
        )


class AIChatMessageNotFoundError(ObjectNotFoundError):
    """No such message, or its conversation belongs to somebody else."""

    def __init__(
        self,
        message_uuid: str | UUID | None = None,
        exception: Exception | None = None,
    ) -> None:
        super().__init__(
            "AI chat message",
            str(message_uuid) if message_uuid else None,
            exception,
        )


class AIChatThreadInvalidError(CommandInvalidError):
    """The submitted thread properties cannot be stored."""

    message = _("AI chat thread parameters are invalid.")


class AIChatMessageInvalidError(CommandInvalidError):
    """The submitted message properties cannot be stored."""

    message = _("AI chat message parameters are invalid.")


class AIChatFeedbackInvalidError(CommandInvalidError):
    """The submitted verdict cannot be stored."""

    message = _("AI chat feedback parameters are invalid.")


class AIChatThreadCreateFailedError(CreateFailedError):
    """The thread could not be written."""

    message = _("AI chat thread could not be created.")


class AIChatThreadUpdateFailedError(UpdateFailedError):
    """The thread could not be updated."""

    message = _("AI chat thread could not be updated.")


class AIChatThreadDeleteFailedError(DeleteFailedError):
    """The thread could not be deleted."""

    message = _("AI chat thread could not be deleted.")


class AIChatMessageCreateFailedError(CreateFailedError):
    """The message could not be appended."""

    message = _("AI chat message could not be created.")


class AIChatFeedbackCreateFailedError(CreateFailedError):
    """The verdict could not be recorded."""

    message = _("AI chat feedback could not be recorded.")
