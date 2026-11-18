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
What each authoring tool does: the gate, then the store or the provider.

Pure Python, so the gate and the answers are testable without Flask or MCP;
``tools.py`` adds the MCP decorators, the caller's identity and the transfer
links. Every answer is a JSON-ready dict: the tool's response, or a failure
with the fields of ``AuthoringErrorResponse``. With no provider registered,
every tool answers ``NOT_ENABLED`` and touches nothing.
"""

from __future__ import annotations

import base64
import binascii
from collections.abc import Callable
from dataclasses import asdict, dataclass, is_dataclass, replace
from typing import Annotated, Any, Literal, TypeVar
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, PlainValidator
from superset_artifacts_sdk.authoring import (
    ArtifactBuildRequest,
    ArtifactCheckRequest,
    ArtifactCommitFilesRequest,
    ArtifactCreateFileRequest,
    ArtifactCreateRequest,
    ArtifactDeleteFileRequest,
    ArtifactHistoryRequest,
    ArtifactInsertRequest,
    ArtifactLandRequest,
    ArtifactManifestGetRequest,
    ArtifactManifestUpdateRequest,
    ArtifactMoveFileRequest,
    ArtifactRequestPublishRequest,
    ArtifactRestoreRequest,
    ArtifactScopedRequest,
    ArtifactSearchRequest,
    ArtifactStrReplaceRequest,
    ArtifactViewRequest,
    ArtifactWriteRequest,
    AuthoringErrorCode,
    AuthoringErrorResponse,
    BlobUploadTarget,
)
from superset_artifacts_sdk.manifest import ArtifactManifest, MANIFEST_FILE
from superset_artifacts_sdk.policy import ArtifactPolicy, manifest_problems
from superset_artifacts_sdk.provider import (
    ArtifactRef,
    ArtifactRuntimeProvider,
    Diagnostic,
)
from superset_oss.artifacts.access import ArtifactAccess, require_edit, require_read
from superset_oss.artifacts.authoring.transfer import TransferLinks
from superset_oss.artifacts.data.bindings import binding_problems
from superset_oss.artifacts.errors import (
    ArtifactError,
    translate_invalid_manifest,
    translate_missing_version,
)
from superset_oss.artifacts.frames.access import choose_version
from superset_oss.artifacts.gate import open_artifacts
from superset_oss.artifacts.store.filestore import ArtifactFileStore

Answer = dict[str, Any]
_Scoped = TypeVar("_Scoped", bound=ArtifactScopedRequest)

CONFIRMATION_MESSAGE = (
    "Nothing is published yet: publishing waits for the user. Tell them this "
    "version is ready for them to confirm in Superset, where the artifact is "
    "shown, under their own login. Don't ask them to confirm in this "
    "conversation, and don't report the artifact as published until they have."
)


class BlobUpload(BaseModel):
    """One file's content, for ``artifact_upload_blobs``."""

    model_config = ConfigDict(extra="forbid")

    content: str
    encoding: Literal["utf-8", "base64"] = "utf-8"

    def data(self) -> bytes:
        """The content's bytes; ``INVALID_ARGUMENT`` when it doesn't decode."""
        if self.encoding == "utf-8":
            try:
                return self.content.encode("utf-8")
            except UnicodeEncodeError as ex:
                raise ArtifactError(
                    AuthoringErrorCode.INVALID_ARGUMENT, "content isn't valid text"
                ) from ex
        try:
            return base64.b64decode(self.content, validate=True)
        except (binascii.Error, ValueError) as ex:
            raise ArtifactError(
                AuthoringErrorCode.INVALID_ARGUMENT, "content isn't valid base64"
            ) from ex


class ArtifactUploadBlobsRequest(ArtifactScopedRequest):
    """
    ``artifact_upload_blobs``: store file contents that a commit by hash lacks.

    The upload in a tool call, which the authoring contract leaves to the
    host: for agents that get no upload links, or whose shell can't reach
    them.
    """

    blobs: list[BlobUpload] = Field(min_length=1, max_length=200)


# The SDK's ArtifactManifestUpdateRequest validates the manifest along with
# the other arguments. There, a manifest the checks refuse, such as one with
# an event whose kind needs a capability it doesn't declare, fails as a
# malformed argument, which the MCP service answers without the reason. These
# arguments publish the manifest's schema but take the manifest as sent, so
# that the handler checks it and answers INVALID_MANIFEST with what's wrong.
class ArtifactManifestUpdateArguments(ArtifactWriteRequest):
    """``artifact_manifest_update``: replace the draft's ``manifest.json``."""

    manifest: Annotated[
        object,
        PlainValidator(lambda value: value, json_schema_input_type=ArtifactManifest),
    ]


def _jsonable(value: Any) -> Any:
    """Dataclasses, tuples and models as plain JSON values."""
    if is_dataclass(value) and not isinstance(value, type):
        return _jsonable(asdict(value))
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


@dataclass(frozen=True)
class _Call:
    """What a tool's action gets: the store, the provider, the policy, the caller."""

    store: ArtifactFileStore
    provider: ArtifactRuntimeProvider
    policy: ArtifactPolicy
    access: ArtifactAccess
    actor: str


Access = Literal["read", "edit"]


class AuthoringHandlers:
    """
    One method per authoring tool; each takes the caller and the request.

    A tool that reads an artifact needs the caller to read its widget, and one
    that changes it needs the caller to edit it; otherwise it answers
    ``ARTIFACT_NOT_FOUND``, as for an artifact that doesn't exist. A reader
    who isn't an editor reads only the published version, as frames serve
    it: the draft and the history are the editors' own.
    ``transfer_links`` gives the links that move bytes beside the model, read
    on each call; without them, every answer carries its bytes itself.
    """

    def __init__(
        self, transfer_links: Callable[[], TransferLinks | None] = lambda: None
    ) -> None:
        self._transfer_links = transfer_links

    def run(self, actor: str | None, action: Callable[[_Call], Answer]) -> Answer:
        """Run ``action`` behind the gate, answering failures as errors."""
        try:
            artifacts = open_artifacts()
            if not actor:
                raise ArtifactError(
                    AuthoringErrorCode.ARTIFACT_NOT_FOUND,
                    "only a signed-in user writes artifacts",
                )
            return action(
                _Call(
                    artifacts.store,
                    artifacts.provider,
                    artifacts.policy,
                    artifacts.access,
                    actor,
                )
            )
        except ArtifactError as ex:
            return ex.to_dict()

    def _on_artifact(
        self,
        actor: str | None,
        request: ArtifactScopedRequest,
        access: Access,
        action: Callable[[_Call], object],
    ) -> Answer:
        """Run ``action`` on the artifact ``request`` names, with ``access`` to it."""

        def checked(call: _Call) -> Answer:
            require = require_edit if access == "edit" else require_read
            require(call.access, request.artifact_id)
            return _jsonable(action(call))

        return self.run(actor, checked)

    @staticmethod
    def _readable(
        call: _Call, artifact_id: str, asked: str | None = None
    ) -> str | None:
        """
        The version a read may show the caller: ``asked`` (``None`` for the
        draft) for an editor, and only the published one for anyone else.
        """
        if call.access.can_edit(artifact_id):
            return asked
        served = choose_version(call.store, artifact_id, can_edit=False)
        if asked is not None and asked != served.version:
            raise ArtifactError(
                AuthoringErrorCode.VERSION_NOT_FOUND,
                "only the published version is readable to you",
            )
        return served.version

    def _store(
        self,
        actor: str | None,
        operation: Callable[[ArtifactFileStore, _Scoped], object],
        request: _Scoped,
        access: Access,
    ) -> Answer:
        """Answer ``request`` with what a file store ``operation`` returns."""
        return self._on_artifact(
            actor, request, access, lambda call: operation(call.store, request)
        )

    def create(self, actor: str | None, request: ArtifactCreateRequest) -> Answer:
        def action(call: _Call) -> Answer:
            artifact_id = str(uuid4())
            # The content first: if the widget can't be saved, what was
            # stored is never reachable, and the store drops it later.
            created = call.store.create(artifact_id, request)
            call.access.register(artifact_id, request.title or "Artifact", call.actor)
            return _jsonable(created)

        return self.run(actor, action)

    def view(self, actor: str | None, request: ArtifactViewRequest) -> Answer:
        return self._on_artifact(
            actor,
            request,
            "read",
            lambda call: call.store.view(
                request, version=self._readable(call, request.artifact_id)
            ),
        )

    def create_file(
        self, actor: str | None, request: ArtifactCreateFileRequest
    ) -> Answer:
        return self._store(actor, ArtifactFileStore.create_file, request, "edit")

    def str_replace(
        self, actor: str | None, request: ArtifactStrReplaceRequest
    ) -> Answer:
        return self._store(actor, ArtifactFileStore.str_replace, request, "edit")

    def insert(self, actor: str | None, request: ArtifactInsertRequest) -> Answer:
        return self._store(actor, ArtifactFileStore.insert, request, "edit")

    def delete_file(
        self, actor: str | None, request: ArtifactDeleteFileRequest
    ) -> Answer:
        return self._store(actor, ArtifactFileStore.delete_file, request, "edit")

    def move_file(self, actor: str | None, request: ArtifactMoveFileRequest) -> Answer:
        return self._store(actor, ArtifactFileStore.move_file, request, "edit")

    def search(self, actor: str | None, request: ArtifactSearchRequest) -> Answer:
        return self._on_artifact(
            actor,
            request,
            "read",
            lambda call: call.store.search(
                request, version=self._readable(call, request.artifact_id)
            ),
        )

    def history(self, actor: str | None, request: ArtifactHistoryRequest) -> Answer:
        return self._store(actor, ArtifactFileStore.history, request, "edit")

    def restore(self, actor: str | None, request: ArtifactRestoreRequest) -> Answer:
        return self._store(actor, ArtifactFileStore.restore, request, "edit")

    def manifest_get(
        self, actor: str | None, request: ArtifactManifestGetRequest
    ) -> Answer:
        def action(call: _Call) -> Answer:
            version, manifest = call.store.manifest_get(
                request, version=self._readable(call, request.artifact_id)
            )
            return {
                "version": version,
                "manifest": manifest.model_dump(mode="json", exclude_none=True),
            }

        return self._on_artifact(actor, request, "read", action)

    def manifest_update(
        self, actor: str | None, request: ArtifactManifestUpdateArguments
    ) -> Answer:
        def action(call: _Call) -> object:
            with translate_invalid_manifest():
                manifest = ArtifactManifest.model_validate(request.manifest)
            checked = ArtifactManifestUpdateRequest(
                artifact_id=request.artifact_id,
                base_version=request.base_version,
                manifest=manifest,
            )
            return call.store.manifest_update(checked)

        return self._on_artifact(actor, request, "edit", action)

    def request_publish(
        self, actor: str | None, request: ArtifactRequestPublishRequest
    ) -> Answer:
        def action(call: _Call) -> Answer:
            publish = call.store.request_publish(call.actor, request)
            answer = AuthoringErrorResponse(
                code=AuthoringErrorCode.CONFIRMATION_REQUIRED,
                message=CONFIRMATION_MESSAGE,
                current_version=publish.version,
            ).model_dump(mode="json")
            return {
                **answer,
                "publish_request_id": publish.request_id,
                "expires_at": publish.expires_at.isoformat(),
            }

        return self._on_artifact(actor, request, "edit", action)

    def build(self, actor: str | None, request: ArtifactBuildRequest) -> Answer:
        def action(call: _Call) -> Answer:
            artifact_id, version = call.store.resolve_version(
                request.artifact_id, request.version
            )
            manifest = call.store.manifest_at(artifact_id, version)
            ref = ArtifactRef(artifact_id, version)
            with translate_missing_version(ref):
                result = call.provider.build(ref, call.policy)
            # The extension's own checks, on top of the build's: what the
            # policy refuses fails the build, as publishing it would; a
            # binding that the host's data request can't run only warns.
            refused = tuple(
                Diagnostic(problem, file=MANIFEST_FILE)
                for problem in manifest_problems(manifest, call.policy)
            )
            warnings = tuple(
                Diagnostic(problem, severity="warning", file=MANIFEST_FILE)
                for problem in binding_problems(manifest)
            )
            result = replace(
                result,
                ok=result.ok and not refused,
                diagnostics=result.diagnostics + refused + warnings,
            )
            return {"version": version, **_jsonable(result)}

        return self._on_artifact(actor, request, "edit", action)

    def check(self, actor: str | None, request: ArtifactCheckRequest) -> Answer:
        def action(call: _Call) -> Answer:
            artifact_id, version = call.store.resolve_version(
                request.artifact_id, request.version
            )
            ref = ArtifactRef(artifact_id, version)
            with translate_missing_version(ref):
                result = call.provider.check(ref, call.policy)
            return {"version": version, **_jsonable(result)}

        return self._on_artifact(actor, request, "edit", action)

    def commit_files(
        self, actor: str | None, request: ArtifactCommitFilesRequest
    ) -> Answer:
        def action(call: _Call) -> object:
            answer = call.store.commit_files(request)
            links = self._transfer_links()
            if not answer.missing or links is None or not links.uploads:
                return answer
            artifact_id = call.store.canonical_id(request.artifact_id)
            uploads = []
            expires_at = None
            for blob_hash in answer.missing:
                url, expires_at = links.upload(artifact_id, blob_hash, call.actor)
                uploads.append(BlobUploadTarget(sha256=blob_hash, url=url))
            return answer.model_copy(
                update={"uploads": uploads, "uploads_expire_at": expires_at}
            )

        return self._on_artifact(actor, request, "edit", action)

    def land(self, actor: str | None, request: ArtifactLandRequest) -> Answer:
        def action(call: _Call) -> object:
            version = self._readable(call, request.artifact_id, request.version)
            answer = call.store.land(request.model_copy(update={"version": version}))
            links = self._transfer_links()
            if request.inline or links is None:
                return answer
            url, expires_at = links.download(
                answer.artifact_id, answer.version, call.actor
            )
            return answer.model_copy(
                update={"download_url": url, "expires_at": expires_at}
            )

        return self._on_artifact(actor, request, "read", action)

    def upload_blobs(
        self, actor: str | None, request: ArtifactUploadBlobsRequest
    ) -> Answer:
        def action(call: _Call) -> Answer:
            contents = [blob.data() for blob in request.blobs]
            return {"hashes": call.store.put_blobs(contents)}

        return self._on_artifact(actor, request, "edit", action)
