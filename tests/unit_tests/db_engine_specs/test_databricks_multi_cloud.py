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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access

from urllib.parse import parse_qs, urlparse

import pytest
from pytest_mock import MockerFixture

from superset.db_engine_specs.databricks import (
    DatabricksNativeEngineSpec,
    DatabricksPythonConnectorEngineSpec,
)
from superset.superset_typing import OAuth2ClientConfig
from superset.utils.oauth2 import decode_oauth2_state

# Multi-Cloud Provider Tests


@pytest.fixture
def mock_database_aws(mocker: MockerFixture):
    """
    Mock database with AWS hostname.
    """
    database = mocker.MagicMock()
    database.url_object.host = "my-cluster.cloud.databricks.com"
    database.id = 1
    return database


@pytest.fixture
def mock_database_azure(mocker: MockerFixture):
    """
    Mock database with Azure hostname.
    """
    database = mocker.MagicMock()
    database.url_object.host = "adb-123456789.12.azuredatabricks.net"
    database.id = 2
    return database


@pytest.fixture
def mock_database_gcp(mocker: MockerFixture):
    """
    Mock database with GCP hostname.
    """
    database = mocker.MagicMock()
    database.url_object.host = "123456789.gcp.databricks.com"
    database.id = 3
    return database


@pytest.fixture
def oauth2_config() -> OAuth2ClientConfig:
    """
    Config for Databricks OAuth2.
    """
    return {
        "id": "databricks-client-id",
        "secret": "databricks-client-secret",
        "scope": "sql",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/authorize",
        "token_request_uri": "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/token",
        "request_content_type": "json",
    }


def test_cloud_provider_detection_aws(mock_database_aws) -> None:
    """
    Test cloud provider detection for AWS.
    """
    provider = DatabricksNativeEngineSpec._detect_cloud_provider(mock_database_aws)
    assert provider == "aws"


def test_cloud_provider_detection_azure(mock_database_azure) -> None:
    """
    Test cloud provider detection for Azure.
    """
    provider = DatabricksNativeEngineSpec._detect_cloud_provider(mock_database_azure)
    assert provider == "azure"


def test_cloud_provider_detection_gcp(mock_database_gcp) -> None:
    """
    Test cloud provider detection for GCP.
    """
    provider = DatabricksNativeEngineSpec._detect_cloud_provider(mock_database_gcp)
    assert provider == "gcp"


def test_cloud_provider_detection_explicit_config(mocker: MockerFixture) -> None:
    """
    Test cloud provider detection with explicit configuration.
    """
    database = mocker.MagicMock()
    database.url_object.host = "generic-host.com"

    # Mock get_extra_params to return explicit cloud provider
    mocker.patch.object(
        DatabricksNativeEngineSpec,
        "get_extra_params",
        return_value={"cloud_provider": "azure"},
    )

    provider = DatabricksNativeEngineSpec._detect_cloud_provider(database)
    assert provider == "azure"


def test_get_oauth2_authorization_uri_aws(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
    mock_database_aws,
) -> None:
    """
    Test OAuth2 authorization URI generation for AWS provider.
    """
    from superset.db_engine_specs.base import OAuth2State

    # Mock the database query
    mocker.patch(
        "superset.models.core.Database.query.get", return_value=mock_database_aws
    )

    state: OAuth2State = {
        "database_id": 1,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "tab_id": "1234",
    }

    url = DatabricksNativeEngineSpec.get_oauth2_authorization_uri(oauth2_config, state)
    parsed = urlparse(url)
    assert parsed.netloc == "accounts.cloud.databricks.com"
    assert "/oidc/accounts/" in parsed.path
    assert "/v1/authorize" in parsed.path

    query = parse_qs(parsed.query)
    assert query["scope"][0] == "sql"
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state


def test_get_oauth2_authorization_uri_azure(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
    mock_database_azure,
) -> None:
    """
    Test OAuth2 authorization URI generation for Azure provider.
    """
    from superset.db_engine_specs.base import OAuth2State

    # Mock the database query
    mocker.patch(
        "superset.models.core.Database.query.get", return_value=mock_database_azure
    )

    state: OAuth2State = {
        "database_id": 2,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "tab_id": "1234",
    }

    url = DatabricksNativeEngineSpec.get_oauth2_authorization_uri(oauth2_config, state)
    parsed = urlparse(url)
    assert parsed.netloc == "login.microsoftonline.com"
    assert "/oauth2/v2.0/authorize" in parsed.path

    query = parse_qs(parsed.query)
    assert query["scope"][0] == "sql"
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state


def test_get_oauth2_authorization_uri_gcp(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
    mock_database_gcp,
) -> None:
    """
    Test OAuth2 authorization URI generation for GCP provider.
    """
    from superset.db_engine_specs.base import OAuth2State

    # Mock the database query
    mocker.patch(
        "superset.models.core.Database.query.get", return_value=mock_database_gcp
    )

    state: OAuth2State = {
        "database_id": 3,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "tab_id": "1234",
    }

    url = DatabricksNativeEngineSpec.get_oauth2_authorization_uri(oauth2_config, state)
    parsed = urlparse(url)
    assert parsed.netloc == "accounts.gcp.databricks.com"
    assert "/oidc/accounts/" in parsed.path
    assert "/v1/authorize" in parsed.path

    query = parse_qs(parsed.query)
    assert query["scope"][0] == "sql"
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state


def test_python_connector_cloud_provider_detection_azure(mock_database_azure) -> None:
    """
    Test cloud provider detection for Python Connector with Azure.
    """
    provider = DatabricksPythonConnectorEngineSpec._detect_cloud_provider(
        mock_database_azure
    )
    assert provider == "azure"


def test_python_connector_oauth2_authorization_uri_azure(
    mocker: MockerFixture,
    oauth2_config: OAuth2ClientConfig,
    mock_database_azure,
) -> None:
    """
    Test OAuth2 authorization URI generation for Python Connector with Azure provider.
    """
    from superset.db_engine_specs.base import OAuth2State

    # Mock the database query
    mocker.patch(
        "superset.models.core.Database.query.get", return_value=mock_database_azure
    )

    state: OAuth2State = {
        "database_id": 2,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "tab_id": "1234",
    }

    url = DatabricksPythonConnectorEngineSpec.get_oauth2_authorization_uri(
        oauth2_config, state
    )
    parsed = urlparse(url)
    assert parsed.netloc == "login.microsoftonline.com"
    assert "/oauth2/v2.0/authorize" in parsed.path

    query = parse_qs(parsed.query)
    assert query["scope"][0] == "sql"
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state
