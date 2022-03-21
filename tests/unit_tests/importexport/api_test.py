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

import json
from io import BytesIO
from pathlib import Path
from typing import Any
from zipfile import is_zipfile, ZipFile

from pytest_mock import MockFixture

from superset import security_manager


def test_export_assets(mocker: MockFixture, client: Any) -> None:
    """
    Test exporting assets.
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.importers.v1.utils import get_contents_from_bundle

    # grant access
    mocker.patch(
        "flask_appbuilder.security.decorators.verify_jwt_in_request", return_value=True
    )
    mocker.patch.object(security_manager, "has_access", return_value=True)

    mocked_contents = [
        (
            "metadata.yaml",
            "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n",
        ),
        ("databases/example.yaml", "<DATABASE CONTENTS>"),
    ]

    # pylint: disable=invalid-name
    ExportAssetsCommand = mocker.patch("superset.importexport.api.ExportAssetsCommand")
    ExportAssetsCommand().run.return_value = mocked_contents[:]

    response = client.get("/api/v1/assets/export/")
    assert response.status_code == 200

    buf = BytesIO(response.data)
    assert is_zipfile(buf)

    buf.seek(0)
    with ZipFile(buf) as bundle:
        contents = get_contents_from_bundle(bundle)
    assert contents == dict(mocked_contents)


def test_import_assets(mocker: MockFixture, client: Any) -> None:
    """
    Test importing assets.
    """
    # grant access
    mocker.patch(
        "flask_appbuilder.security.decorators.verify_jwt_in_request", return_value=True
    )
    mocker.patch.object(security_manager, "has_access", return_value=True)

    mocked_contents = {
        "metadata.yaml": (
            "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n"
        ),
        "databases/example.yaml": "<DATABASE CONTENTS>",
    }

    # pylint: disable=invalid-name
    ImportAssetsCommand = mocker.patch("superset.importexport.api.ImportAssetsCommand")

    root = Path("assets_export")
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        for path, contents in mocked_contents.items():
            with bundle.open(str(root / path), "w") as fp:
                fp.write(contents.encode())
    buf.seek(0)

    form_data = {
        "bundle": (buf, "assets_export.zip"),
        "passwords": json.dumps(
            {"assets_export/databases/imported_database.yaml": "SECRET"}
        ),
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 200
    assert response.json == {"message": "OK"}

    passwords = {"assets_export/databases/imported_database.yaml": "SECRET"}
    ImportAssetsCommand.assert_called_with(mocked_contents, passwords=passwords)
