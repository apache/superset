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
from __future__ import annotations

import logging
import re
from datetime import datetime
from re import Pattern
from typing import Any, cast, Optional, TYPE_CHECKING, TypedDict
from urllib import parse

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from flask import current_app as app, has_request_context
from flask_babel import gettext as __
from marshmallow import fields, Schema
from sqlalchemy import types
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlalchemy.exc import DatabaseError as SqlalchemyDatabaseError

from superset import is_feature_enabled, security_manager
from superset.constants import TimeGrain
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec, BasicPropertiesType
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.models.sql_lab import Query
from superset.superset_typing import (
    OAuth2ClientConfig,
    OAuth2State,
)
from superset.utils import json
from superset.utils.core import get_user_agent, QuerySource
from superset.utils.oauth2 import encode_oauth2_state

if TYPE_CHECKING:
    from superset.models.core import Database

try:
    from snowflake.connector.errors import DatabaseError
except ImportError:
    # Use a distinct sentinel type when snowflake is not installed to avoid
    # matching unrelated exception types (using `Exception` would be too broad).
    class _SnowflakeDatabaseError(Exception):
        """Sentinel type to stand in for snowflake.connector.errors.DatabaseError."""

        pass

    DatabaseError = _SnowflakeDatabaseError


class CustomSnowflakeAuthErrorMeta(type):
    def __instancecheck__(cls, instance: object) -> bool:
        return (
            isinstance(instance, SqlalchemyDatabaseError)
            and isinstance(cast(SqlalchemyDatabaseError, instance).orig, DatabaseError)
            and "Invalid OAuth access token" in str(instance)
        )


class CustomSnowflakeAuthError(DatabaseError, metaclass=CustomSnowflakeAuthErrorMeta):
    pass


# Regular expressions to catch custom errors
OBJECT_DOES_NOT_EXIST_REGEX = re.compile(
    r"Object (?P<object>.*?) does not exist or not authorized."
)

SYNTAX_ERROR_REGEX = re.compile(
    "syntax error line (?P<line>.+?) at position (?P<position>.+?) "
    "unexpected '(?P<syntax_error>.+?)'."
)

logger = logging.getLogger(__name__)


class SnowflakeParametersSchema(Schema):
    username = fields.Str(required=True)
    password = fields.Str(required=True)
    account = fields.Str(required=True)
    database = fields.Str(required=True)
    role = fields.Str(required=True)
    warehouse = fields.Str(required=True)


class SnowflakeParametersType(TypedDict):
    username: str
    password: str
    account: str
    database: str
    role: str
    warehouse: str


class SnowflakeEngineSpec(PostgresBaseEngineSpec):
    engine = "snowflake"
    engine_name = "Snowflake"
    force_column_alias_quotes = True
    max_column_name_length = 256

    # Snowflake doesn't support IS true/false syntax, use = true/false instead
    use_equality_for_boolean_filters = True

    parameters_schema = SnowflakeParametersSchema()
    default_driver = "snowflake"
    sqlalchemy_uri_placeholder = "snowflake://"

    supports_dynamic_schema = True
    supports_catalog = supports_dynamic_catalog = supports_cross_catalog_queries = True

    # pylint: disable=invalid-name
    encrypted_extra_sensitive_fields = {
        "$.auth_params.privatekey_body",
        "$.auth_params.privatekey_pass",
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC('SECOND', {col})",
        TimeGrain.MINUTE: "DATE_TRUNC('MINUTE', {col})",
        TimeGrain.FIVE_MINUTES: "DATEADD(MINUTE, \
            FLOOR(DATE_PART(MINUTE, {col}) / 5) * 5, DATE_TRUNC('HOUR', {col}))",
        TimeGrain.TEN_MINUTES: "DATEADD(MINUTE,  \
            FLOOR(DATE_PART(MINUTE, {col}) / 10) * 10, DATE_TRUNC('HOUR', {col}))",
        TimeGrain.FIFTEEN_MINUTES: "DATEADD(MINUTE, \
            FLOOR(DATE_PART(MINUTE, {col}) / 15) * 15, DATE_TRUNC('HOUR', {col}))",
        TimeGrain.THIRTY_MINUTES: "DATEADD(MINUTE, \
            FLOOR(DATE_PART(MINUTE, {col}) / 30) * 30, DATE_TRUNC('HOUR', {col}))",
        TimeGrain.HOUR: "DATE_TRUNC('HOUR', {col})",
        TimeGrain.DAY: "DATE_TRUNC('DAY', {col})",
        TimeGrain.WEEK: "DATE_TRUNC('WEEK', {col})",
        TimeGrain.MONTH: "DATE_TRUNC('MONTH', {col})",
        TimeGrain.QUARTER: "DATE_TRUNC('QUARTER', {col})",
        TimeGrain.YEAR: "DATE_TRUNC('YEAR', {col})",
    }

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        OBJECT_DOES_NOT_EXIST_REGEX: (
            __("%(object)s does not exist in this database."),
            SupersetErrorType.OBJECT_DOES_NOT_EXIST_ERROR,
            {},
        ),
        SYNTAX_ERROR_REGEX: (
            __(
                "Please check your query for syntax errors at or "
                'near "%(syntax_error)s". Then, try running your query again.'
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    # OAuth 2.0 support
    supports_oauth2 = True
    oauth2_exception = CustomSnowflakeAuthError

    @classmethod
    def is_oauth2_enabled(cls) -> bool:
        """
        Return whether OAuth2 authentication is enabled.
        """

        # When alerts or reports connect to the database in the background,
        # OAuth2 authentication fails; therefore, OAuth2 authentication is disabled
        # for background execution.
        if not has_request_context():
            return False

        return (
            cls.supports_oauth2
            and cls.engine_name in app.config["DATABASE_OAUTH2_CLIENTS"]
        )

    @classmethod
    def get_oauth2_config(cls) -> OAuth2ClientConfig | None:
        """
        Build the DB engine spec level OAuth2 client config.
        """
        if not cls.is_oauth2_enabled():
            return None

        return super().get_oauth2_config()

    @classmethod
    def impersonate_user(
        cls,
        database: Database,
        username: str | None,
        user_token: str | None,
        url: URL,
        engine_kwargs: dict[str, Any],
    ) -> tuple[URL, dict[str, Any]]:
        """
        Modify URL and/or engine kwargs to impersonate a different user.
        """
        connect_args = engine_kwargs.setdefault("connect_args", {})

        # When test_connection is executed (i.e., when validate_default_parameters is
        # set to True in connect_args), authentication via OAuth is not performed.
        if (
            not connect_args.get("validate_default_parameters", False)
            and cls.is_oauth2_enabled()
        ):
            url = url.update_query_dict({"authenticator": "oauth"})
            connect_args["authenticator"] = "oauth"

        if user_token and cls.is_oauth2_enabled():
            if username is not None:
                user = security_manager.find_user(username=username)
                if user and user.email:
                    if is_feature_enabled("IMPERSONATE_WITH_EMAIL_PREFIX"):
                        url = url.set(username=user.email.split("@")[0])
                    else:
                        url = url.set(username=user.email)

            url = url.update_query_dict({"token": user_token})

        return url, engine_kwargs

    @classmethod
    def get_oauth2_authorization_uri(
        cls,
        config: OAuth2ClientConfig,
        state: OAuth2State,
    ) -> str:
        """
        Return URI for initial OAuth2 request.
        """
        uri = config["authorization_request_uri"]
        # When calling the Snowflake OAuth authorization endpoint for a custom client,
        # specify only the query parameters documented in the URL below.
        # Adding unsupported parameters
        # (e.g., `prompt` as used in BaseEngineSpec.get_oauth2_authorization_uri)
        # will cause an error.
        # https://docs.snowflake.com/user-guide/oauth-custom#query-parameters
        params = {
            "scope": config["scope"],
            "response_type": "code",
            "state": encode_oauth2_state(state),
            "redirect_uri": config["redirect_uri"],
            "client_id": config["id"],
        }
        return parse.urljoin(uri, "?" + parse.urlencode(params))

    @staticmethod
    def get_extra_params(
        database: Database, source: QuerySource | None = None
    ) -> dict[str, Any]:
        """
        Add a user agent to be used in the requests.
        """
        extra: dict[str, Any] = BaseEngineSpec.get_extra_params(database)
        engine_params: dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: dict[str, Any] = engine_params.setdefault("connect_args", {})
        user_agent = get_user_agent(database, source)

        connect_args.setdefault("application", user_agent)

        return extra

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> tuple[URL, dict[str, Any]]:
        if "/" in uri.database:
            current_catalog, current_schema = uri.database.split("/", 1)
        else:
            current_catalog, current_schema = uri.database, None

        adjusted_database = "/".join(
            [
                catalog or current_catalog,
                schema or current_schema or "",
            ]
        ).rstrip("/")

        uri = uri.set(database=adjusted_database)

        return uri, connect_args

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> Optional[str]:
        """
        Return the configured schema.
        """
        database = sqlalchemy_uri.database.strip("/")

        if "/" not in database:
            return None

        return parse.unquote(database.split("/")[1])

    @classmethod
    def get_default_catalog(cls, database: "Database") -> str:
        """
        Return the default catalog.
        """
        return database.url_object.database.split("/")[0]

    @classmethod
    def get_catalog_names(
        cls,
        database: "Database",
        inspector: Inspector,
    ) -> set[str]:
        """
        Return all catalogs.

        In Snowflake, a catalog is called a "database".
        """
        return {
            catalog
            for (catalog,) in inspector.bind.execute(
                "SELECT DATABASE_NAME from information_schema.databases"
            )
        }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "DATEADD(S, {col}, '1970-01-01')"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "DATEADD(MS, {col}, '1970-01-01')"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"TO_DATE('{dttm.date().isoformat()}')"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""TO_TIMESTAMP('{dttm.isoformat(timespec="microseconds")}')"""
        if isinstance(sqla_type, types.DateTime):
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS DATETIME)"""
        return None

    @staticmethod
    def mutate_db_for_connection_test(database: "Database") -> None:
        """
        By default, snowflake doesn't validate if the user/role has access to the chosen
        database.

        :param database: instance to be mutated
        """
        extra = json.loads(database.extra or "{}")
        engine_params = extra.get("engine_params", {})
        connect_args = engine_params.get("connect_args", {})
        connect_args["validate_default_parameters"] = True
        engine_params["connect_args"] = connect_args
        extra["engine_params"] = engine_params
        database.extra = json.dumps(extra)

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> Optional[str]:
        """
        Get Snowflake session ID that will be used to cancel all other running
        queries in the same session.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: Snowflake Session ID
        """
        cursor.execute("SELECT CURRENT_SESSION()")
        row = cursor.fetchone()
        return row[0]

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel query in the underlying database.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: Snowflake Session ID
        :return: True if query cancelled successfully, False otherwise
        """
        try:
            cursor.execute(f"SELECT SYSTEM$CANCEL_ALL_QUERIES({cancel_query_id})")
        except Exception:  # pylint: disable=broad-except
            return False

        return True

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: SnowflakeParametersType,
        encrypted_extra: Optional[  # pylint: disable=unused-argument
            dict[str, Any]
        ] = None,
    ) -> str:
        return str(
            URL.create(
                "snowflake",
                username=parameters.get("username"),
                password=parameters.get("password"),
                host=parameters.get("account"),
                database=parameters.get("database"),
                query={
                    "role": parameters.get("role"),
                    "warehouse": parameters.get("warehouse"),
                },
            )
        )

    @classmethod
    def get_parameters_from_uri(
        cls,
        uri: str,
        encrypted_extra: Optional[  # pylint: disable=unused-argument
            dict[str, str]
        ] = None,
    ) -> Any:
        url = make_url_safe(uri)
        query = dict(url.query.items())
        return {
            "username": url.username,
            "password": url.password,
            "account": url.host,
            "database": url.database,
            "role": query.get("role"),
            "warehouse": query.get("warehouse"),
        }

    @classmethod
    def validate_parameters(
        cls, properties: BasicPropertiesType
    ) -> list[SupersetError]:
        errors: list[SupersetError] = []
        required = {
            "warehouse",
            "username",
            "database",
            "account",
            "role",
            "password",
        }
        parameters = properties.get("parameters", {})
        present = {key for key in parameters if parameters.get(key, ())}

        if missing := sorted(required - present):
            errors.append(
                SupersetError(
                    message=f"One or more parameters are missing: {', '.join(missing)}",
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.WARNING,
                    extra={"missing": missing},
                ),
            )
        return errors

    @classmethod
    def parameters_json_schema(cls) -> Any:
        """
        Return configuration parameters as OpenAPI.
        """
        if not cls.parameters_schema:
            return None

        ma_plugin = MarshmallowPlugin()
        spec = APISpec(
            title="Database Parameters",
            version="1.0.0",
            openapi_version="3.0.0",
            plugins=[ma_plugin],
        )

        spec.components.schema(cls.__name__, schema=cls.parameters_schema)
        return spec.to_dict()["components"]["schemas"][cls.__name__]

    @staticmethod
    def update_params_from_encrypted_extra(
        database: "Database",
        params: dict[str, Any],
    ) -> None:
        # To use OAuth authentication, a database connection must first be created using
        # another authenticator (typically key-pair authentication)
        # with “Impersonate logged in user” enabled.
        # Key-pair authentication is used for connection tests,
        # while OAuth authentication is used when executing actual queries,
        # such as in SQL Lab or dashboards.
        # Therefore, when using OAuth authentication, the key-pair authentication
        # settings are not loaded, and the connection is established using OAuth only.
        connect_args = params.get("connect_args") or {}
        if connect_args.get("authenticator") == "oauth":
            return

        if not database.encrypted_extra:
            return
        try:
            encrypted_extra = json.loads(database.encrypted_extra)
        except json.JSONDecodeError as ex:
            logger.error(ex, exc_info=True)
            raise
        auth_method = encrypted_extra.get("auth_method", None)
        auth_params = encrypted_extra.get("auth_params", {})
        if not auth_method:
            return
        connect_args = params.setdefault("connect_args", {})
        if auth_method == "keypair":
            privatekey_body = auth_params.get("privatekey_body", None)
            key = None
            if privatekey_body:
                key = privatekey_body.encode()
            else:
                with open(auth_params["privatekey_path"], "rb") as key_temp:
                    key = key_temp.read()
            privatekey_pass = auth_params.get("privatekey_pass", None)
            password = privatekey_pass.encode() if privatekey_pass is not None else None
            p_key = serialization.load_pem_private_key(
                key,
                password=password,
                backend=default_backend(),
            )
            pkb = p_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            connect_args["private_key"] = pkb
        else:
            allowed_extra_auths = app.config["ALLOWED_EXTRA_AUTHENTICATIONS"].get(
                "snowflake", {}
            )
            if auth_method in allowed_extra_auths:
                snowflake_auth = allowed_extra_auths.get(auth_method)
            else:
                raise ValueError(
                    f"For security reason, custom authentication '{auth_method}' "
                    f"must be listed in 'ALLOWED_EXTRA_AUTHENTICATIONS' config"
                )
            connect_args["auth"] = snowflake_auth(**auth_params)
