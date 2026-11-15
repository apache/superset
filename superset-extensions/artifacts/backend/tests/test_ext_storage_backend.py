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
"""The extension-storage backend, against a fake of the storage it needs (S10)."""

from __future__ import annotations

import threading
from typing import Any

import pytest
from superset_core.artifacts.authoring import (
    ArtifactCreateRequest,
    ArtifactStrReplaceRequest,
    AuthoringErrorCode,
)
from superset_core.artifacts.store import ArtifactStoreBackend, MissingObjectsError
from superset_oss.artifacts.store import default_backend
from superset_oss.artifacts.store.errors import ArtifactStoreError
from superset_oss.artifacts.store.extension_storage_backend import (
    BackendUnavailableError,
    CorruptObjectError,
    ExtensionStorageBackend,
)
from superset_oss.artifacts.store.filestore import ArtifactFileStore


class GetSetStorage:
    """Extension storage as it is: get and set only."""

    def __init__(self) -> None:
        self.values: dict[str, Any] = {}

    def get(self, key: str) -> Any:
        return self.values.get(key)

    def set(self, key: str, value: Any, options: Any = None) -> None:
        self.values[key] = value


class AtomicStorage(GetSetStorage):
    """Extension storage with the compare-and-swap write S10 is to add."""

    def __init__(self) -> None:
        super().__init__()
        self.lock = threading.Lock()
        self.resources: dict[str, tuple[str | None, str | None]] = {}

    def compare_and_set(
        self,
        key: str,
        expected: Any,
        new: Any,
        *,
        resource_type: str | None = None,
        resource_uuid: str | None = None,
    ) -> bool:
        with self.lock:
            if self.values.get(key) != expected:
                return False
            self.values[key] = new
            self.resources[key] = (resource_type, resource_uuid)
            return True


def test_it_refuses_storage_without_compare_and_swap() -> None:
    with pytest.raises(BackendUnavailableError, match="S10"):
        ExtensionStorageBackend(GetSetStorage())  # type: ignore[arg-type]


def test_without_a_request_time_context_the_default_store_is_off() -> None:
    with pytest.raises(BackendUnavailableError, match="S11"):
        ExtensionStorageBackend.from_extension_context()
    with pytest.raises(ArtifactStoreError) as off:
        default_backend()
    assert off.value.code == AuthoringErrorCode.NOT_ENABLED


def test_blobs_trees_and_refs() -> None:
    storage = AtomicStorage()
    backend = ExtensionStorageBackend(storage)
    blob = backend.put_blob("ns", b"hello")
    tree = backend.put_tree("ns", {"index.html": blob})
    artifact_id = "00000000-0000-4000-8000-000000000000"

    assert isinstance(backend, ArtifactStoreBackend)
    assert backend.get_blob("ns", blob) == b"hello"
    assert backend.get_blob("other", blob) is None
    assert backend.get_tree("ns", tree) == {"index.html": blob}
    assert backend.missing_blobs("ns", [blob, "f" * 64]) == {"f" * 64}
    assert backend.compare_and_set_ref("ns", artifact_id, "draft", None, tree)
    assert not backend.compare_and_set_ref("ns", artifact_id, "draft", None, tree)
    assert backend.get_ref("ns", artifact_id, "draft") == tree
    assert storage.resources[f"artifacts/ns/ref/{artifact_id}/draft"] == (
        "artifact",
        artifact_id,
    )
    with pytest.raises(MissingObjectsError):
        backend.put_tree("ns", {"a.js": "e" * 64})
    with pytest.raises(MissingObjectsError):
        backend.compare_and_set_ref("ns", artifact_id, "draft", tree, "d" * 64)


def test_content_changed_in_storage_is_refused() -> None:
    storage = AtomicStorage()
    backend = ExtensionStorageBackend(storage)
    blob = backend.put_blob("ns", b"hello")
    tree = backend.put_tree("ns", {"index.html": blob})

    storage.values[f"artifacts/ns/blob/{blob}"] = "Z29vZGJ5ZQ=="  # "goodbye"
    storage.values[f"artifacts/ns/tree/{tree}"] = {"other.html": blob}

    with pytest.raises(CorruptObjectError):
        backend.get_blob("ns", blob)
    with pytest.raises(CorruptObjectError):
        backend.get_tree("ns", tree)


def test_the_file_store_runs_on_it() -> None:
    store = ArtifactFileStore(ExtensionStorageBackend(AtomicStorage()))
    created = store.create("1", ArtifactCreateRequest(files={"a.txt": "one"}))

    written = store.str_replace(
        "1",
        ArtifactStrReplaceRequest(
            artifact_id=created.artifact_id,
            base_version=created.version,
            path="a.txt",
            old_str="one",
            new_str="two",
        ),
    )

    assert store.draft_version("1", created.artifact_id) == written.version
