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

# pylint: disable=unused-argument, import-outside-toplevel, line-too-long

import json
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy.orm.session import Session


def test_post_with_uuid(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test that we can set the database UUID when creating it.
    """
    from superset.models.core import Database

    # create table for databases
    Database.metadata.create_all(session.get_bind())  # pylint: disable=no-member

    response = client.post(
        "/api/v1/database/",
        json={
            "database_name": "my_db",
            "sqlalchemy_uri": "sqlite://",
            "uuid": "7c1b7880-a59d-47cd-8bf1-f1eb8d2863cb",
        },
    )
    assert response.status_code == 201

    database = session.query(Database).one()
    assert database.uuid == UUID("7c1b7880-a59d-47cd-8bf1-f1eb8d2863cb")


def test_password_mask(
    app: Any,
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test that sensitive information is masked.
    """
    from superset.databases.api import DatabaseRestApi
    from superset.models.core import Database

    DatabaseRestApi.datamodel.session = session

    # create table for databases
    Database.metadata.create_all(session.get_bind())  # pylint: disable=no-member

    database = Database(
        database_name="my_database",
        sqlalchemy_uri="gsheets://",
        encrypted_extra=json.dumps(
            {
                "service_account_info": {
                    "type": "service_account",
                    "project_id": "black-sanctum-314419",
                    "private_key_id": "259b0d419a8f840056158763ff54d8b08f7b8173",
                    "private_key": "SECRET",
                    "client_email": "google-spreadsheets-demo-servi@black-sanctum-314419.iam.gserviceaccount.com",
                    "client_id": "114567578578109757129",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/google-spreadsheets-demo-servi%40black-sanctum-314419.iam.gserviceaccount.com",
                },
            }
        ),
    )
    session.add(database)
    session.commit()

    response = client.get("/api/v1/database/1")
    assert (
        response.json["result"]["parameters"]["service_account_info"]["private_key"]
        == "XXXXXXXXXX"
    )
    assert "encrypted_extra" not in response.json["result"]


@pytest.mark.skip(reason="Works locally but fails on CI")
def test_update_with_password_mask(
    app: Any,
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test that an update with a masked password doesn't overwrite the existing password.
    """
    from superset.databases.api import DatabaseRestApi
    from superset.models.core import Database

    DatabaseRestApi.datamodel.session = session

    # create table for databases
    Database.metadata.create_all(session.get_bind())  # pylint: disable=no-member

    database = Database(
        database_name="my_database",
        sqlalchemy_uri="gsheets://",
        encrypted_extra=json.dumps(
            {
                "service_account_info": {
                    "project_id": "black-sanctum-314419",
                    "private_key": "SECRET",
                },
            }
        ),
    )
    session.add(database)
    session.commit()

    client.put(
        "/api/v1/database/1",
        json={
            "encrypted_extra": json.dumps(
                {
                    "service_account_info": {
                        "project_id": "yellow-unicorn-314419",
                        "private_key": "XXXXXXXXXX",
                    },
                }
            ),
        },
    )
    database = session.query(Database).one()
    assert (
        database.encrypted_extra
        == '{"service_account_info": {"project_id": "yellow-unicorn-314419", "private_key": "SECRET"}}'
    )
