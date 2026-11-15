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
"""How a file store call fails, in the shape of the authoring contract's errors."""

from __future__ import annotations

from enum import StrEnum
from typing import Any, TypeAlias

from superset_core.artifacts.authoring import (
    AuthoringErrorCode,
    AuthoringErrorResponse,
)


class ExtensionErrorCode(StrEnum):
    """
    Failures that ``AuthoringErrorCode`` has no code for.

    They answer with the same fields as ``AuthoringErrorResponse``.
    TODO(SIP B): propose them for the authoring contract.
    """

    # No artifact with this id, or the caller can't edit it; the two look the
    # same, so that an id doesn't reveal whether the artifact exists.
    ARTIFACT_NOT_FOUND = "ARTIFACT_NOT_FOUND"
    # The version isn't one of this artifact's.
    VERSION_NOT_FOUND = "VERSION_NOT_FOUND"
    # ``manifest.json`` is missing, or doesn't validate.
    INVALID_MANIFEST = "INVALID_MANIFEST"
    # An argument the request model accepts, but the file doesn't: a line or
    # page past the end, or a text edit on a binary file.
    INVALID_ARGUMENT = "INVALID_ARGUMENT"
    # No pending publish request with this id: it was confirmed, replaced by a
    # newer request, expired or never made.
    PUBLISH_REQUEST_NOT_FOUND = "PUBLISH_REQUEST_NOT_FOUND"


ErrorCode: TypeAlias = AuthoringErrorCode | ExtensionErrorCode


class ArtifactStoreError(Exception):
    """A call that failed and changed nothing; ``to_dict`` is its answer."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        current_version: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.current_version = current_version

    def to_dict(self) -> dict[str, Any]:
        """The answer: ``AuthoringErrorResponse``'s fields."""
        if isinstance(self.code, AuthoringErrorCode):
            return AuthoringErrorResponse(
                code=self.code,
                message=self.message,
                current_version=self.current_version,
            ).model_dump(mode="json")
        return {
            "code": self.code.value,
            "message": self.message,
            "current_version": self.current_version,
        }
