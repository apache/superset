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
Canvas drafts, for widgets whose content keeps a draft of its own.

A canvas draft is a private copy of a canvas that its owner, and their agent,
build up and then publish (commit) or discard; undo and redo step it back and
forward on the server, one request at a time. A widget whose content lives
elsewhere than the canvas, with a draft of its own that a canvas draft shows,
follows the canvas draft here:

- ``on_draft_event`` tells it what happened to a canvas draft, whichever way it
  was asked (the canvas page, the REST API or an agent's tool): discarded,
  committed, undone or redone. A draft that expires fires nothing.
- ``record_step`` adds a step of its own to a canvas draft's history, so that
  the canvas's undo and redo reach it like any other step: they call the
  handler that ``register_step_handler`` registered for the step's kind.
- what ``register_commit_participant`` registers is asked before every
  commit, and refuses one that would publish the canvas without what has to
  go out with it.

Usage:
    from superset_core.canvas import drafts

    class NoteSteps:
        def undo(self, step: drafts.DraftStep, token: str) -> None: ...
        def redo(self, step: drafts.DraftStep, token: str) -> None: ...

    def notes_published(commit: drafts.DraftCommit) -> None:
        if unpublished_notes(commit.token, commit.widget_types):
            raise drafts.CommitRefusedError(
                "NOTES_UNPUBLISHED", "Publish the canvas from its page first."
            )

    drafts.register_step_handler("extensions.acme.notes.edit", NoteSteps())
    drafts.on_draft_event(lambda event: ...)
    drafts.register_commit_participant(notes_published)
    drafts.record_step(
        token,
        drafts.DraftStep(
            kind="extensions.acme.notes.edit",
            payload={"before": "v1", "after": "v2"},
            widget_id=widget_uuid,
        ),
        by="ai",
    )
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

DraftEventKind = Literal["discarded", "committed", "undone", "redone"]

#: Who asked for a step, as the draft's list of changes shows it.
StepAuthor = Literal["user", "ai"]


@dataclass(frozen=True)
class DraftStep:
    """
    A step recorded in a canvas draft's history by whatever keeps the widget's
    content.

    ``kind`` names the handler that undoes and redoes it; namespace it as an
    extension's widget types are, ``extensions.<publisher>.<name>.<step>``.
    ``payload`` is what that handler needs, as JSON, which the draft keeps with
    the step. ``widget_id`` is the saved widget the step changed: the draft's
    list of changes names it wherever the draft places it.
    """

    kind: str
    payload: Mapping[str, Any] = field(default_factory=dict)
    widget_id: str | None = None


@dataclass(frozen=True)
class CanvasDraftEvent:
    """
    What happened to a canvas draft.

    ``token`` is the draft's token, which only its owner can use: compare or
    hash it, and never log it. ``widget_ids`` are the saved widgets the draft
    places: after the step for ``undone`` and ``redone``, as it ended
    otherwise. ``steps`` are the recorded steps: for ``undone`` and ``redone``,
    the one that moved, when it was a recorded step rather than the canvas's
    own; for ``discarded`` and ``committed``, every one the draft held, undone
    ones included.
    """

    kind: DraftEventKind
    canvas_id: int
    token: str
    widget_ids: frozenset[str] = frozenset()
    steps: tuple[DraftStep, ...] = ()


@dataclass(frozen=True)
class DraftCommit:
    """
    A canvas draft about to be committed, as a commit participant reads it.

    ``token`` is the draft's token, as on ``CanvasDraftEvent``. ``widget_types``
    are the saved widgets the draft places, by UUID, each with its widget type:
    what publishing it shows viewers, widgets the draft made included, whether
    or not the committer may see them. ``steps`` are its recorded steps, undone
    ones included. ``by`` is who asked for the commit, the agent through its
    tool or else the person, so that a refusal speaks to them; it grants
    nothing, since anything signed in as the person can call the REST API.
    """

    canvas_id: int
    token: str
    widget_types: Mapping[str, str] = field(default_factory=dict)
    steps: tuple[DraftStep, ...] = ()
    by: StepAuthor = "user"


class DraftStepHandler(Protocol):
    """Undoes and redoes the recorded steps of one kind."""

    def undo(self, step: DraftStep, token: str) -> None:
        """Take ``step`` back, in the canvas draft ``token``."""
        ...

    def redo(self, step: DraftStep, token: str) -> None:
        """Put ``step`` back, in the canvas draft ``token``."""
        ...


class DraftStepError(Exception):
    """
    A handler can't undo or redo its step. The canvas's undo or redo fails with
    this message, and the draft stays as it was.
    """


class DraftNotFoundError(LookupError):
    """
    No such canvas draft that the caller may change. A missing, expired or
    someone else's draft look the same, as does one whose canvas the caller
    may no longer edit.
    """


class CommitRefusedError(Exception):
    """
    A commit participant refuses a commit: nothing is published, the draft
    stays as it was, and whoever asked gets ``code`` and ``message``.

    ``code`` is the participant's own, for a caller to tell its refusals apart,
    such as ``NOTES_UNPUBLISHED``. ``message`` says what to do instead, in the
    words of whoever asked (``DraftCommit.by``).
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def on_draft_event(
    listener: Callable[[CanvasDraftEvent], None],
) -> Callable[[], None]:
    """
    Call ``listener`` after each event, in the request that caused it, which
    runs as the draft's owner.

    Delivery is best-effort: a listener that raises is logged, and neither
    stops the others nor fails the request.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param listener: Called with each event.
    :returns: A function that unsubscribes ``listener``.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def register_step_handler(
    kind: str,
    handler: DraftStepHandler,
) -> Callable[[], None]:
    """
    Register ``handler`` for the recorded steps of ``kind``.

    The canvas calls it as it undoes or redoes such a step, under the draft's
    write lock and before it saves the draft, so keep it short: a handler that
    raises ``DraftStepError`` fails the undo or the redo with its message, and
    the draft stays as it was. A step whose kind has no handler, as when its
    extension is gone, is stepped over: the canvas moves past it and changes
    nothing else.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param kind: The kind of the steps it handles.
    :param handler: What undoes and redoes them.
    :returns: A function that unregisters ``handler``.
    :raises ValueError: If ``kind`` has another handler.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def record_step(token: str, step: DraftStep, *, by: StepAuthor = "user") -> int:
    """
    Add ``step`` to the caller's canvas draft ``token``, as the newest step of
    its history.

    Like any change to the draft, it discards what was undone, and it moves the
    draft's revision on, so that a client writing at the revision before is
    asked to reload. It changes nothing on the canvas: the step's handler is
    called only to undo or redo it.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param token: The canvas draft's token. It must be the caller's own draft,
        on a canvas they may still edit.
    :param step: The step, with what its handler needs to undo and redo it.
    :param by: Who asked for it, as the draft lists the change.
    :returns: The draft's revision after the step.
    :raises DraftNotFoundError: If the caller has no such draft.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def register_commit_participant(
    participant: Callable[[DraftCommit], None],
) -> Callable[[], None]:
    """
    Ask ``participant`` before each commit of a canvas draft, whichever way it
    was asked (the canvas page, the REST API or an agent's tool), in the
    request that asks, which runs as the draft's owner.

    It is asked under the draft's write lock, once the draft is known to be at
    the revision committed and its canvas unchanged, and before anything is
    written; an empty draft is asked about too. It refuses by raising
    ``CommitRefusedError``: the commit fails with its code and message,
    nothing is written, and the draft stays. The first refusal ends the
    commit, and the participants after it aren't asked. A participant that
    raises anything else refuses the commit too, with the host's message:
    what it would have said is unknown.

    What the canvas page publishes with a draft (its publish participants in
    ``@apache-superset/core``) is published before the page commits, so the
    page's commit passes where a commit that skipped the page's confirmation,
    such as an agent's, is refused.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param participant: Called with each commit; raises to refuse it.
    :returns: A function that unregisters ``participant``.
    """
    raise NotImplementedError("Function will be replaced during initialization")
