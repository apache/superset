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
The transfer routes through a Flask test client, as an agent's shell meets
them: no session, no CSRF token, the link's token the only credential.
"""

from __future__ import annotations

import importlib
import io
import json  # noqa: TID251 -- pure test; the host's JSON utility needs Flask.
import sys
import tarfile
from types import ModuleType, SimpleNamespace
from typing import Any

import flask
import pytest
from flask_wtf.csrf import CSRFProtect
from superset_artifacts_sdk.authoring import ArtifactCreateRequest, LAND_SIDECAR_PATH
from superset_artifacts_sdk.policy import Profile, PROFILES
from superset_artifacts_sdk.store import sha256_hex
from superset_artifacts_sdk.testing import InMemoryArtifactStore
from superset_oss.artifacts.authoring.transfer import TransferKind, TransferSigner
from superset_oss.artifacts.constants import UPLOAD_VIEW
from superset_oss.artifacts.store.filestore import ArtifactFileStore
from werkzeug.test import EnvironBuilder, run_wsgi_app

SIGNING_KEY = "a secret key"
ARTIFACT_ID = "00000000-0000-4000-8000-000000000003"
POLICY = PROFILES[Profile.STANDARD]
MODULE = "superset_oss.artifacts.authoring.transfer_api"


class Body(io.BytesIO):
    """A request body that counts the reads of it."""

    def __init__(self, data: bytes) -> None:
        super().__init__(data)
        self.reads = 0

    def read(self, size: int | None = -1) -> bytes:
        self.reads += 1
        return super().read(size)

    def readinto(self, buffer: Any) -> int:
        self.reads += 1
        return super().readinto(buffer)


def put(
    app: flask.Flask, url: str, data: bytes, content_length: int | None = None
) -> tuple[int, Any, Body]:
    """
    PUT ``data`` to ``url``, saying it is ``content_length`` bytes long; the
    status, the JSON answered, and the body as the route read it. Werkzeug's
    test client works the length out from the body itself, so this calls the
    app with an environ of its own.
    """
    body = Body(data)
    environ = EnvironBuilder(path=url, method="PUT").get_environ()
    environ["wsgi.input"] = body
    environ["CONTENT_LENGTH"] = str(
        len(data) if content_length is None else content_length
    )
    answer, status, _ = run_wsgi_app(app.wsgi_app, environ, buffered=True)
    return int(status.split()[0]), json.loads(b"".join(answer)), body


@pytest.fixture
def transfer_api(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    """The routes' module, with the API decorator the host would put in place."""
    from superset_core.rest_api import decorators

    monkeypatch.setattr(decorators, "api", lambda **_: lambda cls: cls)
    monkeypatch.delitem(sys.modules, MODULE, raising=False)
    return importlib.import_module(MODULE)


@pytest.fixture
def store() -> ArtifactFileStore:
    return ArtifactFileStore(InMemoryArtifactStore(), policy=POLICY)


def app_for(
    transfer_api: ModuleType,
    store: ArtifactFileStore,
    monkeypatch: pytest.MonkeyPatch,
    *,
    exempt: bool = True,
) -> flask.Flask:
    """An app that serves the routes, with CSRF checks on, as Superset's has."""
    monkeypatch.setattr(
        transfer_api,
        "open_artifacts",
        lambda: SimpleNamespace(store=store, policy=POLICY),
    )
    app = flask.Flask(__name__)
    app.config.update(SECRET_KEY=SIGNING_KEY, WTF_CSRF_ENABLED=True)
    routes = transfer_api.ArtifactTransferRestApi()
    app.add_url_rule("/blobs/<token>", view_func=routes.upload, methods=["PUT"])
    app.add_url_rule("/versions/<token>", view_func=routes.download, methods=["GET"])
    csrf = CSRFProtect(app)
    if exempt:
        # What a deployment's WTF_CSRF_EXEMPT_LIST does with the name.
        csrf.exempt(UPLOAD_VIEW)
    return app


@pytest.fixture
def app(
    transfer_api: ModuleType,
    store: ArtifactFileStore,
    monkeypatch: pytest.MonkeyPatch,
) -> flask.Flask:
    return app_for(transfer_api, store, monkeypatch)


def link(kind: TransferKind, target: str) -> str:
    token, _ = TransferSigner(SIGNING_KEY).sign(kind, ARTIFACT_ID, target, "1")
    return token


def test_an_upload_stores_the_bytes_its_link_names(
    app: flask.Flask, store: ArtifactFileStore
) -> None:
    data = b"console.log(42);\n"
    status, answer, body = put(app, f"/blobs/{link('blob', sha256_hex(data))}", data)

    assert status == 200
    assert answer == {"result": {"sha256": sha256_hex(data)}}
    assert body.reads > 0
    assert store.put_blobs([data]) == [sha256_hex(data)]


@pytest.mark.parametrize(
    "token",
    [
        "not-a-token",
        # A download's link, for an upload.
        link("version", sha256_hex(b"x")),
        TransferSigner("another-secret").sign(
            "blob", ARTIFACT_ID, sha256_hex(b"x"), "1"
        )[0],
    ],
)
def test_a_link_is_checked_before_its_body_is_read(
    app: flask.Flask, token: str
) -> None:
    status, answer, body = put(app, f"/blobs/{token}", b"x")

    assert status == 403
    assert answer["code"] == "TRANSFER_LINK_INVALID"
    assert body.reads == 0


def test_an_upload_over_the_file_size_limit_is_413(app: flask.Flask) -> None:
    limit = POLICY.limits.file_bytes
    data = b"x" * (limit + 1)
    url = f"/blobs/{link('blob', sha256_hex(data))}"

    # Said by its length, before any of it is read; or found by reading it.
    declared = put(app, url, b"x", content_length=limit + 1)
    read = put(app, url, data)

    assert declared[0] == read[0] == 413
    assert declared[1]["code"] == read[1]["code"] == "TOO_LARGE"
    assert declared[2].reads == 0


def test_bytes_other_than_the_links_are_refused(app: flask.Flask) -> None:
    status, answer, _ = put(app, f"/blobs/{link('blob', sha256_hex(b'one'))}", b"two")

    assert status == 400
    assert answer["code"] == "INVALID_ARGUMENT"


def test_a_download_is_the_versions_tar_and_never_cached(
    app: flask.Flask, store: ArtifactFileStore
) -> None:
    version = store.create(
        ARTIFACT_ID, ArtifactCreateRequest(files={"index.html": "<p>hi</p>"})
    ).version
    client = app.test_client()

    response = client.get(f"/versions/{link('version', version)}")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.mimetype == "application/x-tar"
    with tarfile.open(fileobj=io.BytesIO(response.get_data())) as tar:
        assert tar.getnames() == ["index.html", "manifest.json", LAND_SIDECAR_PATH]
    assert client.get(f"/versions/{link('blob', version)}").status_code == 403


def test_the_upload_route_is_the_view_its_csrf_exemption_names(
    transfer_api: ModuleType,
    store: ArtifactFileStore,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    data = b"x"
    url = f"/blobs/{link('blob', sha256_hex(data))}"
    unexempt = app_for(transfer_api, store, monkeypatch, exempt=False)
    exempt = app_for(transfer_api, store, monkeypatch)

    # A shell has no CSRF token: only the exemption lets its upload through.
    assert unexempt.test_client().put(url, data=data).status_code == 400
    assert exempt.test_client().put(url, data=data).status_code == 200
