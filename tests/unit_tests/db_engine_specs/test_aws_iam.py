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

# pylint: disable=import-outside-toplevel, protected-access

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.exceptions import SupersetSecurityException


def test_get_iam_credentials_success() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    mock_credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
        "Expiration": "2025-01-01T00:00:00Z",
    }

    with patch("boto3.client") as mock_boto3_client:
        mock_sts = MagicMock()
        mock_sts.assume_role.return_value = {"Credentials": mock_credentials}
        mock_boto3_client.return_value = mock_sts

        credentials = AWSIAMAuthMixin.get_iam_credentials(
            role_arn="arn:aws:iam::123456789012:role/TestRole",
            region="us-east-1",
        )

        assert credentials == mock_credentials
        mock_boto3_client.assert_called_once_with("sts", region_name="us-east-1")
        mock_sts.assume_role.assert_called_once_with(
            RoleArn="arn:aws:iam::123456789012:role/TestRole",
            RoleSessionName="superset-iam-session",
            DurationSeconds=3600,
        )


def test_get_iam_credentials_with_external_id() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    mock_credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
    }

    with patch("boto3.client") as mock_boto3_client:
        mock_sts = MagicMock()
        mock_sts.assume_role.return_value = {"Credentials": mock_credentials}
        mock_boto3_client.return_value = mock_sts

        credentials = AWSIAMAuthMixin.get_iam_credentials(
            role_arn="arn:aws:iam::123456789012:role/TestRole",
            region="us-west-2",
            external_id="external-id-12345",
            session_duration=900,
        )

        assert credentials == mock_credentials
        mock_sts.assume_role.assert_called_once_with(
            RoleArn="arn:aws:iam::123456789012:role/TestRole",
            RoleSessionName="superset-iam-session",
            DurationSeconds=900,
            ExternalId="external-id-12345",
        )


def test_get_iam_credentials_access_denied() -> None:
    from botocore.exceptions import ClientError

    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    with patch("boto3.client") as mock_boto3_client:
        mock_sts = MagicMock()
        mock_sts.assume_role.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "AssumeRole",
        )
        mock_boto3_client.return_value = mock_sts

        with pytest.raises(SupersetSecurityException) as exc_info:
            AWSIAMAuthMixin.get_iam_credentials(
                role_arn="arn:aws:iam::123456789012:role/TestRole",
                region="us-east-1",
            )

        assert "Unable to assume IAM role" in str(exc_info.value)


def test_get_iam_credentials_external_id_mismatch() -> None:
    from botocore.exceptions import ClientError

    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    with patch("boto3.client") as mock_boto3_client:
        mock_sts = MagicMock()
        mock_sts.assume_role.side_effect = ClientError(
            {
                "Error": {
                    "Code": "AccessDenied",
                    "Message": "The external id does not match",
                }
            },
            "AssumeRole",
        )
        mock_boto3_client.return_value = mock_sts

        with pytest.raises(SupersetSecurityException) as exc_info:
            AWSIAMAuthMixin.get_iam_credentials(
                role_arn="arn:aws:iam::123456789012:role/TestRole",
                region="us-east-1",
                external_id="wrong-id",
            )

        assert "External ID mismatch" in str(exc_info.value)


def test_generate_rds_auth_token() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
    }

    with patch("boto3.client") as mock_boto3_client:
        mock_rds = MagicMock()
        mock_rds.generate_db_auth_token.return_value = "iam-token-12345"
        mock_boto3_client.return_value = mock_rds

        token = AWSIAMAuthMixin.generate_rds_auth_token(
            credentials=credentials,
            hostname="mydb.cluster-xyz.us-east-1.rds.amazonaws.com",
            port=5432,
            username="superset_user",
            region="us-east-1",
        )

        assert token == "iam-token-12345"  # noqa: S105
        mock_boto3_client.assert_called_once_with(
            "rds",
            region_name="us-east-1",
            aws_access_key_id="ASIA...",
            aws_secret_access_key="secret...",  # noqa: S106
            aws_session_token="token...",  # noqa: S106
        )
        mock_rds.generate_db_auth_token.assert_called_once_with(
            DBHostname="mydb.cluster-xyz.us-east-1.rds.amazonaws.com",
            Port=5432,
            DBUsername="superset_user",
        )


def test_apply_iam_authentication() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = (
        "postgresql://user@mydb.cluster-xyz.us-east-1.rds.amazonaws.com:5432/mydb"
    )

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/TestRole",
        "region": "us-east-1",
        "db_username": "superset_iam_user",
    }

    params: dict[str, Any] = {}

    with (
        patch.object(
            AWSIAMAuthMixin,
            "get_iam_credentials",
            return_value={
                "AccessKeyId": "ASIA...",
                "SecretAccessKey": "secret...",
                "SessionToken": "token...",
            },
        ) as mock_get_creds,
        patch.object(
            AWSIAMAuthMixin,
            "generate_rds_auth_token",
            return_value="iam-auth-token",
        ) as mock_gen_token,
    ):
        AWSIAMAuthMixin._apply_iam_authentication(mock_database, params, iam_config)

    mock_get_creds.assert_called_once_with(
        role_arn="arn:aws:iam::123456789012:role/TestRole",
        region="us-east-1",
        external_id=None,
        session_duration=3600,
    )

    mock_gen_token.assert_called_once()
    token_call_kwargs = mock_gen_token.call_args[1]
    assert (
        token_call_kwargs["hostname"] == "mydb.cluster-xyz.us-east-1.rds.amazonaws.com"
    )
    assert token_call_kwargs["port"] == 5432
    assert token_call_kwargs["username"] == "superset_iam_user"

    assert params["connect_args"]["password"] == "iam-auth-token"  # noqa: S105
    assert params["connect_args"]["user"] == "superset_iam_user"
    assert params["connect_args"]["sslmode"] == "require"


def test_apply_iam_authentication_with_external_id() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = (
        "postgresql://user@mydb.us-west-2.rds.amazonaws.com:5432/mydb"
    )

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::222222222222:role/CrossAccountRole",
        "external_id": "superset-prod-12345",
        "region": "us-west-2",
        "db_username": "iam_user",
        "session_duration": 1800,
    }

    params: dict[str, Any] = {}

    with (
        patch.object(
            AWSIAMAuthMixin,
            "get_iam_credentials",
            return_value={
                "AccessKeyId": "ASIA...",
                "SecretAccessKey": "secret...",
                "SessionToken": "token...",
            },
        ) as mock_get_creds,
        patch.object(
            AWSIAMAuthMixin,
            "generate_rds_auth_token",
            return_value="iam-auth-token",
        ),
    ):
        AWSIAMAuthMixin._apply_iam_authentication(mock_database, params, iam_config)

    mock_get_creds.assert_called_once_with(
        role_arn="arn:aws:iam::222222222222:role/CrossAccountRole",
        region="us-west-2",
        external_id="superset-prod-12345",
        session_duration=1800,
    )


def test_apply_iam_authentication_missing_role_arn() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = (
        "postgresql://user@mydb.us-east-1.rds.amazonaws.com:5432/mydb"
    )

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "region": "us-east-1",
        "db_username": "superset_iam_user",
    }

    params: dict[str, Any] = {}

    with pytest.raises(SupersetSecurityException) as exc_info:
        AWSIAMAuthMixin._apply_iam_authentication(mock_database, params, iam_config)

    assert "role_arn" in str(exc_info.value)


def test_apply_iam_authentication_missing_db_username() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = (
        "postgresql://user@mydb.us-east-1.rds.amazonaws.com:5432/mydb"
    )

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/TestRole",
        "region": "us-east-1",
    }

    params: dict[str, Any] = {}

    with pytest.raises(SupersetSecurityException) as exc_info:
        AWSIAMAuthMixin._apply_iam_authentication(mock_database, params, iam_config)

    assert "db_username" in str(exc_info.value)


def test_apply_iam_authentication_default_port() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    # URI without explicit port
    mock_database.sqlalchemy_uri_decrypted = (
        "postgresql://user@mydb.us-east-1.rds.amazonaws.com/mydb"
    )

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/TestRole",
        "region": "us-east-1",
        "db_username": "superset_iam_user",
    }

    params: dict[str, Any] = {}

    with (
        patch.object(
            AWSIAMAuthMixin,
            "get_iam_credentials",
            return_value={
                "AccessKeyId": "ASIA...",
                "SecretAccessKey": "secret...",
                "SessionToken": "token...",
            },
        ),
        patch.object(
            AWSIAMAuthMixin,
            "generate_rds_auth_token",
            return_value="iam-auth-token",
        ) as mock_gen_token,
    ):
        AWSIAMAuthMixin._apply_iam_authentication(mock_database, params, iam_config)

    # Should use default port 5432
    token_call_kwargs = mock_gen_token.call_args[1]
    assert token_call_kwargs["port"] == 5432


def test_get_iam_credentials_boto3_not_installed() -> None:
    import sys

    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    # Temporarily hide boto3
    boto3_module = sys.modules.get("boto3")
    sys.modules["boto3"] = None  # type: ignore

    try:
        with pytest.raises(SupersetSecurityException) as exc_info:
            AWSIAMAuthMixin.get_iam_credentials(
                role_arn="arn:aws:iam::123456789012:role/TestRole",
                region="us-east-1",
            )

        assert "boto3 is required" in str(exc_info.value)
    finally:
        # Restore boto3
        if boto3_module is not None:
            sys.modules["boto3"] = boto3_module
        else:
            del sys.modules["boto3"]
