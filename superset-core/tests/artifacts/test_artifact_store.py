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

import pytest
from superset_core.artifacts.store import (
    DRAFT_REF,
    InvalidPathError,
    is_sha256_hex,
    MAX_PATH_LENGTH,
    normalize_path,
    sha256_hex,
    tree_hash,
    validate_tree,
)
from superset_core.artifacts.testing import (
    ArtifactStoreBackendConformance,
    InMemoryArtifactStore,
)

EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_sha256_hex_matches_known_digests() -> None:
    assert sha256_hex(b"") == EMPTY_SHA256
    assert sha256_hex(b"abc") == ABC_SHA256


@pytest.mark.parametrize(
    "value",
    [
        EMPTY_SHA256.upper(),
        EMPTY_SHA256[:-1],
        f"{EMPTY_SHA256}0",
        f"{EMPTY_SHA256}\n",
        f" {EMPTY_SHA256}",
        None,
        1,
    ],
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


@pytest.fixture
def artifact_store() -> InMemoryArtifactStore:
    """A new, empty in-memory backend for each test."""
    return InMemoryArtifactStore()


class TestInMemoryArtifactStore(ArtifactStoreBackendConformance):
    """The reference backend passes the backend contract."""


def test_in_memory_store_takes_any_bytes_like_content(
    artifact_store: InMemoryArtifactStore,
) -> None:
    blob_hash = artifact_store.put_blob(bytearray(b"hello"))
    assert blob_hash == sha256_hex(b"hello")
    assert artifact_store.get_blob(blob_hash) == b"hello"


def test_in_memory_store_rejects_text(artifact_store: InMemoryArtifactStore) -> None:
    with pytest.raises(TypeError, match="bytes"):
        artifact_store.put_blob("hello")  # type: ignore[arg-type]


def test_in_memory_store_rejects_malformed_hashes(
    artifact_store: InMemoryArtifactStore,
) -> None:
    with pytest.raises(ValueError, match="SHA-256"):
        artifact_store.get_blob("not-a-hash")
    with pytest.raises(ValueError, match="SHA-256"):
        artifact_store.missing_blobs(["not-a-hash"])
    with pytest.raises(ValueError, match="SHA-256"):
        artifact_store.get_tree(EMPTY_SHA256.upper())
    with pytest.raises(ValueError, match="SHA-256"):
        artifact_store.compare_and_set_ref("a", DRAFT_REF, "v1", EMPTY_SHA256)
