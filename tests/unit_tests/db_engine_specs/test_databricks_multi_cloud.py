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

from typing import Any
from unittest.mock import MagicMock
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
#
# Databricks fronts the user-to-machine OAuth2 flow on every workspace at
# `https://<workspace-host>/oidc/v1/{authorize,token}`, regardless of cloud, so
# the authorization endpoint derives from the connection host with no per-cloud
# account/tenant identifier.

SPECS = [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec]

# Representative workspace hosts for each cloud provider.
CLOUD_HOSTS = [
    "my-cluster.cloud.databricks.com",  # AWS
    "adb-123456789.12.azuredatabricks.net",  # Azure
    "123456789.gcp.databricks.com",  # GCP
]


@pytest.fixture
def oauth2_config_no_uri() -> OAuth2ClientConfig:
    """
    Config for Databricks OAuth2 without a pre-configured endpoint, so the
    authorization endpoint is derived from the workspace host.
    """
    return {
        "id": "databricks-client-id",
        "secret": "databricks-client-secret",
        "scope": "sql",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "",
        "token_request_uri": "",
        "request_content_type": "json",
    }


def _mock_database(mocker: MockerFixture, host: str) -> MagicMock:
    """
    Build a mock database whose URL resolves to the given workspace host.
    """
    database = mocker.MagicMock()
    database.url_object.host = host
    database.id = 1
    return database


@pytest.mark.parametrize("spec", SPECS)
@pytest.mark.parametrize("host", CLOUD_HOSTS)
def test_get_oauth2_authorization_uri_uses_workspace_host(
    mocker: MockerFixture,
    spec: Any,
    host: str,
    oauth2_config_no_uri: OAuth2ClientConfig,
) -> None:
    """
    The authorization endpoint is the workspace host on AWS, Azure, and GCP.
    """
    from superset.db_engine_specs.base import OAuth2State

    mocker.patch(
        "superset.db.session.get",
        return_value=_mock_database(mocker, host),
    )

    state: OAuth2State = {
        "database_id": 1,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "tab_id": "1234",
    }

    url = spec.get_oauth2_authorization_uri(oauth2_config_no_uri, state)
    parsed = urlparse(url)
    assert parsed.netloc == host
    assert parsed.path == "/oidc/v1/authorize"

    query = parse_qs(parsed.query)
    assert query["scope"][0] == "sql"
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state


@pytest.mark.parametrize("spec", SPECS)
@pytest.mark.parametrize("host", CLOUD_HOSTS)
def test_workspace_oauth2_endpoint_builds_token_uri(
    mocker: MockerFixture,
    spec: Any,
    host: str,
) -> None:
    """
    The helper builds the matching token endpoint from the same workspace host.
    """
    database = _mock_database(mocker, host)
    assert (
        spec._workspace_oauth2_endpoint(database, "token")
        == f"https://{host}/oidc/v1/token"
    )
