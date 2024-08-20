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

# pylint: disable=invalid-name, import-outside-toplevel, unused-argument

from io import BytesIO
from pathlib import Path
from typing import Any
from zipfile import is_zipfile, ZipFile

from pytest_mock import MockerFixture

from superset import security_manager
from superset.utils import json


def test_export_assets(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test exporting assets.
    """
    from superset.commands.importers.v1.utils import get_contents_from_bundle

    mocked_contents = [
        (
            "metadata.yaml",
            "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n",
        ),
        ("databases/example.yaml", "<DATABASE CONTENTS>"),
    ]
    mocked_export_result = [
        (
            "metadata.yaml",
            lambda: "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n",
        ),
        ("databases/example.yaml", lambda: "<DATABASE CONTENTS>"),
    ]

    ExportAssetsCommand = mocker.patch("superset.importexport.api.ExportAssetsCommand")
    ExportAssetsCommand().run.return_value = mocked_export_result[:]

    response = client.get("/api/v1/assets/export/")
    assert response.status_code == 200

    buf = BytesIO(response.data)
    assert is_zipfile(buf)

    buf.seek(0)
    with ZipFile(buf) as bundle:
        contents = get_contents_from_bundle(bundle)
    assert contents == dict(mocked_contents)


def test_import_assets(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test importing assets.
    """
    mocked_contents = {
        "metadata.yaml": (
            "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n"
        ),
        "databases/example.yaml": "<DATABASE CONTENTS>",
    }

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
    ImportAssetsCommand.assert_called_with(
        mocked_contents,
        passwords=passwords,
        ssh_tunnel_passwords=None,
        ssh_tunnel_private_keys=None,
        ssh_tunnel_priv_key_passwords=None,
    )


def test_import_assets_not_zip(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test error message when the upload is not a ZIP file.
    """
    buf = BytesIO(b"definitely_not_a_zip_file")
    form_data = {
        "bundle": (buf, "broken.txt"),
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 422
    assert response.json == {
        "errors": [
            {
                "message": "Not a ZIP file",
                "error_type": "GENERIC_COMMAND_ERROR",
                "level": "warning",
                "extra": {
                    "issue_codes": [
                        {
                            "code": 1010,
                            "message": (
                                "Issue 1010 - Superset encountered an error while "
                                "running a command."
                            ),
                        }
                    ]
                },
            }
        ]
    }


def test_import_assets_no_form_data(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test error message when the upload has no form data.
    """
    mocker.patch.object(security_manager, "has_access", return_value=True)

    response = client.post("/api/v1/assets/import/", data="some_content")
    assert response.status_code == 400
    assert response.json == {
        "errors": [
            {
                "message": "Request MIME type is not 'multipart/form-data'",
                "error_type": "INVALID_PAYLOAD_FORMAT_ERROR",
                "level": "error",
                "extra": {
                    "issue_codes": [
                        {
                            "code": 1019,
                            "message": (
                                "Issue 1019 - The submitted payload has the incorrect "
                                "format."
                            ),
                        }
                    ]
                },
            }
        ]
    }


def test_import_assets_incorrect_form_data(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test error message when the upload form data has the wrong key.
    """
    buf = BytesIO(b"definitely_not_a_zip_file")
    form_data = {
        "wrong": (buf, "broken.txt"),
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 400
    assert response.json == {"message": "Arguments are not correct"}


def test_import_assets_no_contents(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test error message when the ZIP bundle has no contents.
    """
    mocked_contents = {
        "README.txt": "Something is wrong",
    }

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
    assert response.status_code == 400
    assert response.json == {
        "errors": [
            {
                "message": "No valid import files were found",
                "error_type": "GENERIC_COMMAND_ERROR",
                "level": "warning",
                "extra": {
                    "issue_codes": [
                        {
                            "code": 1010,
                            "message": (
                                "Issue 1010 - Superset encountered an error while "
                                "running a command."
                            ),
                        }
                    ]
                },
            }
        ]
    }
