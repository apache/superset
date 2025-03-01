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

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.db_engine_specs.base import BaseEngineSpec
from superset.exceptions import OAuth2RedirectError
from superset.utils import json

oauth2_client_info = {
    "id": "client_id",
    "secret": "client_secret",
    "scope": "scope-a",
    "redirect_uri": "redirect_uri",
    "authorization_request_uri": "auth_uri",
    "token_request_uri": "token_uri",
    "request_content_type": "json",
}


@pytest.fixture
def database_with_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database with catalogs and schemas.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2"]
    database.get_all_schema_names.side_effect = [
        ["schema1", "schema2"],
        ["schema3", "schema4"],
    ]
    database.get_default_catalog.return_value = "catalog2"

    return database


@pytest.fixture
def database_without_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database without catalogs.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = False
    database.get_all_schema_names.return_value = ["schema1", "schema2"]

    return database


@pytest.fixture
def database_needs_oauth2(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database without catalogs that needs OAuth2.
    """
    database = mocker.MagicMock()
    database.database_name = "my_db"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = False
    database.get_all_schema_names.side_effect = OAuth2RedirectError(
        "url",
        "tab_id",
        "redirect_uri",
    )
    database.encrypted_extra = json.dumps({"oauth2_client_info": oauth2_client_info})
    database.db_engine_spec.unmask_encrypted_extra = (
        BaseEngineSpec.unmask_encrypted_extra
    )

    return database
