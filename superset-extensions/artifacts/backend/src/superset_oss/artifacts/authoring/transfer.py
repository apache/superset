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
Short-lived links that move an artifact's bytes beside the model.

An agent with a shell uploads the blobs that a commit by hash lacks, and
downloads a version as a tar, with ``curl``, so that the bytes never pass
through the model. Each link is signed, expires soon, and is bound to one
artifact and to one blob (an upload, checked against the blob's SHA-256 on
receipt) or one version (a download). Its token is a bearer credential, and
it passes through the model's context: that is why it lives only minutes.

Pure Python: ``transfer_api`` serves the links, and the tools mint them.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from itsdangerous import BadSignature, URLSafeSerializer
from superset_artifacts_sdk.authoring import AuthoringErrorCode
from superset_artifacts_sdk.policy import ArtifactPolicy
from superset_artifacts_sdk.store import is_sha256_hex, sha256_hex
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.store.filestore import ArtifactFileStore

TRANSFER_TTL = timedelta(minutes=10)
# Kept apart from every other use of the deployment's secret key.
_SALT = "superset-oss.artifacts.transfer"

TransferKind = Literal["blob", "version"]


class InvalidTransferError(Exception):
    """A transfer token that is forged, malformed, expired or of another kind."""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class Transfer:
    """What a transfer token grants: one blob or one version of one artifact."""

    kind: TransferKind
    artifact_id: str
    # The blob's SHA-256, or the version.
    target: str
    # Who minted it, for the record.
    actor: str
    expires_at: datetime


class TransferSigner:
    """Signs and checks transfer tokens with the deployment's secret key."""

    def __init__(
        self,
        secret_key: str | bytes,
        *,
        ttl: timedelta = TRANSFER_TTL,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._serializer = URLSafeSerializer(
            secret_key, salt=_SALT, signer_kwargs={"digest_method": hashlib.sha256}
        )
        self._ttl = ttl
        self._now = clock

    def sign(
        self, kind: TransferKind, artifact_id: str, target: str, actor: str
    ) -> tuple[str, datetime]:
        """A token for ``target`` of ``artifact_id``, and when it expires."""
        if not is_sha256_hex(target):
            raise ValueError(f"{target!r} is not a blob hash or a version")
        expires_at = self._now() + self._ttl
        payload = {
            "k": kind,
            "a": artifact_id,
            "t": target,
            "u": actor,
            "e": int(expires_at.timestamp()),
        }
        return str(self._serializer.dumps(payload)), expires_at

    def verify(self, token: str, kind: TransferKind) -> Transfer:
        """What ``token`` grants; ``InvalidTransferError`` unless it is valid now."""
        try:
            payload: Any = self._serializer.loads(token)
        except BadSignature as ex:
            raise InvalidTransferError("the link isn't valid") from ex
        if not (
            isinstance(payload, dict)
            and payload.get("k") == kind
            and isinstance(payload.get("a"), str)
            and is_sha256_hex(payload.get("t"))
            and isinstance(payload.get("u"), str)
            and isinstance(payload.get("e"), int)
        ):
            raise InvalidTransferError("the link isn't valid")
        expires_at = datetime.fromtimestamp(payload["e"], timezone.utc)
        if self._now() >= expires_at:
            raise InvalidTransferError("the link has expired; ask for a new one")
        return Transfer(kind, payload["a"], payload["t"], payload["u"], expires_at)


class TransferLinks:
    """
    Mints the URLs of the transfer routes under ``base_url``.

    ``uploads`` says whether the host can take an upload there: an upload has
    no session, so only a route exempt from CSRF checks takes it.
    """

    def __init__(self, signer: TransferSigner, base_url: str, *, uploads: bool) -> None:
        self._signer = signer
        self._base_url = base_url.rstrip("/")
        self.uploads = uploads

    def upload(
        self, artifact_id: str, blob_hash: str, actor: str
    ) -> tuple[str, datetime]:
        """Where to ``PUT`` one blob's exact bytes, and until when."""
        token, expires_at = self._signer.sign("blob", artifact_id, blob_hash, actor)
        return f"{self._base_url}/blobs/{token}", expires_at

    def download(
        self, artifact_id: str, version: str, actor: str
    ) -> tuple[str, datetime]:
        """Where to ``GET`` a tar of one version, and until when."""
        token, expires_at = self._signer.sign("version", artifact_id, version, actor)
        return f"{self._base_url}/versions/{token}", expires_at


def receive_blob(
    store: ArtifactFileStore,
    policy: ArtifactPolicy,
    transfer: Transfer,
    read: Callable[[int], bytes],
    content_length: int | None,
) -> str:
    """
    Store the blob that ``transfer`` names, from a request body that ``read``
    gives at most so many bytes of; return its hash.

    ``TOO_LARGE`` past the policy's size limit for a file, and
    ``INVALID_ARGUMENT`` for bytes that aren't the blob the link names.
    """
    limit = policy.limits.file_bytes
    too_large = ArtifactError(
        AuthoringErrorCode.TOO_LARGE, f"a file is over {limit} bytes"
    )
    if (content_length or 0) > limit:
        raise too_large
    data = read(limit + 1)
    if len(data) > limit:
        raise too_large
    if sha256_hex(data) != transfer.target:
        raise ArtifactError(
            AuthoringErrorCode.INVALID_ARGUMENT,
            "the content doesn't match the SHA-256 its link names",
        )
    [stored] = store.put_blobs([data])
    return stored
