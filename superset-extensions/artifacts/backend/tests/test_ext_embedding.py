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
"""Who opens an artifact on a standalone page, and the version they get."""

from __future__ import annotations

import pytest
from superset_core.artifacts.authoring import (
    ArtifactCreateRequest,
    ArtifactRequestPublishRequest,
    AuthoringErrorCode,
)
from superset_core.artifacts.testing import InMemoryArtifactStore
from superset_oss.artifacts.constants import ID_PREFIX, STANDALONE_PAGE
from superset_oss.artifacts.embedding.access import standalone_version
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import ServedVersion
from superset_oss.artifacts.store.filestore import ArtifactFileStore

OWNER = "1"
VIEWER = "2"


@pytest.fixture
def store() -> ArtifactFileStore:
    return ArtifactFileStore(InMemoryArtifactStore())


def _published(store: ArtifactFileStore) -> tuple[str, str]:
    created = store.create(OWNER, ArtifactCreateRequest(files={"index.html": "v1"}))
    publish = store.request_publish(
        OWNER,
        ArtifactRequestPublishRequest(
            artifact_id=created.artifact_id, base_version=created.version
        ),
    )
    store.confirm_publish(OWNER, created.artifact_id, publish.request_id)
    return created.artifact_id, created.version


def test_an_owner_opens_the_draft_of_an_unpublished_artifact(
    store: ArtifactFileStore,
) -> None:
    created = store.create(OWNER, ArtifactCreateRequest(files={"index.html": "v1"}))

    assert standalone_version(store, OWNER, created.artifact_id) == ServedVersion(
        created.artifact_id, created.version, is_draft=True, can_edit=True
    )


def test_an_owner_opens_the_published_version(store: ArtifactFileStore) -> None:
    artifact_id, version = _published(store)

    assert standalone_version(store, OWNER, artifact_id) == ServedVersion(
        artifact_id, version, is_draft=False, can_edit=True
    )


def test_anyone_else_finds_no_artifact_even_once_it_is_published(
    store: ArtifactFileStore,
) -> None:
    """Until artifacts have viewers; the answer doesn't tell it exists."""
    artifact_id, _ = _published(store)

    with pytest.raises(ArtifactError) as refused:
        standalone_version(store, VIEWER, artifact_id)
    with pytest.raises(ArtifactError) as unknown:
        standalone_version(store, VIEWER, "00000000-0000-4000-8000-000000000000")

    assert refused.value.code == AuthoringErrorCode.ARTIFACT_NOT_FOUND
    assert unknown.value.code == AuthoringErrorCode.ARTIFACT_NOT_FOUND


def test_an_id_that_isnt_a_uuid_finds_no_artifact(store: ArtifactFileStore) -> None:
    with pytest.raises(ArtifactError) as raised:
        standalone_version(store, OWNER, "../frames")

    assert raised.value.code == AuthoringErrorCode.ARTIFACT_NOT_FOUND


def test_the_page_has_the_extensions_full_id() -> None:
    """The frontend registers it under the same id; the host prefixes neither."""
    assert STANDALONE_PAGE == f"{ID_PREFIX}standalone"
    assert STANDALONE_PAGE == "extensions.superset-oss.artifacts.standalone"
