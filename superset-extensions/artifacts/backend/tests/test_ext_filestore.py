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
"""The artifact file store's semantics, on the SDK's in-memory backend."""

from __future__ import annotations

import json  # noqa: TID251 -- pure test; the host's JSON utility needs Flask.
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from pydantic import ValidationError
from superset_core.artifacts.authoring import (
    ArtifactCommitFilesRequest,
    ArtifactCreateFileRequest,
    ArtifactCreateRequest,
    ArtifactDeleteFileRequest,
    ArtifactHistoryRequest,
    ArtifactInsertRequest,
    ArtifactManifestGetRequest,
    ArtifactManifestUpdateRequest,
    ArtifactMoveFileRequest,
    ArtifactRequestPublishRequest,
    ArtifactRestoreRequest,
    ArtifactSearchRequest,
    ArtifactStrReplaceRequest,
    ArtifactViewRequest,
    AuthoringErrorCode,
)
from superset_core.artifacts.manifest import ArtifactManifest
from superset_core.artifacts.store import (
    DRAFT_REF,
    PUBLISHED_REF,
    sha256_hex,
    tree_hash,
)
from superset_core.artifacts.testing import InMemoryArtifactStore
from superset_oss.artifacts.errors import ArtifactError, ExtensionErrorCode
from superset_oss.artifacts.store.filestore import (
    ArtifactFileStore,
    MAX_FILE_BYTES,
    PAGE_BYTES,
)

OWNER = "1"
STRANGER = "2"
INDEX = '<!doctype html>\n<h1>Hello</h1>\n<script src="app.js"></script>\n'
APP = "const answer = 41;\nconsole.log(answer);\n"


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def backend() -> InMemoryArtifactStore:
    return InMemoryArtifactStore()


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def store(backend: InMemoryArtifactStore, clock: Clock) -> ArtifactFileStore:
    return ArtifactFileStore(backend, namespace="test", clock=clock)


def create(store: ArtifactFileStore, **files: str) -> tuple[str, str]:
    created = store.create(
        OWNER,
        ArtifactCreateRequest(
            title="Revenue",
            files=files or {"index.html": INDEX, "src/app.js": APP},
        ),
    )
    return created.artifact_id, created.version


def read(store: ArtifactFileStore, artifact_id: str, path: str, **extra: Any) -> str:
    request = ArtifactViewRequest(artifact_id=artifact_id, path=path, **extra)
    return store.view(OWNER, request).content


@contextmanager
def raises(
    code: AuthoringErrorCode | ExtensionErrorCode,
) -> Iterator[pytest.ExceptionInfo[ArtifactError]]:
    with pytest.raises(ArtifactError) as info:
        yield info
    assert info.value.code == code, info.value.to_dict()


def manifest_hash(backend: InMemoryArtifactStore, version: str) -> str:
    tree = backend.get_tree("test", version)
    assert tree is not None
    return tree["manifest.json"]


def test_create_adds_a_minimal_manifest(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)

    manifest_version, manifest = store.manifest_get(
        OWNER, ArtifactManifestGetRequest(artifact_id=artifact_id)
    )

    assert manifest_version == version
    assert manifest.title == "Revenue"
    assert manifest.entrypoint == "index.html"
    assert store.draft_version(OWNER, artifact_id) == version
    assert store.published_version(artifact_id) is None


def test_version_is_the_tree_hash_of_the_files(
    store: ArtifactFileStore, backend: InMemoryArtifactStore
) -> None:
    _, version = create(store, **{"index.html": "x"})

    assert version == tree_hash(
        {
            "index.html": sha256_hex(b"x"),
            "manifest.json": manifest_hash(backend, version),
        }
    )


def test_create_rejects_an_invalid_manifest_and_stores_nothing(
    store: ArtifactFileStore, backend: InMemoryArtifactStore
) -> None:
    bad = json.dumps({"artifact_version": "1", "dependencies": {"d3": "^7"}})

    with raises(AuthoringErrorCode.INVALID_MANIFEST):
        store.create(OWNER, ArtifactCreateRequest(files={"manifest.json": bad}))

    assert backend.missing_blobs("test", [sha256_hex(bad.encode())])


def test_create_rejects_a_file_that_is_also_a_directory(
    store: ArtifactFileStore,
) -> None:
    with raises(AuthoringErrorCode.INVALID_PATH):
        create(store, **{"src": "a", "src/app.js": "b"})


def test_paths_are_normalized_and_unsafe_ones_rejected() -> None:
    base = "0" * 64
    request = ArtifactCreateFileRequest(
        artifact_id="a", base_version=base, path="./src//app.js", file_text=""
    )
    assert request.path == "src/app.js"
    for unsafe in ("../secret", "/etc/passwd", "a\\b", "a\x00b", "src/../../x", ""):
        with pytest.raises(ValidationError):
            ArtifactCreateFileRequest(
                artifact_id="a", base_version=base, path=unsafe, file_text=""
            )


def test_view_numbers_lines_and_lists_directories(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)

    view = store.view(
        OWNER, ArtifactViewRequest(artifact_id=artifact_id, path="src/app.js")
    )
    root = read(store, artifact_id, ".")
    src = read(store, artifact_id, "src")
    second = read(store, artifact_id, "src/app.js", view_range=(2, -1))

    assert view.content == "     1\tconst answer = 41;\n     2\tconsole.log(answer);\n"
    assert view.version == version
    assert (view.page, view.pages) == (1, 1)
    assert root == "index.html\nmanifest.json\nsrc/app.js\n"
    assert src == "src/app.js\n"
    assert second == "     2\tconsole.log(answer);\n"


def test_view_rejects_ranges_past_the_end_and_unknown_paths(
    store: ArtifactFileStore,
) -> None:
    artifact_id, _ = create(store)

    with raises(AuthoringErrorCode.INVALID_ARGUMENT):
        read(store, artifact_id, "src/app.js", view_range=(3, -1))
    with raises(AuthoringErrorCode.FILE_NOT_FOUND):
        read(store, artifact_id, "nope.js")


def test_view_pages_stay_under_the_page_budget(store: ArtifactFileStore) -> None:
    big = "".join(f"line {number} {'x' * 90}\n" for number in range(2_000))
    artifact_id, _ = create(store, **{"big.txt": big})

    first = store.view(
        OWNER, ArtifactViewRequest(artifact_id=artifact_id, path="big.txt")
    )
    pages = [
        read(store, artifact_id, "big.txt", page=page)
        for page in range(1, first.pages + 1)
    ]

    assert first.pages > 1
    assert all(len(page.encode()) <= PAGE_BYTES for page in pages)
    assert sum(page.count("\n") for page in pages) == 2_000
    with raises(AuthoringErrorCode.INVALID_ARGUMENT):
        read(store, artifact_id, "big.txt", page=first.pages + 1)


def test_one_oversized_line_is_cut_across_pages(store: ArtifactFileStore) -> None:
    artifact_id, _ = create(store, **{"min.js": "é" * 30_000})

    first = store.view(
        OWNER, ArtifactViewRequest(artifact_id=artifact_id, path="min.js")
    )
    pages = [
        read(store, artifact_id, "min.js", page=page)
        for page in range(1, first.pages + 1)
    ]

    assert first.pages == 2
    assert all(len(page.encode()) <= PAGE_BYTES for page in pages)
    assert "".join(pages).count("é") == 30_000


def test_str_replace_replaces_the_one_exact_match(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)

    written = store.str_replace(
        OWNER,
        ArtifactStrReplaceRequest(
            artifact_id=artifact_id,
            base_version=version,
            path="src/app.js",
            old_str="41",
            new_str="42",
        ),
    )

    assert written.version != version
    assert "const answer = 42;" in read(store, artifact_id, "src/app.js")


def str_replace(
    store: ArtifactFileStore, artifact_id: str, version: str, old: str, new: str = ""
) -> str:
    return store.str_replace(
        OWNER,
        ArtifactStrReplaceRequest(
            artifact_id=artifact_id,
            base_version=version,
            path="src/app.js",
            old_str=old,
            new_str=new,
        ),
    ).version


def test_str_replace_needs_exactly_one_match(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store, **{"src/app.js": "aaa\nbb\nbb\n"})

    with raises(AuthoringErrorCode.NO_MATCH):
        str_replace(store, artifact_id, version, "missing")
    with raises(AuthoringErrorCode.NO_MATCH):
        str_replace(store, artifact_id, version, "BB")
    with raises(AuthoringErrorCode.MULTIPLE_MATCHES):
        str_replace(store, artifact_id, version, "bb")
    # Overlapping occurrences count as two.
    with raises(AuthoringErrorCode.MULTIPLE_MATCHES):
        str_replace(store, artifact_id, version, "aa")
    assert store.draft_version(OWNER, artifact_id) == version


def test_str_replace_with_an_empty_new_str_deletes_the_match(
    store: ArtifactFileStore,
) -> None:
    artifact_id, version = create(store)

    str_replace(store, artifact_id, version, "console.log(answer);\n")

    assert read(store, artifact_id, "src/app.js") == "     1\tconst answer = 41;\n"


def test_a_write_that_changes_nothing_keeps_the_version(
    store: ArtifactFileStore,
) -> None:
    artifact_id, version = create(store)

    assert str_replace(store, artifact_id, version, "41", "41") == version
    history = store.history(OWNER, ArtifactHistoryRequest(artifact_id=artifact_id))
    assert history.versions == (version,)


def test_insert_adds_whole_lines(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store, **{"src/app.js": "a\nb"})

    def insert(line: int, text: str) -> None:
        nonlocal version
        version = store.insert(
            OWNER,
            ArtifactInsertRequest(
                artifact_id=artifact_id,
                base_version=version,
                path="src/app.js",
                insert_line=line,
                insert_text=text,
            ),
        ).version

    insert(0, "start")
    insert(2, "middle")
    insert(4, "end")

    assert read(store, artifact_id, "src/app.js") == (
        "     1\tstart\n     2\ta\n     3\tmiddle\n     4\tb\n     5\tend\n"
    )
    with raises(AuthoringErrorCode.INVALID_ARGUMENT):
        insert(6, "past the end")


def test_create_file_delete_and_move(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)

    def write(request: Any) -> None:
        nonlocal version
        method = {
            ArtifactCreateFileRequest: store.create_file,
            ArtifactDeleteFileRequest: store.delete_file,
            ArtifactMoveFileRequest: store.move_file,
        }[type(request)]
        version = method(OWNER, request).version

    write(
        ArtifactCreateFileRequest(
            artifact_id=artifact_id,
            base_version=version,
            path="src/util.js",
            file_text="export {}\n",
        )
    )
    with raises(AuthoringErrorCode.FILE_EXISTS):
        write(
            ArtifactCreateFileRequest(
                artifact_id=artifact_id,
                base_version=version,
                path="src/util.js",
                file_text="again",
            )
        )
    with raises(AuthoringErrorCode.FILE_EXISTS):
        write(
            ArtifactCreateFileRequest(
                artifact_id=artifact_id, base_version=version, path="src", file_text=""
            )
        )
    with raises(AuthoringErrorCode.INVALID_PATH):
        write(
            ArtifactCreateFileRequest(
                artifact_id=artifact_id,
                base_version=version,
                path="index.html/inner.js",
                file_text="",
            )
        )
    write(
        ArtifactMoveFileRequest(
            artifact_id=artifact_id,
            base_version=version,
            old_path="src/util.js",
            new_path="lib/util.js",
        )
    )
    with raises(AuthoringErrorCode.FILE_EXISTS):
        write(
            ArtifactMoveFileRequest(
                artifact_id=artifact_id,
                base_version=version,
                old_path="lib/util.js",
                new_path="index.html",
            )
        )
    write(
        ArtifactDeleteFileRequest(
            artifact_id=artifact_id, base_version=version, path="lib/util.js"
        )
    )
    with raises(AuthoringErrorCode.FILE_NOT_FOUND):
        write(
            ArtifactDeleteFileRequest(
                artifact_id=artifact_id, base_version=version, path="lib/util.js"
            )
        )

    assert read(store, artifact_id, ".") == "index.html\nmanifest.json\nsrc/app.js\n"


def test_the_manifest_stays_and_stays_valid(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)

    with raises(AuthoringErrorCode.INVALID_MANIFEST):
        store.delete_file(
            OWNER,
            ArtifactDeleteFileRequest(
                artifact_id=artifact_id, base_version=version, path="manifest.json"
            ),
        )
    with raises(AuthoringErrorCode.INVALID_MANIFEST):
        store.move_file(
            OWNER,
            ArtifactMoveFileRequest(
                artifact_id=artifact_id,
                base_version=version,
                old_path="manifest.json",
                new_path="old.json",
            ),
        )
    with raises(AuthoringErrorCode.INVALID_MANIFEST):
        store.str_replace(
            OWNER,
            ArtifactStrReplaceRequest(
                artifact_id=artifact_id,
                base_version=version,
                path="manifest.json",
                old_str='"artifact_version": "1"',
                new_str='"artifact_version": "2"',
            ),
        )
    assert store.draft_version(OWNER, artifact_id) == version


def test_manifest_update_replaces_the_manifest(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)
    manifest = ArtifactManifest.model_validate(
        {
            "artifact_version": "1",
            "title": "Revenue by region",
            "bindings": {
                "revenue": {
                    "source": {"kind": "dataset", "dataset_id": 42},
                    "metrics": ["revenue"],
                    "dimensions": ["region"],
                }
            },
            "capabilities": ["data"],
        }
    )

    written = store.manifest_update(
        OWNER,
        ArtifactManifestUpdateRequest(
            artifact_id=artifact_id, base_version=version, manifest=manifest
        ),
    )
    _, stored = store.manifest_get(
        OWNER, ArtifactManifestGetRequest(artifact_id=artifact_id)
    )

    assert stored == manifest
    assert store.manifest_at(artifact_id, written.version) == manifest


def test_every_write_checks_base_version(store: ArtifactFileStore) -> None:
    artifact_id, base = create(store)
    first = str_replace(store, artifact_id, base, "41", "42")

    with raises(AuthoringErrorCode.STALE_BASE_VERSION) as stale:
        str_replace(store, artifact_id, base, "console", "window.console")

    assert stale.value.to_dict() == {
        "code": "STALE_BASE_VERSION",
        "message": stale.value.message,
        "current_version": first,
    }
    assert store.draft_version(OWNER, artifact_id) == first


def test_only_one_of_concurrent_writers_wins(store: ArtifactFileStore) -> None:
    artifact_id, base = create(store)
    results: list[str] = []
    barrier = threading.Barrier(8)

    def write(number: int) -> None:
        barrier.wait()
        try:
            results.append(str_replace(store, artifact_id, base, "41", str(number)))
        except ArtifactError as error:
            results.append(error.code)

    threads = [threading.Thread(target=write, args=(n,)) for n in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    winners = [result for result in results if result != "STALE_BASE_VERSION"]
    assert len(winners) == 1
    assert store.draft_version(OWNER, artifact_id) == winners[0]
    history = store.history(OWNER, ArtifactHistoryRequest(artifact_id=artifact_id))
    assert history.versions == (winners[0], base)


def test_only_owners_reach_an_artifact(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)

    with raises(AuthoringErrorCode.ARTIFACT_NOT_FOUND):
        store.view(STRANGER, ArtifactViewRequest(artifact_id=artifact_id, path="."))
    with raises(AuthoringErrorCode.ARTIFACT_NOT_FOUND):
        store.str_replace(
            STRANGER,
            ArtifactStrReplaceRequest(
                artifact_id=artifact_id,
                base_version=version,
                path="src/app.js",
                old_str="41",
            ),
        )
    with raises(AuthoringErrorCode.ARTIFACT_NOT_FOUND):
        store.view(OWNER, ArtifactViewRequest(artifact_id="not-a-uuid", path="."))
    assert store.is_owner(OWNER, artifact_id.upper())
    assert not store.is_owner(STRANGER, artifact_id)
    assert not store.is_owner(None, artifact_id)


def test_search_finds_lines_in_text_files(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)

    found = store.search(
        OWNER, ArtifactSearchRequest(artifact_id=artifact_id, query="answer")
    )
    scoped = store.search(
        OWNER, ArtifactSearchRequest(artifact_id=artifact_id, query="h1", path="src")
    )

    assert [(match.path, match.line) for match in found.matches] == [
        ("src/app.js", 1),
        ("src/app.js", 2),
    ]
    assert found.version == version
    assert scoped.matches == ()
    with raises(AuthoringErrorCode.FILE_NOT_FOUND):
        store.search(
            OWNER, ArtifactSearchRequest(artifact_id=artifact_id, query="x", path="no")
        )


def test_history_and_restore(store: ArtifactFileStore) -> None:
    artifact_id, first = create(store)
    second = str_replace(store, artifact_id, first, "41", "42")
    third = str_replace(store, artifact_id, second, "42", "43")

    restored = store.restore(
        OWNER,
        ArtifactRestoreRequest(
            artifact_id=artifact_id, base_version=third, version=first
        ),
    )
    history = store.history(OWNER, ArtifactHistoryRequest(artifact_id=artifact_id))

    assert restored.version == first
    assert history.versions == (first, third, second, first)
    assert "41" in read(store, artifact_id, "src/app.js")


def test_restore_takes_only_this_artifacts_versions(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)
    _other_id, other_version = create(store, **{"secret.txt": "the other one"})

    with raises(AuthoringErrorCode.VERSION_NOT_FOUND):
        store.restore(
            OWNER,
            ArtifactRestoreRequest(
                artifact_id=artifact_id, base_version=version, version=other_version
            ),
        )
    with raises(AuthoringErrorCode.VERSION_NOT_FOUND):
        store.manifest_at(artifact_id, other_version)
    with raises(AuthoringErrorCode.VERSION_NOT_FOUND):
        store.resolve_version(OWNER, artifact_id, other_version)


def test_history_pages_newest_first(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)
    versions = [version]
    for number in range(41, 191):
        version = str_replace(
            store, artifact_id, version, f"= {number};", f"= {number + 1};"
        )
        versions.append(version)

    first = store.history(OWNER, ArtifactHistoryRequest(artifact_id=artifact_id))
    second = store.history(
        OWNER, ArtifactHistoryRequest(artifact_id=artifact_id, page=2)
    )

    assert (first.pages, len(first.versions), len(second.versions)) == (2, 100, 51)
    assert first.versions + second.versions == tuple(reversed(versions))


def test_commit_by_hash_reports_missing_blobs_then_commits(
    store: ArtifactFileStore, backend: InMemoryArtifactStore
) -> None:
    artifact_id, version = create(store)
    tree = {
        "index.html": sha256_hex(INDEX.encode()),
        "manifest.json": manifest_hash(backend, version),
        "src/app.js": sha256_hex(b"changed\n"),
    }
    request = ArtifactCommitFilesRequest(
        artifact_id=artifact_id, base_version=version, files=tree
    )

    pending = store.commit_files(OWNER, request)
    assert pending.missing == [sha256_hex(b"changed\n")]
    assert pending.version is None
    assert store.draft_version(OWNER, artifact_id) == version

    assert store.put_blobs(OWNER, artifact_id, [b"changed\n"]) == pending.missing
    committed = store.commit_files(OWNER, request)

    assert committed.missing == []
    assert committed.version == tree_hash(tree)
    assert read(store, artifact_id, "src/app.js") == "     1\tchanged\n"


def test_commit_by_hash_needs_the_manifest_and_a_current_base(
    store: ArtifactFileStore,
) -> None:
    artifact_id, version = create(store)
    newer = str_replace(store, artifact_id, version, "41", "42")
    index = {"index.html": sha256_hex(INDEX.encode())}

    with raises(AuthoringErrorCode.INVALID_MANIFEST):
        store.commit_files(
            OWNER,
            ArtifactCommitFilesRequest(
                artifact_id=artifact_id, base_version=newer, files=index
            ),
        )
    with raises(AuthoringErrorCode.STALE_BASE_VERSION):
        store.commit_files(
            OWNER,
            ArtifactCommitFilesRequest(
                artifact_id=artifact_id, base_version=version, files=index
            ),
        )


def test_uploads_are_for_owners_and_capped(store: ArtifactFileStore) -> None:
    artifact_id, _ = create(store)

    with raises(AuthoringErrorCode.ARTIFACT_NOT_FOUND):
        store.put_blobs(STRANGER, artifact_id, [b"x"])
    with raises(AuthoringErrorCode.TOO_LARGE):
        store.put_blobs(OWNER, artifact_id, [b"x" * (MAX_FILE_BYTES + 1)])
    with raises(AuthoringErrorCode.TOO_LARGE):
        create(store, **{"big.txt": "x" * (MAX_FILE_BYTES + 1)})


def test_publishing_waits_for_the_users_confirmation(
    store: ArtifactFileStore,
) -> None:
    artifact_id, version = create(store)

    publish = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=version),
    )

    assert store.published_version(artifact_id) is None
    assert store.pending_publish(OWNER, artifact_id) == publish
    # The agent keeps editing; the user still confirms what was requested.
    newer = str_replace(store, artifact_id, version, "41", "42")

    published = store.confirm_publish(OWNER, artifact_id, publish.request_id)

    assert published == version
    assert store.published_version(artifact_id) == version
    assert store.draft_version(OWNER, artifact_id) == newer
    assert store.has_version(artifact_id, version, ref=PUBLISHED_REF)
    assert store.pending_publish(OWNER, artifact_id) is None
    history = store.history(
        OWNER, ArtifactHistoryRequest(artifact_id=artifact_id, ref="published")
    )
    assert history.versions == (version,)
    with raises(ExtensionErrorCode.PUBLISH_REQUEST_NOT_FOUND):
        store.confirm_publish(OWNER, artifact_id, publish.request_id)


def test_a_publish_request_needs_the_current_draft(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)
    str_replace(store, artifact_id, version, "41", "42")

    with raises(AuthoringErrorCode.STALE_BASE_VERSION):
        store.request_publish(
            OWNER,
            ArtifactRequestPublishRequest(
                artifact_id=artifact_id, base_version=version
            ),
        )


def test_a_newer_request_replaces_the_pending_one(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)
    first = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=version),
    )
    newer = str_replace(store, artifact_id, version, "41", "42")
    second = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=newer),
    )

    with raises(ExtensionErrorCode.PUBLISH_REQUEST_NOT_FOUND):
        store.confirm_publish(OWNER, artifact_id, first.request_id)
    assert store.published_version(artifact_id) is None
    assert store.confirm_publish(OWNER, artifact_id, second.request_id) == newer


def test_publish_requests_expire(store: ArtifactFileStore, clock: Clock) -> None:
    artifact_id, version = create(store)
    publish = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=version),
    )

    clock.now += timedelta(days=2)

    assert store.pending_publish(OWNER, artifact_id) is None
    with raises(ExtensionErrorCode.PUBLISH_REQUEST_NOT_FOUND):
        store.confirm_publish(OWNER, artifact_id, publish.request_id)
    assert store.published_version(artifact_id) is None


def test_only_owners_request_or_confirm_publishing(store: ArtifactFileStore) -> None:
    artifact_id, version = create(store)
    publish = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(artifact_id=artifact_id, base_version=version),
    )

    with raises(AuthoringErrorCode.ARTIFACT_NOT_FOUND):
        store.request_publish(
            STRANGER,
            ArtifactRequestPublishRequest(
                artifact_id=artifact_id, base_version=version
            ),
        )
    with raises(AuthoringErrorCode.ARTIFACT_NOT_FOUND):
        store.confirm_publish(STRANGER, artifact_id, publish.request_id)
    assert store.published_version(artifact_id) is None


def test_refs_are_kept_per_artifact(
    store: ArtifactFileStore, backend: InMemoryArtifactStore
) -> None:
    first_id, first = create(store)
    second_id, second = create(store, **{"index.html": "other"})

    assert backend.get_ref("test", first_id, DRAFT_REF) == first
    assert backend.get_ref("test", second_id, DRAFT_REF) == second
    assert not store.has_version(first_id, second)
