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
from tests.unit_tests.conftest import with_feature_flags


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

    from superset.db_engine_specs.aws_iam import (
        _credentials_cache,
        _credentials_lock,
        AWSIAMAuthMixin,
    )

    with _credentials_lock:
        _credentials_cache.clear()

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


def test_apply_iam_authentication_feature_flag_disabled() -> None:
    """Test that IAM auth is blocked when feature flag is disabled."""
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

    # Feature flag is disabled by default
    with pytest.raises(SupersetSecurityException) as exc_info:
        AWSIAMAuthMixin._apply_iam_authentication(
            mock_database,
            params,
            iam_config,
        )

    assert "AWS IAM database authentication is not enabled" in str(exc_info.value)
    assert "AWS_DATABASE_IAM_AUTH" in str(exc_info.value)


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
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


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
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


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
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


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
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


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
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
    import builtins

    from superset.db_engine_specs.aws_iam import (
        _credentials_cache,
        _credentials_lock,
        AWSIAMAuthMixin,
    )

    with _credentials_lock:
        _credentials_cache.clear()

    # Patch the import mechanism to simulate boto3 not being installed
    real_import = builtins.__import__

    def fake_import(name: str, *args: Any, **kwargs: Any) -> Any:
        if name == "boto3" or name.startswith("boto3."):
            raise ImportError("No module named 'boto3'")
        return real_import(name, *args, **kwargs)

    with patch.object(builtins, "__import__", side_effect=fake_import):
        with pytest.raises(SupersetSecurityException) as exc_info:
            AWSIAMAuthMixin.get_iam_credentials(
                role_arn="arn:aws:iam::123456789012:role/TestRole",
                region="us-east-1",
            )

    assert "boto3 is required" in str(exc_info.value)


def test_get_iam_credentials_caching() -> None:
    from superset.db_engine_specs.aws_iam import (
        _credentials_cache,
        _credentials_lock,
        AWSIAMAuthMixin,
    )

    mock_credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
    }

    # Clear cache before test
    with _credentials_lock:
        _credentials_cache.clear()

    with patch("boto3.client") as mock_boto3_client:
        mock_sts = MagicMock()
        mock_sts.assume_role.return_value = {"Credentials": mock_credentials}
        mock_boto3_client.return_value = mock_sts

        # First call should hit STS
        result1 = AWSIAMAuthMixin.get_iam_credentials(
            role_arn="arn:aws:iam::123456789012:role/CachedRole",
            region="us-east-1",
        )

        # Second call should use cache
        result2 = AWSIAMAuthMixin.get_iam_credentials(
            role_arn="arn:aws:iam::123456789012:role/CachedRole",
            region="us-east-1",
        )

        assert result1 == mock_credentials
        assert result2 == mock_credentials
        # STS should only be called once
        mock_sts.assume_role.assert_called_once()

    # Clean up
    with _credentials_lock:
        _credentials_cache.clear()


def test_get_iam_credentials_cache_different_keys() -> None:
    from superset.db_engine_specs.aws_iam import (
        _credentials_cache,
        _credentials_lock,
        AWSIAMAuthMixin,
    )

    creds_role1 = {
        "AccessKeyId": "ASIA_ROLE1",
        "SecretAccessKey": "secret1",
        "SessionToken": "token1",
    }
    creds_role2 = {
        "AccessKeyId": "ASIA_ROLE2",
        "SecretAccessKey": "secret2",
        "SessionToken": "token2",
    }

    # Clear cache before test
    with _credentials_lock:
        _credentials_cache.clear()

    with patch("boto3.client") as mock_boto3_client:
        mock_sts = MagicMock()
        mock_sts.assume_role.side_effect = [
            {"Credentials": creds_role1},
            {"Credentials": creds_role2},
        ]
        mock_boto3_client.return_value = mock_sts

        result1 = AWSIAMAuthMixin.get_iam_credentials(
            role_arn="arn:aws:iam::111111111111:role/Role1",
            region="us-east-1",
        )
        result2 = AWSIAMAuthMixin.get_iam_credentials(
            role_arn="arn:aws:iam::222222222222:role/Role2",
            region="us-east-1",
        )

        assert result1 == creds_role1
        assert result2 == creds_role2
        # Both calls should hit STS (different cache keys)
        assert mock_sts.assume_role.call_count == 2

    # Clean up
    with _credentials_lock:
        _credentials_cache.clear()


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_iam_authentication_custom_ssl_args() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = (
        "mysql://user@mydb.cluster-xyz.us-east-1.rds.amazonaws.com:3306/mydb"
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
        ),
    ):
        AWSIAMAuthMixin._apply_iam_authentication(
            mock_database,
            params,
            iam_config,
            ssl_args={"ssl_mode": "REQUIRED"},
            default_port=3306,
        )

    assert params["connect_args"]["ssl_mode"] == "REQUIRED"
    assert "sslmode" not in params["connect_args"]


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_iam_authentication_custom_default_port() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    # URI without explicit port
    mock_database.sqlalchemy_uri_decrypted = (
        "mysql://user@mydb.cluster-xyz.us-east-1.rds.amazonaws.com/mydb"
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
        AWSIAMAuthMixin._apply_iam_authentication(
            mock_database,
            params,
            iam_config,
            default_port=3306,
        )

    token_call_kwargs = mock_gen_token.call_args[1]
    assert token_call_kwargs["port"] == 3306


def test_generate_redshift_credentials() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
    }

    with patch("boto3.client") as mock_boto3_client:
        mock_redshift = MagicMock()
        mock_redshift.get_credentials.return_value = {
            "dbUser": "IAM:admin",
            "dbPassword": "redshift-temp-password",
        }
        mock_boto3_client.return_value = mock_redshift

        db_user, db_password = AWSIAMAuthMixin.generate_redshift_credentials(
            credentials=credentials,
            workgroup_name="my-workgroup",
            db_name="dev",
            region="us-east-1",
        )

        assert db_user == "IAM:admin"
        assert db_password == "redshift-temp-password"  # noqa: S105
        mock_boto3_client.assert_called_once_with(
            "redshift-serverless",
            region_name="us-east-1",
            aws_access_key_id="ASIA...",
            aws_secret_access_key="secret...",  # noqa: S106
            aws_session_token="token...",  # noqa: S106
        )
        mock_redshift.get_credentials.assert_called_once_with(
            workgroupName="my-workgroup",
            dbName="dev",
        )


def test_generate_redshift_credentials_client_error() -> None:
    from botocore.exceptions import ClientError

    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
    }

    with patch("boto3.client") as mock_boto3_client:
        mock_redshift = MagicMock()
        mock_redshift.get_credentials.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "GetCredentials",
        )
        mock_boto3_client.return_value = mock_redshift

        with pytest.raises(SupersetSecurityException) as exc_info:
            AWSIAMAuthMixin.generate_redshift_credentials(
                credentials=credentials,
                workgroup_name="my-workgroup",
                db_name="dev",
                region="us-east-1",
            )

        assert "Failed to get Redshift Serverless credentials" in str(exc_info.value)


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_redshift_iam_authentication() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = (
        "redshift+psycopg2://user@my-workgroup.123456789012.us-east-1"
        ".redshift-serverless.amazonaws.com:5439/dev"
    )

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
        "region": "us-east-1",
        "workgroup_name": "my-workgroup",
        "db_name": "dev",
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
            "generate_redshift_credentials",
            return_value=("IAM:admin", "redshift-temp-password"),
        ) as mock_gen_creds,
    ):
        AWSIAMAuthMixin._apply_redshift_iam_authentication(
            mock_database, params, iam_config
        )

    mock_get_creds.assert_called_once_with(
        role_arn="arn:aws:iam::123456789012:role/RedshiftRole",
        region="us-east-1",
        external_id=None,
        session_duration=3600,
    )

    mock_gen_creds.assert_called_once_with(
        credentials={
            "AccessKeyId": "ASIA...",
            "SecretAccessKey": "secret...",
            "SessionToken": "token...",
        },
        workgroup_name="my-workgroup",
        db_name="dev",
        region="us-east-1",
    )

    assert params["connect_args"]["password"] == "redshift-temp-password"  # noqa: S105
    assert params["connect_args"]["user"] == "IAM:admin"
    assert params["connect_args"]["sslmode"] == "verify-ca"


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_redshift_iam_authentication_missing_workgroup() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = "redshift+psycopg2://user@host:5439/dev"

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
        "region": "us-east-1",
        "db_name": "dev",
    }

    params: dict[str, Any] = {}

    with pytest.raises(SupersetSecurityException) as exc_info:
        AWSIAMAuthMixin._apply_redshift_iam_authentication(
            mock_database, params, iam_config
        )

    assert "workgroup_name" in str(exc_info.value)


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_redshift_iam_authentication_missing_db_name() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = "redshift+psycopg2://user@host:5439/dev"

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
        "region": "us-east-1",
        "workgroup_name": "my-workgroup",
    }

    params: dict[str, Any] = {}

    with pytest.raises(SupersetSecurityException) as exc_info:
        AWSIAMAuthMixin._apply_redshift_iam_authentication(
            mock_database, params, iam_config
        )

    assert "db_name" in str(exc_info.value)


def test_generate_redshift_cluster_credentials() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
    }

    with patch("boto3.client") as mock_boto3_client:
        mock_redshift = MagicMock()
        mock_redshift.get_cluster_credentials.return_value = {
            "DbUser": "IAM:superset_user",
            "DbPassword": "redshift-cluster-temp-password",
        }
        mock_boto3_client.return_value = mock_redshift

        db_user, db_password = AWSIAMAuthMixin.generate_redshift_cluster_credentials(
            credentials=credentials,
            cluster_identifier="my-redshift-cluster",
            db_user="superset_user",
            db_name="analytics",
            region="us-east-1",
        )

        assert db_user == "IAM:superset_user"
        assert db_password == "redshift-cluster-temp-password"  # noqa: S105
        mock_boto3_client.assert_called_once_with(
            "redshift",
            region_name="us-east-1",
            aws_access_key_id="ASIA...",
            aws_secret_access_key="secret...",  # noqa: S106
            aws_session_token="token...",  # noqa: S106
        )
        mock_redshift.get_cluster_credentials.assert_called_once_with(
            ClusterIdentifier="my-redshift-cluster",
            DbUser="superset_user",
            DbName="analytics",
            AutoCreate=False,
        )


def test_generate_redshift_cluster_credentials_with_auto_create() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
    }

    with patch("boto3.client") as mock_boto3_client:
        mock_redshift = MagicMock()
        mock_redshift.get_cluster_credentials.return_value = {
            "DbUser": "IAM:new_user",
            "DbPassword": "temp-password",
        }
        mock_boto3_client.return_value = mock_redshift

        AWSIAMAuthMixin.generate_redshift_cluster_credentials(
            credentials=credentials,
            cluster_identifier="my-cluster",
            db_user="new_user",
            db_name="dev",
            region="us-west-2",
            auto_create=True,
        )

        mock_redshift.get_cluster_credentials.assert_called_once_with(
            ClusterIdentifier="my-cluster",
            DbUser="new_user",
            DbName="dev",
            AutoCreate=True,
        )


def test_generate_redshift_cluster_credentials_client_error() -> None:
    from botocore.exceptions import ClientError

    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin

    credentials = {
        "AccessKeyId": "ASIA...",
        "SecretAccessKey": "secret...",
        "SessionToken": "token...",
    }

    with patch("boto3.client") as mock_boto3_client:
        mock_redshift = MagicMock()
        mock_redshift.get_cluster_credentials.side_effect = ClientError(
            {"Error": {"Code": "ClusterNotFound", "Message": "Cluster not found"}},
            "GetClusterCredentials",
        )
        mock_boto3_client.return_value = mock_redshift

        with pytest.raises(SupersetSecurityException) as exc_info:
            AWSIAMAuthMixin.generate_redshift_cluster_credentials(
                credentials=credentials,
                cluster_identifier="nonexistent-cluster",
                db_user="superset_user",
                db_name="dev",
                region="us-east-1",
            )

        assert "Failed to get Redshift cluster credentials" in str(exc_info.value)


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_redshift_iam_authentication_provisioned_cluster() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = (
        "redshift+psycopg2://user@my-cluster.abc123.us-east-1"
        ".redshift.amazonaws.com:5439/analytics"
    )

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
        "region": "us-east-1",
        "cluster_identifier": "my-cluster",
        "db_username": "superset_user",
        "db_name": "analytics",
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
            "generate_redshift_cluster_credentials",
            return_value=("IAM:superset_user", "cluster-temp-password"),
        ) as mock_gen_creds,
    ):
        AWSIAMAuthMixin._apply_redshift_iam_authentication(
            mock_database, params, iam_config
        )

    mock_get_creds.assert_called_once_with(
        role_arn="arn:aws:iam::123456789012:role/RedshiftRole",
        region="us-east-1",
        external_id=None,
        session_duration=3600,
    )

    mock_gen_creds.assert_called_once_with(
        credentials={
            "AccessKeyId": "ASIA...",
            "SecretAccessKey": "secret...",
            "SessionToken": "token...",
        },
        cluster_identifier="my-cluster",
        db_user="superset_user",
        db_name="analytics",
        region="us-east-1",
    )

    assert params["connect_args"]["password"] == "cluster-temp-password"  # noqa: S105
    assert params["connect_args"]["user"] == "IAM:superset_user"
    assert params["connect_args"]["sslmode"] == "verify-ca"


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_redshift_iam_authentication_provisioned_missing_db_username() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = "redshift+psycopg2://user@host:5439/dev"

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
        "region": "us-east-1",
        "cluster_identifier": "my-cluster",
        "db_name": "dev",
        # Missing db_username - required for provisioned clusters
    }

    params: dict[str, Any] = {}

    with pytest.raises(SupersetSecurityException) as exc_info:
        AWSIAMAuthMixin._apply_redshift_iam_authentication(
            mock_database, params, iam_config
        )

    assert "db_username" in str(exc_info.value)


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_redshift_iam_authentication_both_workgroup_and_cluster() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = "redshift+psycopg2://user@host:5439/dev"

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
        "region": "us-east-1",
        "workgroup_name": "my-workgroup",
        "cluster_identifier": "my-cluster",
        "db_name": "dev",
    }

    params: dict[str, Any] = {}

    with pytest.raises(SupersetSecurityException) as exc_info:
        AWSIAMAuthMixin._apply_redshift_iam_authentication(
            mock_database, params, iam_config
        )

    assert "cannot have both" in str(exc_info.value)


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_apply_redshift_iam_authentication_neither_workgroup_nor_cluster() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin, AWSIAMConfig

    mock_database = MagicMock()
    mock_database.sqlalchemy_uri_decrypted = "redshift+psycopg2://user@host:5439/dev"

    iam_config: AWSIAMConfig = {
        "enabled": True,
        "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
        "region": "us-east-1",
        "db_name": "dev",
        # Missing both workgroup_name and cluster_identifier
    }

    params: dict[str, Any] = {}

    with pytest.raises(SupersetSecurityException) as exc_info:
        AWSIAMAuthMixin._apply_redshift_iam_authentication(
            mock_database, params, iam_config
        )

    assert "must include either workgroup_name" in str(exc_info.value)
