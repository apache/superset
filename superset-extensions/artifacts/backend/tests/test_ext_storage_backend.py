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
The extension-storage backend: the SDK's backend contract, then what is its own.

It runs against a fake of extension storage's shared accessor, which keeps
values as JSON and compares them on its compare-and-swap write as the host
does: decoded, under one lock.
"""

from __future__ import annotations

import json  # noqa: TID251 -- pure test; the host's JSON utility needs Flask.
import threading
from typing import Any

import pytest
from superset_artifacts_sdk.authoring import (
    ArtifactCreateRequest,
    ArtifactStrReplaceRequest,
    AuthoringErrorCode,
)
from superset_artifacts_sdk.store import ArtifactStoreBackend, DRAFT_REF
from superset_artifacts_sdk.testing import (
    ArtifactStoreBackendConformance,
    InMemoryArtifactStore,
)
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.store import default_backend, file_store_for
from superset_oss.artifacts.store.extension_storage_backend import (
    BackendUnavailableError,
    CorruptObjectError,
    ExtensionStorageBackend,
)
from superset_oss.artifacts.store.filestore import ArtifactFileStore

ARTIFACT_ID = "00000000-0000-4000-8000-000000000000"


class SharedStorage:
    """Extension storage's shared accessor: JSON values, and compare-and-swap."""

    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.lock = threading.Lock()

    def get(self, key: str) -> Any:
        with self.lock:
            stored = self.values.get(key)
        return None if stored is None else json.loads(stored)

    def set(self, key: str, value: Any, options: Any = None) -> None:
        with self.lock:
            self.values[key] = json.dumps(value)

    def compare_and_set(
        self, key: str, expected: Any, value: Any, options: Any = None
    ) -> bool:
        with self.lock:
            stored = self.values.get(key)
            current = None if stored is None else json.loads(stored)
            if (stored is None) != (expected is None) or current != expected:
                return False
            self.values[key] = json.dumps(value)
            return True


@pytest.fixture
def storage() -> SharedStorage:
    return SharedStorage()


@pytest.fixture
def artifact_store(storage: SharedStorage) -> ExtensionStorageBackend:
    """A new, empty backend for each test of the SDK's backend contract."""
    return ExtensionStorageBackend(storage)


class TestExtensionStorageBackend(ArtifactStoreBackendConformance):
    """The backend on extension storage passes the SDK's backend contract."""


class TestExtensionStorageBackendWithShortRecords(ArtifactStoreBackendConformance):
    """The contract again, with histories that spill into chunks after 2 moves."""

    @pytest.fixture
    def artifact_store(self, storage: SharedStorage) -> ExtensionStorageBackend:
        return ExtensionStorageBackend(storage, history_chunk_size=2)


def _moves(backend: ExtensionStorageBackend, count: int) -> list[str]:
    """Move the draft through ``count`` new versions; return them, oldest first."""
    versions = []
    expected = None
    for index in range(count):
        blob = backend.put_blob(f"v{index}".encode())
        version = backend.put_tree({"index.html": blob})
        assert backend.compare_and_set_ref(ARTIFACT_ID, DRAFT_REF, expected, version)
        versions.append(version)
        expected = version
    return versions


def test_a_ref_and_its_history_are_one_record(storage: SharedStorage) -> None:
    """One write moves both, so no crash can leave a move unrecorded."""
    backend = ExtensionStorageBackend(storage)
    versions = _moves(backend, 2)

    record = json.loads(storage.values[f"artifacts/ref/{ARTIFACT_ID}/{DRAFT_REF}"])
    assert record == {
        "target": versions[1],
        "total": 2,
        "recent": versions,
        "chunks": [],
    }


def test_older_history_rolls_into_immutable_chunks(storage: SharedStorage) -> None:
    backend = ExtensionStorageBackend(storage, history_chunk_size=3)
    versions = _moves(backend, 8)

    record = json.loads(storage.values[f"artifacts/ref/{ARTIFACT_ID}/{DRAFT_REF}"])
    # Two full chunks of 3, and the newest 2 in the record itself.
    assert record["recent"] == versions[6:]
    assert len(record["chunks"]) == 2
    assert (
        json.loads(storage.values[f"artifacts/history/{record['chunks'][0]}"])
        == (versions[:3])
    )
    history = backend.ref_history(ARTIFACT_ID, DRAFT_REF, offset=1, limit=6)
    assert history.versions == tuple(reversed(versions))[1:7]
    assert history.total == 8
    assert all(backend.ref_has_held(ARTIFACT_ID, DRAFT_REF, v) for v in versions)


def test_a_record_stays_small_however_long_its_history(
    storage: SharedStorage,
) -> None:
    backend = ExtensionStorageBackend(storage, history_chunk_size=4)
    _moves(backend, 4 * 25 + 1)

    record = json.loads(storage.values[f"artifacts/ref/{ARTIFACT_ID}/{DRAFT_REF}"])
    assert len(record["recent"]) == 1
    assert len(record["chunks"]) == 25


def test_a_changed_history_chunk_is_refused(storage: SharedStorage) -> None:
    backend = ExtensionStorageBackend(storage, history_chunk_size=2)
    versions = _moves(backend, 3)
    record = json.loads(storage.values[f"artifacts/ref/{ARTIFACT_ID}/{DRAFT_REF}"])
    chunk_key = f"artifacts/history/{record['chunks'][0]}"
    storage.values[chunk_key] = json.dumps([versions[1], versions[0]])

    with pytest.raises(CorruptObjectError):
        backend.ref_history(ARTIFACT_ID, DRAFT_REF, offset=1, limit=2)
    with pytest.raises(CorruptObjectError):
        backend.ref_has_held(ARTIFACT_ID, DRAFT_REF, versions[0])


def test_a_malformed_ref_record_is_refused(storage: SharedStorage) -> None:
    backend = ExtensionStorageBackend(storage)
    storage.set(f"artifacts/ref/{ARTIFACT_ID}/{DRAFT_REF}", "a" * 64)

    with pytest.raises(CorruptObjectError):
        backend.get_ref(ARTIFACT_ID, DRAFT_REF)


def test_without_a_request_time_context_the_default_store_is_off() -> None:
    with pytest.raises(BackendUnavailableError, match="while a request runs"):
        ExtensionStorageBackend.from_extension_context()
    with pytest.raises(ArtifactError) as off:
        default_backend()
    assert off.value.code == AuthoringErrorCode.NOT_ENABLED


def test_content_changed_in_storage_is_refused(
    artifact_store: ExtensionStorageBackend, storage: SharedStorage
) -> None:
    blob = artifact_store.put_blob(b"hello")
    tree = artifact_store.put_tree({"index.html": blob})

    storage.set(f"artifacts/blob/{blob}", "Z29vZGJ5ZQ==")  # "goodbye"
    storage.set(f"artifacts/tree/{tree}", {"other.html": blob})

    with pytest.raises(CorruptObjectError):
        artifact_store.get_blob(blob)
    with pytest.raises(CorruptObjectError):
        artifact_store.get_tree(tree)


def test_the_file_store_runs_on_it(artifact_store: ExtensionStorageBackend) -> None:
    store = ArtifactFileStore(artifact_store)
    created = store.create(ARTIFACT_ID, ArtifactCreateRequest(files={"a.txt": "one"}))

    written = store.str_replace(
        ArtifactStrReplaceRequest(
            artifact_id=created.artifact_id,
            base_version=created.version,
            path="a.txt",
            old_str="one",
            new_str="two",
        ),
    )

    assert store.draft_version(created.artifact_id) == written.version


class StoreOnly:
    """A provider's store role and nothing else."""

    def __init__(self, backend: ArtifactStoreBackend | None) -> None:
        self.backend = backend

    def store_backend(self) -> ArtifactStoreBackend | None:
        return self.backend


def test_the_file_store_needs_only_the_providers_store_role() -> None:
    backend = InMemoryArtifactStore()
    created = file_store_for(StoreOnly(backend)).create(
        ARTIFACT_ID, ArtifactCreateRequest()
    )

    assert backend.get_ref(created.artifact_id, DRAFT_REF) == created.version
    # Without a backend of the provider's, the default one can't run yet.
    with pytest.raises(ArtifactError) as off:
        file_store_for(StoreOnly(None))
    assert off.value.code == AuthoringErrorCode.NOT_ENABLED
