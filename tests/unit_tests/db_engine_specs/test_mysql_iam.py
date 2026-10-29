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

# pylint: disable=import-outside-toplevel

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags


def test_mysql_encrypted_extra_sensitive_fields() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    assert "$.aws_iam.external_id" in MySQLEngineSpec.encrypted_extra_sensitive_fields
    assert "$.aws_iam.role_arn" in MySQLEngineSpec.encrypted_extra_sensitive_fields


def test_mysql_update_params_no_encrypted_extra() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    database = MagicMock()
    database.encrypted_extra = None

    params: dict[str, Any] = {}
    MySQLEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {}


def test_mysql_update_params_empty_encrypted_extra() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps({})

    params: dict[str, Any] = {}
    MySQLEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {}


def test_mysql_update_params_iam_disabled() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": False,
                "role_arn": "arn:aws:iam::123456789012:role/TestRole",
                "region": "us-east-1",
                "db_username": "superset_user",
            }
        }
    )

    params: dict[str, Any] = {}
    MySQLEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {}


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_mysql_update_params_with_iam() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::123456789012:role/TestRole",
                "region": "us-east-1",
                "db_username": "superset_iam_user",
            }
        }
    )
    database.sqlalchemy_uri_decrypted = (
        "mysql://user@mydb.cluster-xyz.us-east-1.rds.amazonaws.com:3306/mydb"
    )

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
        MySQLEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "connect_args" in params
    assert params["connect_args"]["password"] == "iam-auth-token"  # noqa: S105
    assert params["connect_args"]["user"] == "superset_iam_user"
    # Note: ssl_mode is not set because MySQL drivers don't support it.
    # SSL should be configured via the database's extra settings.


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_mysql_update_params_iam_uses_mysql_port() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::123456789012:role/TestRole",
                "region": "us-east-1",
                "db_username": "superset_iam_user",
            }
        }
    )
    # URI without explicit port
    database.sqlalchemy_uri_decrypted = (
        "mysql://user@mydb.cluster-xyz.us-east-1.rds.amazonaws.com/mydb"
    )

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
        MySQLEngineSpec.update_params_from_encrypted_extra(database, params)

    # Should use default MySQL port 3306
    token_call_kwargs = mock_gen_token.call_args[1]
    assert token_call_kwargs["port"] == 3306


def test_mysql_update_params_merges_remaining_encrypted_extra() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {"enabled": False},
            "pool_size": 10,
        }
    )

    params: dict[str, Any] = {}
    MySQLEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "aws_iam" not in params
    assert params["pool_size"] == 10


def test_mysql_update_params_invalid_json() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    database = MagicMock()
    database.encrypted_extra = "not-valid-json"

    params: dict[str, Any] = {}

    with pytest.raises(json.JSONDecodeError):
        MySQLEngineSpec.update_params_from_encrypted_extra(database, params)


def test_mysql_mask_encrypted_extra() -> None:
    from superset.db_engine_specs.mysql import MySQLEngineSpec

    encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::123456789012:role/SecretRole",
                "external_id": "secret-external-id-12345",
                "region": "us-east-1",
                "db_username": "superset_user",
            }
        }
    )

    masked = MySQLEngineSpec.mask_encrypted_extra(encrypted_extra)
    assert masked is not None

    masked_config = json.loads(masked)

    # role_arn and external_id should be masked
    assert (
        masked_config["aws_iam"]["role_arn"]
        != "arn:aws:iam::123456789012:role/SecretRole"
    )
    assert masked_config["aws_iam"]["external_id"] != "secret-external-id-12345"

    # Non-sensitive fields should remain unchanged
    assert masked_config["aws_iam"]["enabled"] is True
    assert masked_config["aws_iam"]["region"] == "us-east-1"
    assert masked_config["aws_iam"]["db_username"] == "superset_user"
