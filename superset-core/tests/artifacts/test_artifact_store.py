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

"""The file store contract: paths, hashing and the in-memory backend."""

from __future__ import annotations

import hashlib
import threading

import pytest
from superset_core.artifacts.store import (
    ArtifactStoreBackend,
    DRAFT_REF,
    InvalidPathError,
    is_sha256_hex,
    MAX_PATH_LENGTH,
    MissingObjectsError,
    normalize_path,
    PUBLISHED_REF,
    sha256_hex,
    tree_hash,
    validate_tree,
)
from superset_core.artifacts.testing import InMemoryArtifactStore

EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
NAMESPACE = "workspace-1"
ARTIFACT = "artifact-1"


def _commit(store: InMemoryArtifactStore, files: dict[str, bytes]) -> str:
    """Store ``files`` as blobs plus a tree, and return the tree's hash."""
    tree = {path: store.put_blob(NAMESPACE, data) for path, data in files.items()}
    return store.put_tree(NAMESPACE, tree)


def test_sha256_hex_matches_known_digests() -> None:
    assert sha256_hex(b"") == EMPTY_SHA256
    assert sha256_hex(b"abc") == ABC_SHA256


@pytest.mark.parametrize(
    "value", [EMPTY_SHA256.upper(), EMPTY_SHA256[:-1], f"{EMPTY_SHA256}0", None, 1]
)
def test_is_sha256_hex_rejects_other_forms(value: object) -> None:
    assert not is_sha256_hex(value)


@pytest.mark.parametrize(
    ("raw", "normalized"),
    [
        ("index.html", "index.html"),
        ("./src/app.js", "src/app.js"),
        ("src//app.js", "src/app.js"),
        ("src/./app.js", "src/app.js"),
        ("src/", "src"),
        ("a/b/c.txt", "a/b/c.txt"),
        ("dir with spaces/file.js", "dir with spaces/file.js"),
        # NFC: "e" plus a combining acute accent becomes one character.
        ("cafe\u0301.txt", "caf\u00e9.txt"),
    ],
)
def test_normalize_path_returns_the_canonical_form(raw: str, normalized: str) -> None:
    assert normalize_path(raw) == normalized


@pytest.mark.parametrize(
    "path",
    [
        "",
        ".",
        "./",
        "/",
        "/etc/passwd",
        "..",
        "../index.html",
        "src/../../index.html",
        "src/..",
        "src\\app.js",
        "C:\\index.html",
        "a\x00b",
        "a\nb",
        "a\tb",
        "a\x7fb",
        "a\x85b",
    ],
)
def test_normalize_path_rejects_unsafe_paths(path: str) -> None:
    with pytest.raises(InvalidPathError):
        normalize_path(path)


def test_normalize_path_allows_255_characters() -> None:
    assert MAX_PATH_LENGTH == 255
    assert normalize_path("x" * 255) == "x" * 255
    with pytest.raises(InvalidPathError, match="255"):
        normalize_path("x" * 256)


def test_normalize_path_rejects_non_strings() -> None:
    with pytest.raises(InvalidPathError, match="string"):
        normalize_path(42)  # type: ignore[arg-type]


def test_invalid_path_error_is_a_value_error() -> None:
    """So that pydantic validators report it as a validation error."""
    assert issubclass(InvalidPathError, ValueError)


def test_tree_hash_is_the_sha256_of_canonical_json() -> None:
    tree = {"src/app.js": ABC_SHA256, "index.html": EMPTY_SHA256}
    canonical = f'{{"index.html":"{EMPTY_SHA256}","src/app.js":"{ABC_SHA256}"}}'
    assert tree_hash(tree) == hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def test_tree_hash_ignores_insertion_order() -> None:
    forward = {"a.txt": EMPTY_SHA256, "b.txt": ABC_SHA256}
    backward = {"b.txt": ABC_SHA256, "a.txt": EMPTY_SHA256}
    assert tree_hash(forward) == tree_hash(backward)


def test_tree_hash_encodes_non_ascii_paths_as_utf8() -> None:
    canonical = f'{{"caf\u00e9.txt":"{EMPTY_SHA256}"}}'
    expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    assert tree_hash({"caf\u00e9.txt": EMPTY_SHA256}) == expected


def test_tree_hash_of_the_empty_tree() -> None:
    assert tree_hash({}) == sha256_hex(b"{}")


def test_validate_tree_accepts_a_valid_tree() -> None:
    validate_tree({"index.html": EMPTY_SHA256, "src/app.js": ABC_SHA256})


def test_validate_tree_rejects_unnormalized_paths() -> None:
    with pytest.raises(InvalidPathError, match="not normalized"):
        validate_tree({"./index.html": EMPTY_SHA256})


@pytest.mark.parametrize("blob_hash", [EMPTY_SHA256.upper(), "abc", ""])
def test_validate_tree_rejects_malformed_hashes(blob_hash: str) -> None:
    with pytest.raises(ValueError, match="malformed blob hash"):
        validate_tree({"index.html": blob_hash})


def test_validate_tree_rejects_a_file_that_is_also_a_directory() -> None:
    with pytest.raises(InvalidPathError, match="is a file"):
        validate_tree({"src": EMPTY_SHA256, "src/app.js": ABC_SHA256})


def test_in_memory_store_implements_the_backend_protocol() -> None:
    assert isinstance(InMemoryArtifactStore(), ArtifactStoreBackend)


def test_blobs_are_content_addressed_and_idempotent() -> None:
    store = InMemoryArtifactStore()
    blob_hash = store.put_blob(NAMESPACE, b"hello")
    assert blob_hash == sha256_hex(b"hello")
    assert store.put_blob(NAMESPACE, bytearray(b"hello")) == blob_hash
    assert store.get_blob(NAMESPACE, blob_hash) == b"hello"
    assert store.get_blob(NAMESPACE, sha256_hex(b"other")) is None


def test_put_blob_rejects_text() -> None:
    store = InMemoryArtifactStore()
    with pytest.raises(TypeError, match="bytes"):
        store.put_blob(NAMESPACE, "hello")  # type: ignore[arg-type]


def test_missing_blobs_lists_what_to_upload() -> None:
    store = InMemoryArtifactStore()
    stored = store.put_blob(NAMESPACE, b"kept")
    absent = sha256_hex(b"new")
    assert store.missing_blobs(NAMESPACE, [stored, absent]) == {absent}
    assert store.missing_blobs(NAMESPACE, []) == set()


def test_malformed_hashes_are_rejected() -> None:
    store = InMemoryArtifactStore()
    with pytest.raises(ValueError, match="SHA-256"):
        store.get_blob(NAMESPACE, "not-a-hash")
    with pytest.raises(ValueError, match="SHA-256"):
        store.missing_blobs(NAMESPACE, ["not-a-hash"])
    with pytest.raises(ValueError, match="SHA-256"):
        store.get_tree(NAMESPACE, EMPTY_SHA256.upper())


def test_put_tree_needs_every_blob() -> None:
    store = InMemoryArtifactStore()
    stored = store.put_blob(NAMESPACE, b"<html></html>")
    absent = sha256_hex(b"console.log(1)")
    with pytest.raises(MissingObjectsError) as excinfo:
        store.put_tree(NAMESPACE, {"index.html": stored, "app.js": absent})
    assert excinfo.value.missing == frozenset({absent})


def test_put_tree_validates_the_tree() -> None:
    store = InMemoryArtifactStore()
    blob_hash = store.put_blob(NAMESPACE, b"x")
    with pytest.raises(InvalidPathError):
        store.put_tree(NAMESPACE, {"../x.js": blob_hash})


def test_trees_are_content_addressed_and_copied() -> None:
    store = InMemoryArtifactStore()
    tree = {"index.html": store.put_blob(NAMESPACE, b"<html></html>")}
    digest = store.put_tree(NAMESPACE, tree)
    assert digest == tree_hash(tree)
    assert store.put_tree(NAMESPACE, dict(tree)) == digest

    tree["extra.js"] = EMPTY_SHA256
    fetched = store.get_tree(NAMESPACE, digest)
    assert fetched == {"index.html": sha256_hex(b"<html></html>")}
    assert fetched is not None
    fetched["other.js"] = EMPTY_SHA256
    assert store.get_tree(NAMESPACE, digest) == {
        "index.html": sha256_hex(b"<html></html>")
    }
    assert store.get_tree(NAMESPACE, ABC_SHA256) is None


def test_namespaces_keep_objects_apart() -> None:
    store = InMemoryArtifactStore()
    blob_hash = store.put_blob("workspace-a", b"secret")
    digest = store.put_tree("workspace-a", {"data.json": blob_hash})
    assert store.compare_and_set_ref("workspace-a", ARTIFACT, DRAFT_REF, None, digest)

    assert store.get_blob("workspace-b", blob_hash) is None
    assert store.missing_blobs("workspace-b", [blob_hash]) == {blob_hash}
    assert store.get_tree("workspace-b", digest) is None
    assert store.get_ref("workspace-b", ARTIFACT, DRAFT_REF) is None
    with pytest.raises(MissingObjectsError):
        store.put_tree("workspace-b", {"data.json": blob_hash})
    with pytest.raises(MissingObjectsError):
        store.compare_and_set_ref("workspace-b", ARTIFACT, DRAFT_REF, None, digest)


def test_compare_and_set_creates_a_ref_only_if_it_is_unset() -> None:
    store = InMemoryArtifactStore()
    first = _commit(store, {"index.html": b"v1"})
    second = _commit(store, {"index.html": b"v2"})
    assert store.get_ref(NAMESPACE, ARTIFACT, DRAFT_REF) is None

    assert store.compare_and_set_ref(NAMESPACE, ARTIFACT, DRAFT_REF, None, first)
    assert not store.compare_and_set_ref(NAMESPACE, ARTIFACT, DRAFT_REF, None, second)
    assert store.get_ref(NAMESPACE, ARTIFACT, DRAFT_REF) == first


def test_a_write_from_a_stale_version_never_wins() -> None:
    """Two agents start from version 5; only the first write moves the draft."""
    store = InMemoryArtifactStore()
    v5 = _commit(store, {"index.html": b"v5"})
    assert store.compare_and_set_ref(NAMESPACE, ARTIFACT, DRAFT_REF, None, v5)
    first_agent = _commit(store, {"index.html": b"v6 by the first agent"})
    second_agent = _commit(store, {"index.html": b"v6 by the second agent"})

    assert store.compare_and_set_ref(NAMESPACE, ARTIFACT, DRAFT_REF, v5, first_agent)
    assert not store.compare_and_set_ref(
        NAMESPACE, ARTIFACT, DRAFT_REF, v5, second_agent
    )
    assert store.get_ref(NAMESPACE, ARTIFACT, DRAFT_REF) == first_agent


def test_compare_and_set_needs_a_stored_tree() -> None:
    store = InMemoryArtifactStore()
    with pytest.raises(MissingObjectsError):
        store.compare_and_set_ref(NAMESPACE, ARTIFACT, DRAFT_REF, None, ABC_SHA256)
    assert store.get_ref(NAMESPACE, ARTIFACT, DRAFT_REF) is None


def test_refs_are_per_artifact_and_per_ref() -> None:
    store = InMemoryArtifactStore()
    draft = _commit(store, {"index.html": b"draft"})
    published = _commit(store, {"index.html": b"published"})
    assert store.compare_and_set_ref(NAMESPACE, ARTIFACT, DRAFT_REF, None, draft)
    assert store.compare_and_set_ref(
        NAMESPACE, ARTIFACT, PUBLISHED_REF, None, published
    )

    assert store.get_ref(NAMESPACE, ARTIFACT, DRAFT_REF) == draft
    assert store.get_ref(NAMESPACE, ARTIFACT, PUBLISHED_REF) == published
    assert store.get_ref(NAMESPACE, "artifact-2", DRAFT_REF) is None


def test_only_one_of_many_concurrent_writers_wins() -> None:
    store = InMemoryArtifactStore()
    base = _commit(store, {"index.html": b"base"})
    assert store.compare_and_set_ref(NAMESPACE, ARTIFACT, DRAFT_REF, None, base)
    candidates = [
        _commit(store, {"index.html": f"writer {index}".encode()})
        for index in range(16)
    ]
    barrier = threading.Barrier(len(candidates))
    results: list[bool] = []

    def write(new: str) -> None:
        barrier.wait()
        results.append(
            store.compare_and_set_ref(NAMESPACE, ARTIFACT, DRAFT_REF, base, new)
        )

    threads = [threading.Thread(target=write, args=(new,)) for new in candidates]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert results.count(True) == 1
    assert store.get_ref(NAMESPACE, ARTIFACT, DRAFT_REF) in candidates
