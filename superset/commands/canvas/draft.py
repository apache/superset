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
Canvas drafts: a private copy of a canvas definition that operations build up
before an explicit commit publishes them, following SIP-231's widget drafts.

A draft lives in the cache that holds Explore's temporary state
(``EXPLORE_FORM_DATA_CACHE_CONFIG``), under an unguessable token, so with a
cache such as Redis behind it editing a draft never writes to the metadata
database; only a commit does. The token locates the draft but never
authorizes it: every use checks that the caller created the draft and can
still edit its canvas. Drafts expire after ``CANVAS_DRAFT_TTL_SECONDS``
without a write, and are deleted on commit.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

from flask import current_app
from pydantic import TypeAdapter

from superset import security_manager
from superset.canvas.definition.render import render_context
from superset.canvas.definition.schemas import Operation
from superset.canvas.definition.scopes import resolve_scopes
from superset.commands.canvas.apply_ops import (
    apply_or_raise,
    ApplyCanvasOperationsCommand,
    ApplyResult,
    placement_issues,
)
from superset.commands.canvas.exceptions import (
    CanvasDraftNotFoundError,
    CanvasForbiddenError,
    CanvasNotFoundError,
    DefinitionInvalidError,
    DraftConflictError,
)
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import cache_manager
from superset.models.canvas import Canvas
from superset.utils import json
from superset.utils.core import get_user_id

KEY_PREFIX = "canvas_draft:"
OPERATIONS = TypeAdapter(list[Operation])


@dataclass
class CanvasDraft:
    token: str
    # The principal that created the draft; only it can use the token.
    owner_id: int | None
    canvas_id: int
    # The canvas revision the draft started from; commit requires it unchanged.
    base_revision: int
    # Incremented on every accepted write to the draft.
    revision: int
    definition: dict[str, Any]
    # The operations applied so far, as logged; commit replays them.
    ops: list[dict[str, Any]] = field(default_factory=list)

    def to_value(self) -> dict[str, Any]:
        return {
            "ownerId": self.owner_id,
            "canvasId": self.canvas_id,
            "baseRevision": self.base_revision,
            "revision": self.revision,
            "definition": self.definition,
            "ops": self.ops,
        }


def _cache_key(token: str) -> str:
    try:
        return f"{KEY_PREFIX}{UUID(token)}"
    except (TypeError, ValueError) as ex:
        raise CanvasDraftNotFoundError() from ex


def _save(draft: CanvasDraft) -> None:
    # Stored as a JSON string: the Explore cache rewrites dict values on read.
    cache_manager.explore_form_data_cache.set(
        _cache_key(draft.token),
        json.dumps(draft.to_value()),
        timeout=current_app.config["CANVAS_DRAFT_TTL_SECONDS"],
    )


def _editable_canvas(canvas_ref: int | str) -> Canvas:
    canvas = CanvasDAO.find_by_id_or_uuid(str(canvas_ref))
    if canvas is None:
        raise CanvasNotFoundError()
    try:
        security_manager.raise_for_editorship(canvas)
    except SupersetSecurityException as ex:
        raise CanvasForbiddenError() from ex
    return canvas


def load_draft(token: str) -> CanvasDraft:
    """
    The caller's draft for ``token``. Any other principal's draft, an expired
    or unknown token, or a canvas the caller can no longer edit all look the
    same: not found, or forbidden for the canvas.
    """
    raw = cache_manager.explore_form_data_cache.get(_cache_key(token))
    if not isinstance(raw, str):
        raise CanvasDraftNotFoundError()
    value = json.loads(raw)
    if value.get("ownerId") is None or value["ownerId"] != get_user_id():
        raise CanvasDraftNotFoundError()
    _editable_canvas(value["canvasId"])
    return CanvasDraft(
        token=token,
        owner_id=value["ownerId"],
        canvas_id=value["canvasId"],
        base_revision=value["baseRevision"],
        revision=value["revision"],
        definition=value["definition"],
        ops=value["ops"],
    )


def draft_payload(draft: CanvasDraft, resolved: bool = True) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "canvasId": draft.canvas_id,
        "baseRevision": draft.base_revision,
        "revision": draft.revision,
        "definition": draft.definition,
    }
    if resolved:
        payload.update(resolve_scopes(draft.definition))
        payload.update(render_context(draft.definition))
    return payload


class CreateCanvasDraftCommand:
    """Start a draft from a canvas's current definition."""

    def __init__(self, canvas_ref: int | str) -> None:
        self._canvas_ref = canvas_ref

    def run(self) -> CanvasDraft:
        canvas = _editable_canvas(self._canvas_ref)
        draft = CanvasDraft(
            token=str(uuid4()),
            owner_id=get_user_id(),
            canvas_id=canvas.id,
            base_revision=canvas.revision,
            revision=0,
            definition=CanvasDAO.load(canvas),
        )
        _save(draft)
        return draft


class ApplyCanvasDraftOperationsCommand:
    """
    Apply operations to a draft, validated as they would be on the canvas.
    The write must be based on the draft's current revision.
    """

    def __init__(self, token: str, revision: int, ops: list[Operation]) -> None:
        self._token = token
        self._revision = revision
        self._ops = ops

    def run(self) -> tuple[CanvasDraft, list[dict[str, Any]]]:
        draft = load_draft(self._token)
        if self._revision != draft.revision:
            raise DraftConflictError(draft.revision)
        if issues := placement_issues(self._ops):
            raise DefinitionInvalidError(
                "The operations add widgets that cannot be placed", issues=issues
            )
        definition, applied = apply_or_raise(draft.definition, self._ops)
        logged = [operation.op for operation in applied]
        draft.definition = definition
        draft.ops = [*draft.ops, *logged]
        draft.revision += 1
        _save(draft)
        return draft, logged


class CommitCanvasDraftCommand:
    """
    Publish a draft: replay its operations on the canvas, which must not have
    changed since the draft started, then delete the draft.
    """

    def __init__(self, token: str, revision: int) -> None:
        self._token = token
        self._revision = revision

    def run(self) -> ApplyResult | None:
        draft = load_draft(self._token)
        if self._revision != draft.revision:
            raise DraftConflictError(draft.revision)
        result = None
        if draft.ops:
            result = ApplyCanvasOperationsCommand(
                draft.canvas_id,
                draft.base_revision,
                OPERATIONS.validate_python(draft.ops),
                strict=True,
            ).run()
        DeleteCanvasDraftCommand(self._token).run()
        return result


class DeleteCanvasDraftCommand:
    """Discard a draft."""

    def __init__(self, token: str) -> None:
        self._token = token

    def run(self) -> None:
        load_draft(self._token)
        cache_manager.explore_form_data_cache.delete(_cache_key(self._token))
