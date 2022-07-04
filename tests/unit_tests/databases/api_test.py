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

# pylint: disable=unused-argument, import-outside-toplevel

from typing import Any
from uuid import UUID

from pytest_mock import MockFixture
from sqlalchemy.orm.session import Session


def test_post_with_uuid(
    mocker: MockFixture,
    app_context: None,
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
