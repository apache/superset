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
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Pattern, Tuple, TYPE_CHECKING
from urllib import parse

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from flask import current_app
from flask_babel import gettext as __
from marshmallow import fields, Schema
from sqlalchemy.engine.url import URL
from typing_extensions import TypedDict

from superset.databases.utils import make_url_safe
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.models.sql_lab import Query
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.models.core import Database

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

    parameters_schema = SnowflakeParametersSchema()
    default_driver = "snowflake"
    sqlalchemy_uri_placeholder = "snowflake://"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATE_TRUNC('SECOND', {col})",
        "PT1M": "DATE_TRUNC('MINUTE', {col})",
        "PT5M": "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 5) * 5, \
                DATE_TRUNC('HOUR', {col}))",
        "PT10M": "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 10) * 10, \
                 DATE_TRUNC('HOUR', {col}))",
        "PT15M": "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 15) * 15, \
                 DATE_TRUNC('HOUR', {col}))",
        "PT30M": "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 30) * 30, \
                  DATE_TRUNC('HOUR', {col}))",
        "PT1H": "DATE_TRUNC('HOUR', {col})",
        "P1D": "DATE_TRUNC('DAY', {col})",
        "P1W": "DATE_TRUNC('WEEK', {col})",
        "P1M": "DATE_TRUNC('MONTH', {col})",
        "P3M": "DATE_TRUNC('QUARTER', {col})",
        "P1Y": "DATE_TRUNC('YEAR', {col})",
    }

    custom_errors: Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
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

    @classmethod
    def adjust_database_uri(
        cls, uri: URL, selected_schema: Optional[str] = None
    ) -> URL:
        database = uri.database
        if "/" in uri.database:
            database = uri.database.split("/")[0]
        if selected_schema:
            selected_schema = parse.quote(selected_schema, safe="")
            uri = uri.set(database=f"{database}/{selected_schema}")

        return uri

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "DATEADD(S, {col}, '1970-01-01')"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "DATEADD(MS, {col}, '1970-01-01')"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"TO_DATE('{dttm.date().isoformat()}')"
        if tt == utils.TemporalType.DATETIME:
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS DATETIME)"""
        if tt == utils.TemporalType.TIMESTAMP:
            return f"""TO_TIMESTAMP('{dttm.isoformat(timespec="microseconds")}')"""
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
            Dict[str, Any]
        ] = None,
    ) -> str:

        return str(
            URL(
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
            Dict[str, str]
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
        cls, parameters: SnowflakeParametersType
    ) -> List[SupersetError]:
        errors: List[SupersetError] = []
        required = {
            "warehouse",
            "username",
            "database",
            "account",
            "role",
            "password",
        }
        present = {key for key in parameters if parameters.get(key, ())}
        missing = sorted(required - present)

        if missing:
            errors.append(
                SupersetError(
                    message=f'One or more parameters are missing: {", ".join(missing)}',
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
        params: Dict[str, Any],
    ) -> None:
        if not database.encrypted_extra:
            return
        try:
            encrypted_extra = json.loads(database.encrypted_extra)
        except json.JSONDecodeError as ex:
            logger.error(ex, exc_info=True)
            raise ex
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
            p_key = serialization.load_pem_private_key(
                key,
                password=auth_params["privatekey_pass"].encode(),
                backend=default_backend(),
            )
            pkb = p_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            connect_args["private_key"] = pkb
        else:
            allowed_extra_auths = current_app.config[
                "ALLOWED_EXTRA_AUTHENTICATIONS"
            ].get("snowflake", {})
            if auth_method in allowed_extra_auths:
                snowflake_auth = allowed_extra_auths.get(auth_method)
            else:
                raise ValueError(
                    f"For security reason, custom authentication '{auth_method}' "
                    f"must be listed in 'ALLOWED_EXTRA_AUTHENTICATIONS' config"
                )
            connect_args["auth"] = snowflake_auth(**auth_params)
