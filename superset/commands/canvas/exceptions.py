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
from __future__ import annotations

from typing import Any

from flask_babel import lazy_gettext as _

from superset.canvas.definition.validation import Issue
from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ForbiddenError,
    ObjectNotFoundError,
    UpdateFailedError,
)


class CanvasNotFoundError(ObjectNotFoundError):
    def __init__(self) -> None:
        super().__init__("Canvas")


class CanvasForbiddenError(ForbiddenError):
    message = _("Changing this canvas is forbidden")


class CanvasInvalidError(CommandInvalidError):
    message = _("Canvas parameters are invalid.")


class CanvasCreateFailedError(CreateFailedError):
    message = _("Canvas could not be created.")


class CanvasUpdateFailedError(UpdateFailedError):
    message = _("Canvas could not be updated.")


class CanvasDeleteFailedError(DeleteFailedError):
    message = _("Canvas could not be deleted.")


class DefinitionConflictError(CommandException):
    """The write is based on a revision that later changes overlap."""

    status = 409

    def __init__(self, revision: int, conflicts: list[str], stale: bool) -> None:
        self.revision = revision
        self.conflicts = conflicts
        self.stale = stale
        message = (
            _("The canvas changed too much since your revision; reload it.")
            if stale
            else _("Placements you edited were changed since your revision.")
        )
        super().__init__(message)

    def to_payload(self) -> dict[str, Any]:
        return {
            "message": str(self.message),
            "revision": self.revision,
            "conflicts": self.conflicts,
            "stale": self.stale,
        }


class CanvasDraftNotFoundError(ObjectNotFoundError):
    def __init__(self) -> None:
        super().__init__("Canvas draft")


class DraftConflictError(CommandException):
    """
    A draft write based on an older draft revision, or a commit of a draft
    whose canvas changed since the draft started.
    """

    status = 409

    def __init__(self, revision: int, canvas_changed: bool = False) -> None:
        self.revision = revision
        self.canvas_changed = canvas_changed
        message = (
            _("The canvas changed since this draft started; start a new draft.")
            if canvas_changed
            else _("The draft changed since your revision; reload it.")
        )
        super().__init__(message)

    def to_payload(self) -> dict[str, Any]:
        return {
            "message": str(self.message),
            "revision": self.revision,
            "canvasChanged": self.canvas_changed,
        }


class DefinitionInvalidError(CommandException):
    """An operation could not apply, or its result is not a valid definition."""

    status = 422

    def __init__(
        self,
        message: str,
        issues: list[Issue] | None = None,
        operation_index: int | None = None,
    ) -> None:
        self.issues = issues or []
        self.operation_index = operation_index
        super().__init__(message)

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "message": str(self.message),
            "errors": [
                {"path": issue.path, "message": issue.message} for issue in self.issues
            ],
        }
        if self.operation_index is not None:
            payload["operation"] = self.operation_index
        return payload
