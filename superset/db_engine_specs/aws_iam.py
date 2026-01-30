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
"""
AWS IAM Authentication Mixin for database engine specs.

This mixin provides cross-account IAM authentication support for AWS databases
(Aurora PostgreSQL, Aurora MySQL, Redshift). It handles:
- Assuming IAM roles via STS AssumeRole
- Generating RDS IAM auth tokens
- Generating Redshift Serverless credentials
- Configuring SSL (required for IAM auth)
- Caching STS credentials to reduce API calls
"""

from __future__ import annotations

import logging
import threading
from typing import Any, TYPE_CHECKING, TypedDict

from cachetools import TTLCache

from superset.databases.utils import make_url_safe
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)

# Default session duration for STS AssumeRole (1 hour)
DEFAULT_SESSION_DURATION = 3600

# Default ports
DEFAULT_POSTGRES_PORT = 5432
DEFAULT_MYSQL_PORT = 3306
DEFAULT_REDSHIFT_PORT = 5439

# Cache STS credentials: key = (role_arn, region, external_id), TTL = 10 min
# Using a TTL shorter than the minimum supported session duration (900s) avoids
# reusing expired STS credentials when a short session_duration is configured.
_credentials_cache: TTLCache[tuple[str, str, str | None], dict[str, Any]] = TTLCache(
    maxsize=100, ttl=600
)
_credentials_lock = threading.RLock()


class AWSIAMConfig(TypedDict, total=False):
    """Configuration for AWS IAM authentication."""

    enabled: bool
    role_arn: str
    external_id: str
    region: str
    db_username: str
    session_duration: int
    # Redshift Serverless fields
    workgroup_name: str
    db_name: str
    # Redshift provisioned cluster fields
    cluster_identifier: str


class AWSIAMAuthMixin:
    """
    Mixin that provides AWS IAM authentication for database connections.

    This mixin can be used with database engine specs that support IAM
    authentication (Aurora PostgreSQL, Aurora MySQL, Redshift).

    Configuration is provided via the database's encrypted_extra JSON:

    {
        "aws_iam": {
            "enabled": true,
            "role_arn": "arn:aws:iam::222222222222:role/SupersetDatabaseAccess",
            "external_id": "superset-prod-12345",  # optional
            "region": "us-east-1",
            "db_username": "superset_iam_user",
            "session_duration": 3600  # optional, defaults to 3600
        }
    }
    """

    # AWS error patterns for actionable error messages
    aws_iam_custom_errors: dict[str, tuple[SupersetErrorType, str]] = {
        "AccessDenied": (
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            "Unable to assume IAM role. Verify the role ARN and trust policy "
            "allow access from Superset's IAM role.",
        ),
        "InvalidIdentityToken": (
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            "Invalid IAM credentials. Ensure Superset has a valid IAM role "
            "with permissions to assume the target role.",
        ),
        "MalformedPolicyDocument": (
            SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
            "Invalid IAM role ARN format. Please verify the role ARN.",
        ),
        "ExpiredTokenException": (
            SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
            "AWS credentials have expired. Please refresh the connection.",
        ),
    }

    @classmethod
    def get_iam_credentials(
        cls,
        role_arn: str,
        region: str,
        external_id: str | None = None,
        session_duration: int = DEFAULT_SESSION_DURATION,
    ) -> dict[str, Any]:
        """
        Assume cross-account IAM role via STS AssumeRole with credential caching.

        Credentials are cached by (role_arn, region, external_id) with a 50-minute
        TTL to reduce STS API calls while ensuring tokens are refreshed before the
        default 1-hour expiration.

        :param role_arn: The ARN of the IAM role to assume
        :param region: AWS region for the STS client
        :param external_id: External ID for the role assumption (optional)
        :param session_duration: Duration of the session in seconds
        :returns: Dictionary with AccessKeyId, SecretAccessKey, SessionToken
        :raises SupersetSecurityException: If role assumption fails
        """
        cache_key = (role_arn, region, external_id)

        with _credentials_lock:
            cached = _credentials_cache.get(cache_key)
            if cached is not None:
                return cached

        try:
            # Lazy import to avoid errors when boto3 is not installed
            import boto3
            from botocore.exceptions import ClientError
        except ImportError as ex:
            raise SupersetSecurityException(
                SupersetError(
                    message="boto3 is required for AWS IAM authentication. "
                    "Install it with: pip install boto3",
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

        try:
            sts_client = boto3.client("sts", region_name=region)

            assume_role_kwargs: dict[str, Any] = {
                "RoleArn": role_arn,
                "RoleSessionName": "superset-iam-session",
                "DurationSeconds": session_duration,
            }
            if external_id:
                assume_role_kwargs["ExternalId"] = external_id

            response = sts_client.assume_role(**assume_role_kwargs)
            credentials = response["Credentials"]

            with _credentials_lock:
                _credentials_cache[cache_key] = credentials

            return credentials

        except ClientError as ex:
            error_code = ex.response.get("Error", {}).get("Code", "")
            error_message = ex.response.get("Error", {}).get("Message", "")

            # Handle ExternalId mismatch (shows as AccessDenied with specific message)
            # Check this first before generic AccessDenied handling
            if "external id" in error_message.lower():
                raise SupersetSecurityException(
                    SupersetError(
                        message="External ID mismatch. Verify the external_id "
                        "configuration matches the trust policy.",
                        error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                        level=ErrorLevel.ERROR,
                    )
                ) from ex

            if error_code in cls.aws_iam_custom_errors:
                error_type, message = cls.aws_iam_custom_errors[error_code]
                raise SupersetSecurityException(
                    SupersetError(
                        message=message,
                        error_type=error_type,
                        level=ErrorLevel.ERROR,
                    )
                ) from ex

            raise SupersetSecurityException(
                SupersetError(
                    message=f"Failed to assume IAM role: {ex}",
                    error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

    @classmethod
    def generate_rds_auth_token(
        cls,
        credentials: dict[str, Any],
        hostname: str,
        port: int,
        username: str,
        region: str,
    ) -> str:
        """
        Generate RDS IAM auth token using temporary credentials.

        :param credentials: STS credentials from assume_role
        :param hostname: RDS/Aurora endpoint hostname
        :param port: Database port
        :param username: Database username configured for IAM auth
        :param region: AWS region
        :returns: IAM auth token to use as database password
        :raises SupersetSecurityException: If token generation fails
        """
        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError as ex:
            raise SupersetSecurityException(
                SupersetError(
                    message="boto3 is required for AWS IAM authentication.",
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

        try:
            rds_client = boto3.client(
                "rds",
                region_name=region,
                aws_access_key_id=credentials["AccessKeyId"],
                aws_secret_access_key=credentials["SecretAccessKey"],
                aws_session_token=credentials["SessionToken"],
            )

            token = rds_client.generate_db_auth_token(
                DBHostname=hostname,
                Port=port,
                DBUsername=username,
            )
            return token

        except ClientError as ex:
            raise SupersetSecurityException(
                SupersetError(
                    message=f"Failed to generate RDS auth token: {ex}",
                    error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

    @classmethod
    def generate_redshift_credentials(
        cls,
        credentials: dict[str, Any],
        workgroup_name: str,
        db_name: str,
        region: str,
    ) -> tuple[str, str]:
        """
        Generate Redshift Serverless credentials using temporary STS credentials.

        :param credentials: STS credentials from assume_role
        :param workgroup_name: Redshift Serverless workgroup name
        :param db_name: Redshift database name
        :param region: AWS region
        :returns: Tuple of (username, password) for Redshift connection
        :raises SupersetSecurityException: If credential generation fails
        """
        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError as ex:
            raise SupersetSecurityException(
                SupersetError(
                    message="boto3 is required for AWS IAM authentication.",
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

        try:
            client = boto3.client(
                "redshift-serverless",
                region_name=region,
                aws_access_key_id=credentials["AccessKeyId"],
                aws_secret_access_key=credentials["SecretAccessKey"],
                aws_session_token=credentials["SessionToken"],
            )

            response = client.get_credentials(
                workgroupName=workgroup_name,
                dbName=db_name,
            )
            return response["dbUser"], response["dbPassword"]

        except ClientError as ex:
            raise SupersetSecurityException(
                SupersetError(
                    message=f"Failed to get Redshift Serverless credentials: {ex}",
                    error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

    @classmethod
    def generate_redshift_cluster_credentials(
        cls,
        credentials: dict[str, Any],
        cluster_identifier: str,
        db_user: str,
        db_name: str,
        region: str,
        auto_create: bool = False,
    ) -> tuple[str, str]:
        """
        Generate credentials for a provisioned Redshift cluster using temporary
        STS credentials.

        :param credentials: STS credentials from assume_role
        :param cluster_identifier: Redshift cluster identifier
        :param db_user: Database username to get credentials for
        :param db_name: Redshift database name
        :param region: AWS region
        :param auto_create: Whether to auto-create the database user if it doesn't exist
        :returns: Tuple of (username, password) for Redshift connection
        :raises SupersetSecurityException: If credential generation fails
        """
        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError as ex:
            raise SupersetSecurityException(
                SupersetError(
                    message="boto3 is required for AWS IAM authentication.",
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

        try:
            client = boto3.client(
                "redshift",
                region_name=region,
                aws_access_key_id=credentials["AccessKeyId"],
                aws_secret_access_key=credentials["SecretAccessKey"],
                aws_session_token=credentials["SessionToken"],
            )

            response = client.get_cluster_credentials(
                ClusterIdentifier=cluster_identifier,
                DbUser=db_user,
                DbName=db_name,
                AutoCreate=auto_create,
            )
            return response["DbUser"], response["DbPassword"]

        except ClientError as ex:
            raise SupersetSecurityException(
                SupersetError(
                    message=f"Failed to get Redshift cluster credentials: {ex}",
                    error_type=SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

    @classmethod
    def _apply_iam_authentication(
        cls,
        database: Database,
        params: dict[str, Any],
        iam_config: AWSIAMConfig,
        ssl_args: dict[str, str] | None = None,
        default_port: int = DEFAULT_POSTGRES_PORT,
    ) -> None:
        """
        Apply IAM authentication to the connection parameters.

        Full flow: assume role -> generate token -> update connect_args -> enable SSL.

        :param database: Database model instance
        :param params: Engine parameters dict to modify
        :param iam_config: IAM configuration from encrypted_extra
        :param ssl_args: SSL args to apply (defaults to sslmode=require)
        :param default_port: Default port if not specified in URI
        :raises SupersetSecurityException: If any step fails
        """
        if ssl_args is None:
            ssl_args = {"sslmode": "require"}

        # Extract configuration
        role_arn = iam_config.get("role_arn")
        region = iam_config.get("region")
        db_username = iam_config.get("db_username")
        external_id = iam_config.get("external_id")
        session_duration = iam_config.get("session_duration", DEFAULT_SESSION_DURATION)

        # Validate required fields
        missing_fields = []
        if not role_arn:
            missing_fields.append("role_arn")
        if not region:
            missing_fields.append("region")
        if not db_username:
            missing_fields.append("db_username")

        if missing_fields:
            raise SupersetSecurityException(
                SupersetError(
                    message="AWS IAM configuration missing required fields: "
                    f"{', '.join(missing_fields)}",
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

        # Type assertions after validation (mypy doesn't narrow types from list check)
        assert role_arn is not None
        assert region is not None
        assert db_username is not None

        # Get hostname and port from the database URI
        uri = make_url_safe(database.sqlalchemy_uri_decrypted)
        hostname = uri.host
        port = uri.port or default_port

        if not hostname:
            raise SupersetSecurityException(
                SupersetError(
                    message=(
                        "Database URI must include a hostname for IAM authentication"
                    ),
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

        logger.debug(
            "Applying IAM authentication for %s:%d as user %s",
            hostname,
            port,
            db_username,
        )

        # Step 1: Assume the IAM role
        credentials = cls.get_iam_credentials(
            role_arn=role_arn,
            region=region,
            external_id=external_id,
            session_duration=session_duration,
        )

        # Step 2: Generate the RDS auth token
        token = cls.generate_rds_auth_token(
            credentials=credentials,
            hostname=hostname,
            port=port,
            username=db_username,
            region=region,
        )

        # Step 3: Update connection parameters
        connect_args = params.setdefault("connect_args", {})

        # Set the IAM token as the password
        connect_args["password"] = token

        # Override username if different from URI
        connect_args["user"] = db_username

        # Step 4: Enable SSL (required for IAM authentication)
        connect_args.update(ssl_args)

        logger.debug("IAM authentication configured successfully")

    @classmethod
    def _apply_redshift_iam_authentication(
        cls,
        database: Database,
        params: dict[str, Any],
        iam_config: AWSIAMConfig,
    ) -> None:
        """
        Apply Redshift IAM authentication to connection parameters.

        Supports both Redshift Serverless (workgroup_name) and provisioned
        clusters (cluster_identifier). The method auto-detects which type
        based on the configuration provided.

        Flow: assume role -> get Redshift credentials -> update connect_args -> SSL.

        :param database: Database model instance
        :param params: Engine parameters dict to modify
        :param iam_config: IAM configuration from encrypted_extra
        :raises SupersetSecurityException: If any step fails
        """
        # Extract configuration
        role_arn = iam_config.get("role_arn")
        region = iam_config.get("region")
        external_id = iam_config.get("external_id")
        session_duration = iam_config.get("session_duration", DEFAULT_SESSION_DURATION)

        # Serverless fields
        workgroup_name = iam_config.get("workgroup_name")

        # Provisioned cluster fields
        cluster_identifier = iam_config.get("cluster_identifier")
        db_username = iam_config.get("db_username")

        # Common field
        db_name = iam_config.get("db_name")

        # Determine deployment type
        is_serverless = bool(workgroup_name)
        is_provisioned = bool(cluster_identifier)

        if is_serverless and is_provisioned:
            raise SupersetSecurityException(
                SupersetError(
                    message="AWS IAM configuration cannot have both workgroup_name "
                    "(Serverless) and cluster_identifier (provisioned). "
                    "Please specify only one.",
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

        if not is_serverless and not is_provisioned:
            raise SupersetSecurityException(
                SupersetError(
                    message="AWS IAM configuration must include either workgroup_name "
                    "(for Redshift Serverless) or cluster_identifier "
                    "(for provisioned Redshift clusters).",
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

        # Validate common required fields
        missing_fields = []
        if not role_arn:
            missing_fields.append("role_arn")
        if not region:
            missing_fields.append("region")
        if not db_name:
            missing_fields.append("db_name")

        # Validate provisioned cluster specific fields
        if is_provisioned and not db_username:
            missing_fields.append("db_username")

        if missing_fields:
            raise SupersetSecurityException(
                SupersetError(
                    message="AWS IAM configuration missing required fields: "
                    f"{', '.join(missing_fields)}",
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

        # Type assertions after validation
        assert role_arn is not None
        assert region is not None
        assert db_name is not None

        # Step 1: Assume the IAM role
        credentials = cls.get_iam_credentials(
            role_arn=role_arn,
            region=region,
            external_id=external_id,
            session_duration=session_duration,
        )

        # Step 2: Get Redshift credentials based on deployment type
        if is_serverless:
            assert workgroup_name is not None
            logger.debug(
                "Applying Redshift Serverless IAM authentication for workgroup %s",
                workgroup_name,
            )
            db_user, db_password = cls.generate_redshift_credentials(
                credentials=credentials,
                workgroup_name=workgroup_name,
                db_name=db_name,
                region=region,
            )
        else:
            assert cluster_identifier is not None
            assert db_username is not None
            logger.debug(
                "Applying Redshift provisioned cluster IAM authentication for %s",
                cluster_identifier,
            )
            db_user, db_password = cls.generate_redshift_cluster_credentials(
                credentials=credentials,
                cluster_identifier=cluster_identifier,
                db_user=db_username,
                db_name=db_name,
                region=region,
            )

        # Step 3: Update connection parameters
        connect_args = params.setdefault("connect_args", {})
        connect_args["password"] = db_password
        connect_args["user"] = db_user

        # Step 4: Enable SSL (required for Redshift IAM authentication)
        connect_args["sslmode"] = "verify-ca"

        logger.debug("Redshift IAM authentication configured successfully")
