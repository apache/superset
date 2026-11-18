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
"""Transfer links: what a token grants, for how long, and the upload's checks."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from superset_artifacts_sdk.authoring import AuthoringErrorCode
from superset_artifacts_sdk.policy import policy_layer
from superset_artifacts_sdk.store import sha256_hex
from superset_artifacts_sdk.testing import InMemoryArtifactStore
from superset_oss.artifacts.authoring.transfer import (
    InvalidTransferError,
    receive_blob,
    Transfer,
    TRANSFER_TTL,
    TransferLinks,
    TransferSigner,
)
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.store.filestore import ArtifactFileStore

ARTIFACT = str(uuid4())
BLOB = b"export const answer = 42;\n"
BLOB_HASH = sha256_hex(BLOB)
VERSION = sha256_hex(b"a version")
POLICY = policy_layer({"profile": "locked", "limits": {"file_bytes": 64}})


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 11, 18, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def signer(clock: Clock) -> TransferSigner:
    return TransferSigner("a secret key", clock=clock)


def test_a_token_grants_what_it_was_signed_for(
    signer: TransferSigner, clock: Clock
) -> None:
    token, expires_at = signer.sign("blob", ARTIFACT, BLOB_HASH, "7")

    assert expires_at == clock.now + TRANSFER_TTL
    assert signer.verify(token, "blob") == Transfer(
        "blob", ARTIFACT, BLOB_HASH, "7", expires_at
    )


def test_a_token_expires(signer: TransferSigner, clock: Clock) -> None:
    token, _ = signer.sign("version", ARTIFACT, VERSION, "7")
    clock.now += TRANSFER_TTL - timedelta(seconds=1)
    signer.verify(token, "version")

    clock.now += timedelta(seconds=1)
    with pytest.raises(InvalidTransferError, match="expired"):
        signer.verify(token, "version")


def test_a_token_works_only_on_its_own_route(signer: TransferSigner) -> None:
    token, _ = signer.sign("blob", ARTIFACT, BLOB_HASH, "7")
    with pytest.raises(InvalidTransferError):
        signer.verify(token, "version")


@pytest.mark.parametrize(
    "forge",
    [
        lambda token: TransferSigner("another key").sign(
            "blob", ARTIFACT, BLOB_HASH, "7"
        )[0],
        lambda token: token[:-2] + ("AA" if not token.endswith("AA") else "BB"),
        lambda token: token.replace(token.split(".")[0], "e30", 1),
        lambda token: "not a token",
    ],
)
def test_a_forged_or_altered_token_is_refused(
    signer: TransferSigner, forge: Callable[[str], str]
) -> None:
    token, _ = signer.sign("blob", ARTIFACT, BLOB_HASH, "7")
    with pytest.raises(InvalidTransferError):
        signer.verify(forge(token), "blob")


def test_only_hashes_are_signed(signer: TransferSigner) -> None:
    with pytest.raises(ValueError, match="blob hash or a version"):
        signer.sign("blob", ARTIFACT, "../../etc/passwd", "7")


def test_links_carry_the_token_under_the_base_url(signer: TransferSigner) -> None:
    links = TransferLinks(signer, "https://superset.example/t/", uploads=True)

    upload, _ = links.upload(ARTIFACT, BLOB_HASH, "7")
    download, _ = links.download(ARTIFACT, VERSION, "7")

    assert upload.startswith("https://superset.example/t/blobs/")
    assert download.startswith("https://superset.example/t/versions/")
    assert signer.verify(upload.rsplit("/", 1)[1], "blob").target == BLOB_HASH
    assert signer.verify(download.rsplit("/", 1)[1], "version").target == VERSION


@pytest.fixture
def backend() -> InMemoryArtifactStore:
    return InMemoryArtifactStore()


@pytest.fixture
def store(backend: InMemoryArtifactStore) -> ArtifactFileStore:
    return ArtifactFileStore(backend, policy=POLICY)


def _transfer(blob_hash: str = BLOB_HASH) -> Transfer:
    return Transfer(
        "blob", ARTIFACT, blob_hash, "7", datetime(2026, 11, 18, tzinfo=timezone.utc)
    )


def _body(data: bytes) -> Callable[[int], bytes]:
    return lambda size: data[:size]


def test_an_upload_stores_exactly_the_blob_its_link_names(
    store: ArtifactFileStore, backend: InMemoryArtifactStore
) -> None:
    stored = receive_blob(store, POLICY, _transfer(), _body(BLOB), len(BLOB))

    assert stored == BLOB_HASH
    assert backend.get_blob(BLOB_HASH) == BLOB


@pytest.mark.parametrize(
    ("body", "content_length", "code"),
    [
        (b"export const answer = 41;\n", None, AuthoringErrorCode.INVALID_ARGUMENT),
        (b"", 0, AuthoringErrorCode.INVALID_ARGUMENT),
        (b"x" * 65, None, AuthoringErrorCode.TOO_LARGE),
        (BLOB, 65, AuthoringErrorCode.TOO_LARGE),
    ],
)
def test_an_upload_refuses_other_bytes_and_oversized_bodies(
    store: ArtifactFileStore,
    backend: InMemoryArtifactStore,
    body: bytes,
    content_length: int | None,
    code: AuthoringErrorCode,
) -> None:
    with pytest.raises(ArtifactError) as raised:
        receive_blob(store, POLICY, _transfer(), _body(body), content_length)
    assert raised.value.code == code
    assert backend.missing_blobs([sha256_hex(body)]) == {sha256_hex(body)}
