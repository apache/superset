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
The host's side of ``superset_core.canvas.drafts``: who listens to canvas
draft events, which handler undoes and redoes each kind of recorded step, and
who is asked before a commit. The draft commands
(``superset.commands.canvas.draft``) read all three.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from flask_babel import gettext as _
from superset_core.canvas.drafts import (
    CanvasDraftEvent,
    CommitRefusedError,
    DraftCommit,
    DraftStepHandler,
)

logger = logging.getLogger(__name__)

#: The code of a commit refused by a participant that failed.
PARTICIPANT_FAILED = "CommitParticipantFailed"

_listeners: list[Callable[[CanvasDraftEvent], None]] = []
_handlers: dict[str, DraftStepHandler] = {}
_participants: list[Callable[[DraftCommit], None]] = []


def on_draft_event(
    listener: Callable[[CanvasDraftEvent], None],
) -> Callable[[], None]:
    """Call ``listener`` after each canvas draft event; answer its unsubscribe."""
    _listeners.append(listener)

    def unsubscribe() -> None:
        if listener in _listeners:
            _listeners.remove(listener)

    return unsubscribe


def emit(event: CanvasDraftEvent) -> None:
    """Tell every listener of ``event``, after what it reports took effect."""
    for listener in list(_listeners):
        try:
            listener(event)
        except Exception:  # pylint: disable=broad-except
            # What the event reports has happened already, and a listener is
            # someone else's code: one that fails mustn't keep the others from
            # hearing of it, or turn the request that caused it into an error.
            logger.exception("A canvas draft listener failed on %s", event.kind)


def register_step_handler(kind: str, handler: DraftStepHandler) -> Callable[[], None]:
    """Make ``handler`` undo and redo the steps of ``kind``; answer its removal."""
    if not kind:
        raise ValueError("A recorded step's kind can't be empty")
    existing = _handlers.get(kind)
    if existing is not None and existing is not handler:
        raise ValueError(f"Recorded steps of kind {kind!r} have a handler already")
    _handlers[kind] = handler

    def unregister() -> None:
        if _handlers.get(kind) is handler:
            del _handlers[kind]

    return unregister


def step_handler(kind: str) -> DraftStepHandler | None:
    """The handler of the steps of ``kind``, if anything registered one."""
    return _handlers.get(kind)


def register_commit_participant(
    participant: Callable[[DraftCommit], None],
) -> Callable[[], None]:
    """Ask ``participant`` before each commit; answer its removal."""
    _participants.append(participant)

    def unregister() -> None:
        if participant in _participants:
            _participants.remove(participant)

    return unregister


def has_commit_participants() -> bool:
    """Whether anything is asked before a commit."""
    return bool(_participants)


def check_commit(commit: DraftCommit) -> None:
    """
    Ask every commit participant about ``commit``, in the order they came;
    raise the first refusal, as ``CommitRefusedError``.
    """
    for participant in list(_participants):
        try:
            participant(commit)
        except CommitRefusedError:
            raise
        except Exception as ex:  # pylint: disable=broad-except
            # Unlike a listener's, its answer decides: one that can't say the
            # commit may go ahead hasn't said so, and what goes out can't be
            # taken back.
            logger.exception("A canvas commit participant failed")
            raise CommitRefusedError(
                PARTICIPANT_FAILED,
                _(
                    "Something published with this canvas couldn't be checked, "
                    "so the canvas wasn't published. Try again."
                ),
            ) from ex
