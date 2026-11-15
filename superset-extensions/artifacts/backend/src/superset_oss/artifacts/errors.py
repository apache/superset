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
How an artifacts call fails: one error type for the tools, the endpoints and the
store, answered with the fields of the authoring contract's errors.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from enum import StrEnum
from typing import Any, TypeAlias

from superset_core.artifacts.authoring import (
    AuthoringErrorCode,
    AuthoringErrorResponse,
)
from superset_core.artifacts.provider import ArtifactRef, VersionNotFoundError


class ExtensionErrorCode(StrEnum):
    """
    Failures of this extension's own endpoints, which no authoring tool has.

    They answer with the same fields as ``AuthoringErrorResponse``.
    """

    # No pending publish request with this id: it was confirmed, replaced by a
    # newer request, expired or never made. Only the confirmation endpoint,
    # which the user calls rather than an agent, answers it.
    PUBLISH_REQUEST_NOT_FOUND = "PUBLISH_REQUEST_NOT_FOUND"


ErrorCode: TypeAlias = AuthoringErrorCode | ExtensionErrorCode


class ArtifactError(Exception):
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


@contextmanager
def translate_missing_version(ref: ArtifactRef) -> Iterator[None]:
    """
    Answer ``VERSION_NOT_FOUND`` when the provider no longer holds ``ref``.

    Wraps a provider call on ``ref``. A provider raises
    ``VersionNotFoundError`` when its store doesn't hold the version, as when
    a publish or a write lands between reading the version and the call.
    Only that exception turns into an answer: any other ``LookupError``, such
    as a ``KeyError`` from a bug, still surfaces as itself.
    """
    try:
        yield
    except VersionNotFoundError as ex:
        named = f"version {ref.version}" if ref.version else "draft"
        raise ArtifactError(
            AuthoringErrorCode.VERSION_NOT_FOUND,
            f"the provider holds no {named} of artifact {ref.artifact_id!r}; "
            "it may have changed meanwhile, so read it again, then retry",
        ) from ex
