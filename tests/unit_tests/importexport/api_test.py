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
from uuid import UUID
from zipfile import is_zipfile, ZIP_DEFLATED, ZipFile

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

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
            lambda: (
                "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n"
            ),  # noqa: E501
        ),
        ("databases/example.yaml", lambda: "<DATABASE CONTENTS>"),
    ]

    ExportAssetsCommand = mocker.patch("superset.importexport.api.ExportAssetsCommand")  # noqa: N806
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

    ImportAssetsCommand = mocker.patch("superset.importexport.api.ImportAssetsCommand")  # noqa: N806

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
        sparse=False,
        overwrite=True,
        passwords=passwords,
        ssh_tunnel_passwords=None,
        ssh_tunnel_private_keys=None,
        ssh_tunnel_priv_key_passwords=None,
        encrypted_extra_secrets=None,
    )


def test_import_assets_with_encrypted_extra_secrets(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test that encrypted_extra_secrets are passed to ImportAssetsCommand.
    """
    mocked_contents = {
        "metadata.yaml": (
            "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n"
        ),
        "databases/example.yaml": "<DATABASE CONTENTS>",
    }

    ImportAssetsCommand = mocker.patch("superset.importexport.api.ImportAssetsCommand")  # noqa: N806

    root = Path("assets_export")
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        for path, contents in mocked_contents.items():
            with bundle.open(str(root / path), "w") as fp:
                fp.write(contents.encode())
    buf.seek(0)

    secrets = {
        "assets_export/databases/example.yaml": {
            "$.credentials_info.private_key": "-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----\n",  # noqa: E501
        }
    }
    form_data = {
        "bundle": (buf, "assets_export.zip"),
        "encrypted_extra_secrets": json.dumps(secrets),
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 200
    assert response.json == {"message": "OK"}

    ImportAssetsCommand.assert_called_with(
        mocked_contents,
        sparse=False,
        overwrite=True,
        passwords=None,
        ssh_tunnel_passwords=None,
        ssh_tunnel_private_keys=None,
        ssh_tunnel_priv_key_passwords=None,
        encrypted_extra_secrets=secrets,
    )


def test_import_assets_overwrite_false(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Passing ``overwrite=false`` on the form must be forwarded to
    ``ImportAssetsCommand``. Previously the flag was ignored and assets were
    always overwritten.
    """
    mocked_contents = {
        "metadata.yaml": (
            "version: 1.0.0\ntype: assets\ntimestamp: '2022-01-01T00:00:00+00:00'\n"
        ),
        "databases/example.yaml": "<DATABASE CONTENTS>",
    }

    ImportAssetsCommand = mocker.patch("superset.importexport.api.ImportAssetsCommand")  # noqa: N806

    root = Path("assets_export")
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        for path, contents in mocked_contents.items():
            with bundle.open(str(root / path), "w") as fp:
                fp.write(contents.encode())
    buf.seek(0)

    form_data = {
        "bundle": (buf, "assets_export.zip"),
        "overwrite": "false",
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 200

    ImportAssetsCommand.assert_called_with(
        mocked_contents,
        sparse=False,
        overwrite=False,
        passwords=None,
        ssh_tunnel_passwords=None,
        ssh_tunnel_private_keys=None,
        ssh_tunnel_priv_key_passwords=None,
        encrypted_extra_secrets=None,
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


def test_import_assets_corrupt_zip(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test that a ZIP with a corrupt central directory returns a 422, not a 500.
    """
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        bundle.writestr("bundle/metadata.yaml", "version: 1.0.0\n")
    corrupt = BytesIO(buf.getvalue().replace(b"PK\x01\x02", b"XXXX"))
    assert is_zipfile(corrupt)
    form_data = {
        "bundle": (corrupt, "corrupt.zip"),
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 422
    assert response.json == {
        "errors": [
            {
                "message": "Invalid or corrupted ZIP file",
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


def test_import_assets_unsafe_zip(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test that a ZIP failing the safety checks (here, a compress ratio above
    ``ZIP_FILE_MAX_COMPRESS_RATIO``) returns a 422, not a 500.
    """
    buf = BytesIO()
    with ZipFile(buf, "w", compression=ZIP_DEFLATED) as bundle:
        bundle.writestr("bundle/metadata.yaml", "0" * 1024 * 1024)
    buf.seek(0)
    form_data = {
        "bundle": (buf, "unsafe.zip"),
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 422
    assert response.json == {
        "errors": [
            {
                "message": "Zip compress ratio above allowed threshold",
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


def test_import_assets_non_utf8_member(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test that a ZIP with a config member that is not valid UTF-8 returns a 422,
    not a 500.
    """
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        bundle.writestr("bundle/metadata.yaml", b"\xff\xfe\x00bad")
    buf.seek(0)
    form_data = {
        "bundle": (buf, "bundle.zip"),
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 422
    assert response.json["errors"][0]["message"] == (
        "File metadata.yaml is not valid UTF-8"
    )


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


def test_import_assets_malformed_json_form_field(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test that a malformed JSON form field returns a 400 instead of a 500.
    """
    ImportAssetsCommand = mocker.patch("superset.importexport.api.ImportAssetsCommand")  # noqa: N806

    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        with bundle.open("assets_export/metadata.yaml", "w") as fp:
            fp.write(b"version: 1.0.0\ntype: assets\n")
    buf.seek(0)

    form_data = {
        "bundle": (buf, "assets_export.zip"),
        "encrypted_extra_secrets": "{not json",
    }
    response = client.post(
        "/api/v1/assets/import/", data=form_data, content_type="multipart/form-data"
    )
    assert response.status_code == 400
    assert response.json["errors"][0]["message"] == (
        "Form field 'encrypted_extra_secrets' is not valid JSON"
    )
    ImportAssetsCommand.assert_not_called()


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


@pytest.mark.parametrize(
    "resource,module,command",
    [
        ("dashboard", "superset.dashboards.api", "ImportDashboardsCommand"),
        ("chart", "superset.charts.api", "ImportChartsCommand"),
        ("dataset", "superset.datasets.api", "ImportDatasetsCommand"),
        (
            "saved_query",
            "superset.queries.saved_queries.api",
            "ImportSavedQueriesCommand",
        ),
    ],
)
def test_bundle_imports_pass_encrypted_extra_secrets(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    resource: str,
    module: str,
    command: str,
) -> None:
    """
    Dashboard, chart, dataset and saved-query imports pass the secrets for their
    databases' masked Secure Extra to the command, as the database import does.

    Bundles carry the masked block, so without this a promoted connection could
    never get its OAuth2 client secret or embedded credential back.
    """
    import_command = mocker.patch(f"{module}.{command}")
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        with bundle.open("export/metadata.yaml", "w") as fp:
            fp.write(b"version: 1.0.0\n")
    buf.seek(0)
    secrets = {
        "export/databases/promoted.yaml": {"$.oauth2_client_info.secret": "s3cret"}
    }

    response = client.post(
        f"/api/v1/{resource}/import/",
        data={
            "formData": (buf, "export.zip"),
            "encrypted_extra_secrets": json.dumps(secrets),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200, response.json
    assert import_command.call_args.kwargs["encrypted_extra_secrets"] == secrets


EMBEDDED_KEYPAIR = {
    "username": "EMBED_SVC",
    "auth_method": "keypair",
    "privatekey_body": "-----BEGIN PRIVATE KEY-----\nKEY\n-----END PRIVATE KEY-----\n",
    "privatekey_pass": "passphrase",
}


@pytest.mark.parametrize(
    "fallback_enabled,incoming,status,stored",
    [
        pytest.param(
            True,
            {"username": "EMBED_SVC", "auth_method": "keypair", "privatekey_pass": "X"},
            400,
            EMBEDDED_KEYPAIR,
            id="private-key-missing",
        ),
        pytest.param(
            True,
            {**EMBEDDED_KEYPAIR, "privatekey_body": "X", "privatekey_pass": "X"},
            200,
            EMBEDDED_KEYPAIR,
            id="complete",
        ),
        pytest.param(
            False,
            {"username": "EMBED_SVC", "auth_method": "keypair", "privatekey_pass": "X"},
            200,
            {
                "username": "EMBED_SVC",
                "auth_method": "keypair",
                "privatekey_pass": "passphrase",
            },
            id="fallback-off",
        ),
    ],
)
def test_import_assets_overwrite_embedded_credential(
    mocker: MockerFixture,
    session: Session,
    client: Any,
    full_api_access: None,
    fallback_enabled: bool,
    incoming: dict[str, str],
    status: int,
    stored: dict[str, str],
) -> None:
    """
    An overwrite import whose embedded guest credential leaves out a required
    value is refused with a message naming it, and the stored credential stays
    (sc-127530). A complete credential, or the fallback off, imports as before.

    ``"X"`` in ``incoming`` stands for the export mask, which the import reveals
    from the stored credential.
    """
    import yaml

    from superset import db
    from superset.constants import PASSWORD_MASK
    from superset.extensions import feature_flag_manager
    from superset.models.core import Database

    flags = {
        "EMBEDDED_SUPERSET": True,
        "EMBEDDED_CREDENTIAL_FALLBACK": fallback_enabled,
    }
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**(feature_flag_manager._feature_flags or {}), **flags},
    )
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    mocker.patch(
        "superset.commands.importers.v1.assets.get_default_viewers_for_current_user",
        return_value=[],
    )

    def mask(credentials: dict[str, str]) -> dict[str, str]:
        return {k: PASSWORD_MASK if v == "X" else v for k, v in credentials.items()}

    db_uuid = "6c1c5ee7-1d83-4f57-9a8e-1a2b3c4d5e6f"
    Database.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member
    db.session.add(
        Database(
            database_name="snowflake_embedded",
            sqlalchemy_uri="snowflake://base_user@account/db",
            uuid=UUID(db_uuid),
            impersonate_user=True,
            encrypted_extra=json.dumps(
                {
                    "oauth2_client_info": {"id": "client", "secret": "client-secret"},
                    "embedded_credentials": EMBEDDED_KEYPAIR,
                }
            ),
        )
    )
    db.session.commit()

    contents = {
        "metadata.yaml": yaml.safe_dump(
            {"version": "1.0.0", "type": "assets", "timestamp": "2026-10-29T00:00:00"}
        ),
        "databases/snowflake_embedded.yaml": yaml.safe_dump(
            {
                "database_name": "snowflake_embedded",
                "sqlalchemy_uri": "snowflake://base_user@account/db",
                "uuid": db_uuid,
                "version": "1.0.0",
                "impersonate_user": True,
                "extra": {},
                "masked_encrypted_extra": json.dumps(
                    {
                        "oauth2_client_info": {"id": "client", "secret": PASSWORD_MASK},
                        "embedded_credentials": mask(incoming),
                    }
                ),
            }
        ),
    }
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        for path, body in contents.items():
            with bundle.open(f"assets_export/{path}", "w") as fp:
                fp.write(body.encode())
    buf.seek(0)

    response = client.post(
        "/api/v1/assets/import/",
        data={"bundle": (buf, "assets_export.zip")},
        content_type="multipart/form-data",
    )

    assert response.status_code == status, response.json
    if status != 200:
        assert (
            "$.embedded_credentials.privatekey_body"
            in (response.json["errors"][0]["message"])
        )
    db.session.expire_all()
    database = db.session.query(Database).filter_by(uuid=UUID(db_uuid)).one()
    assert json.loads(database.encrypted_extra)["embedded_credentials"] == stored
