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


def test_redshift_encrypted_extra_sensitive_fields() -> None:
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    assert (
        "$.aws_iam.external_id" in RedshiftEngineSpec.encrypted_extra_sensitive_fields
    )
    assert "$.aws_iam.role_arn" in RedshiftEngineSpec.encrypted_extra_sensitive_fields


def test_redshift_update_params_no_encrypted_extra() -> None:
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = None

    params: dict[str, Any] = {}
    RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {}


def test_redshift_update_params_empty_encrypted_extra() -> None:
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps({})

    params: dict[str, Any] = {}
    RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {}


def test_redshift_update_params_iam_disabled() -> None:
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": False,
                "role_arn": "arn:aws:iam::123456789012:role/TestRole",
                "region": "us-east-1",
                "workgroup_name": "my-workgroup",
                "db_name": "dev",
            }
        }
    )

    params: dict[str, Any] = {}
    RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {}


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_redshift_update_params_with_iam() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
                "region": "us-east-1",
                "workgroup_name": "my-workgroup",
                "db_name": "dev",
            }
        }
    )
    database.sqlalchemy_uri_decrypted = (
        "redshift+psycopg2://user@my-workgroup.123456789012.us-east-1"
        ".redshift-serverless.amazonaws.com:5439/dev"
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
            "generate_redshift_credentials",
            return_value=("IAM:admin", "redshift-temp-password"),
        ),
    ):
        RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "connect_args" in params
    assert params["connect_args"]["password"] == "redshift-temp-password"  # noqa: S105
    assert params["connect_args"]["user"] == "IAM:admin"
    assert params["connect_args"]["sslmode"] == "verify-ca"


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_redshift_update_params_with_external_id() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::222222222222:role/CrossAccountRedshift",
                "external_id": "superset-prod-12345",
                "region": "us-west-2",
                "workgroup_name": "prod-workgroup",
                "db_name": "analytics",
                "session_duration": 1800,
            }
        }
    )
    database.sqlalchemy_uri_decrypted = (
        "redshift+psycopg2://user@prod-workgroup.222222222222.us-west-2"
        ".redshift-serverless.amazonaws.com:5439/analytics"
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
        ) as mock_get_creds,
        patch.object(
            AWSIAMAuthMixin,
            "generate_redshift_credentials",
            return_value=("IAM:admin", "redshift-temp-password"),
        ),
    ):
        RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)

    mock_get_creds.assert_called_once_with(
        role_arn="arn:aws:iam::222222222222:role/CrossAccountRedshift",
        region="us-west-2",
        external_id="superset-prod-12345",
        session_duration=1800,
    )


def test_redshift_update_params_merges_remaining_encrypted_extra() -> None:
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {"enabled": False},
            "pool_size": 5,
        }
    )

    params: dict[str, Any] = {}
    RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "aws_iam" not in params
    assert params["pool_size"] == 5


def test_redshift_update_params_invalid_json() -> None:
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = "not-valid-json"

    params: dict[str, Any] = {}

    with pytest.raises(json.JSONDecodeError):
        RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)


def test_redshift_mask_encrypted_extra() -> None:
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::123456789012:role/SecretRole",
                "external_id": "secret-external-id-12345",
                "region": "us-east-1",
                "workgroup_name": "my-workgroup",
                "db_name": "dev",
            }
        }
    )

    masked = RedshiftEngineSpec.mask_encrypted_extra(encrypted_extra)
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
    assert masked_config["aws_iam"]["workgroup_name"] == "my-workgroup"
    assert masked_config["aws_iam"]["db_name"] == "dev"


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_redshift_update_params_with_iam_provisioned_cluster() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::123456789012:role/RedshiftRole",
                "region": "us-east-1",
                "cluster_identifier": "my-redshift-cluster",
                "db_username": "superset_user",
                "db_name": "analytics",
            }
        }
    )
    database.sqlalchemy_uri_decrypted = (
        "redshift+psycopg2://user@my-redshift-cluster.abc123.us-east-1"
        ".redshift.amazonaws.com:5439/analytics"
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
            "generate_redshift_cluster_credentials",
            return_value=("IAM:superset_user", "cluster-temp-password"),
        ),
    ):
        RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "connect_args" in params
    assert params["connect_args"]["password"] == "cluster-temp-password"  # noqa: S105
    assert params["connect_args"]["user"] == "IAM:superset_user"
    assert params["connect_args"]["sslmode"] == "verify-ca"


@with_feature_flags(AWS_DATABASE_IAM_AUTH=True)
def test_redshift_update_params_provisioned_cluster_with_external_id() -> None:
    from superset.db_engine_specs.aws_iam import AWSIAMAuthMixin
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::222222222222:role/CrossAccountRedshift",
                "external_id": "superset-prod-12345",
                "region": "us-west-2",
                "cluster_identifier": "prod-cluster",
                "db_username": "analytics_user",
                "db_name": "prod_db",
                "session_duration": 1800,
            }
        }
    )
    database.sqlalchemy_uri_decrypted = (
        "redshift+psycopg2://user@prod-cluster.xyz789.us-west-2"
        ".redshift.amazonaws.com:5439/prod_db"
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
        ) as mock_get_creds,
        patch.object(
            AWSIAMAuthMixin,
            "generate_redshift_cluster_credentials",
            return_value=("IAM:analytics_user", "cluster-temp-password"),
        ),
    ):
        RedshiftEngineSpec.update_params_from_encrypted_extra(database, params)

    mock_get_creds.assert_called_once_with(
        role_arn="arn:aws:iam::222222222222:role/CrossAccountRedshift",
        region="us-west-2",
        external_id="superset-prod-12345",
        session_duration=1800,
    )


def test_redshift_mask_encrypted_extra_provisioned_cluster() -> None:
    from superset.db_engine_specs.redshift import RedshiftEngineSpec

    encrypted_extra = json.dumps(
        {
            "aws_iam": {
                "enabled": True,
                "role_arn": "arn:aws:iam::123456789012:role/SecretRole",
                "external_id": "secret-external-id-12345",
                "region": "us-east-1",
                "cluster_identifier": "my-cluster",
                "db_username": "superset_user",
                "db_name": "analytics",
            }
        }
    )

    masked = RedshiftEngineSpec.mask_encrypted_extra(encrypted_extra)
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
    assert masked_config["aws_iam"]["cluster_identifier"] == "my-cluster"
    assert masked_config["aws_iam"]["db_username"] == "superset_user"
    assert masked_config["aws_iam"]["db_name"] == "analytics"
