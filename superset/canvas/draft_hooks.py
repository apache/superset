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
draft events, and which handler undoes and redoes each kind of recorded step.
The draft commands (``superset.commands.canvas.draft``) read both.

An extension registers them while it loads, and a draft's requests call them
much later, when no extension context is set: each runs in the context of the
extension that registered it, made afresh for each call (``bind_context``), so
that ``get_context()`` and extension storage find that extension. What the
host registers runs as it is.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from superset_core.canvas.drafts import CanvasDraftEvent, DraftStep, DraftStepHandler

from superset.extensions.context import (
    bind_context,
    ConcreteExtensionContext,
    get_current_extension_context,
    restore_context,
)

logger = logging.getLogger(__name__)

_listeners: list[Callable[[CanvasDraftEvent], None]] = []
_handlers: dict[str, DraftStepHandler] = {}


class _ExtensionStepHandler:
    """A step handler an extension registered, run in that extension's context."""

    def __init__(
        self, handler: DraftStepHandler, context: ConcreteExtensionContext
    ) -> None:
        self.handler = handler
        self._context = context

    def undo(self, step: DraftStep, token: str) -> None:
        with restore_context(self._context):
            self.handler.undo(step, token)

    def redo(self, step: DraftStep, token: str) -> None:
        with restore_context(self._context):
            self.handler.redo(step, token)


def _registered(handler: DraftStepHandler) -> DraftStepHandler:
    """The handler as it was registered, without the context it runs in."""
    if isinstance(handler, _ExtensionStepHandler):
        return handler.handler
    return handler


def on_draft_event(
    listener: Callable[[CanvasDraftEvent], None],
) -> Callable[[], None]:
    """Call ``listener`` after each canvas draft event; answer its unsubscribe."""
    bound = bind_context(listener, get_current_extension_context())
    _listeners.append(bound)

    def unsubscribe() -> None:
        if bound in _listeners:
            _listeners.remove(bound)

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
    if existing is None:
        context = get_current_extension_context()
        _handlers[kind] = (
            handler if context is None else _ExtensionStepHandler(handler, context)
        )
    elif _registered(existing) is not handler:
        raise ValueError(f"Recorded steps of kind {kind!r} have a handler already")

    def unregister() -> None:
        current = _handlers.get(kind)
        if current is not None and _registered(current) is handler:
            del _handlers[kind]

    return unregister


def step_handler(kind: str) -> DraftStepHandler | None:
    """The handler of the steps of ``kind``, if anything registered one."""
    return _handlers.get(kind)
