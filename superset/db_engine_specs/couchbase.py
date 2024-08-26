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

from datetime import datetime
from typing import Any, Optional, TypedDict
from urllib import parse

from flask_babel import gettext as __
from marshmallow import fields, Schema
from sqlalchemy.engine.url import URL

from superset.constants import TimeGrain
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersMixin,
    BasicParametersType as BaseBasicParametersType,
    BasicPropertiesType as BaseBasicPropertiesType,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils.network import is_hostname_valid, is_port_open


class BasicParametersType(TypedDict, total=False):
    username: Optional[str]
    password: Optional[str]
    host: str
    database: str
    port: Optional[int]
    query: dict[str, Any]
    encryption: bool


class BasicPropertiesType(TypedDict):
    parameters: BasicParametersType


class CouchbaseParametersSchema(Schema):
    username = fields.String(allow_none=True, metadata={"description": __("Username")})
    password = fields.String(allow_none=True, metadata={"description": __("Password")})
    host = fields.String(
        required=True, metadata={"description": __("Hostname or IP address")}
    )
    database = fields.String(
        allow_none=True, metadata={"description": __("Database name")}
    )
    port = fields.Integer(
        allow_none=True, metadata={"description": __("Database port")}
    )
    encryption = fields.Boolean(
        dump_default=False,
        metadata={"description": __("Use an encrypted connection to the database")},
    )
    query = fields.Dict(
        keys=fields.Str(),
        values=fields.Raw(),
        metadata={"description": __("Additional parameters")},
    )


class CouchbaseEngineSpec(BasicParametersMixin, BaseEngineSpec):
    engine = "couchbase"
    engine_aliases = {"couchbasedb"}
    engine_name = "Couchbase"
    default_driver = "couchbase"
    allows_joins = False
    allows_subqueries = False
    sqlalchemy_uri_placeholder = (
        "couchbase://user:password@host[:port]?truststorepath=value?ssl=value"
    )
    parameters_schema = CouchbaseParametersSchema()

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC_STR(TOSTRING({col}),'second')",
        TimeGrain.MINUTE: "DATE_TRUNC_STR(TOSTRING({col}),'minute')",
        TimeGrain.HOUR: "DATE_TRUNC_STR(TOSTRING({col}),'hour')",
        TimeGrain.DAY: "DATE_TRUNC_STR(TOSTRING({col}),'day')",
        TimeGrain.MONTH: "DATE_TRUNC_STR(TOSTRING({col}),'month')",
        TimeGrain.YEAR: "DATE_TRUNC_STR(TOSTRING({col}),'year')",
        TimeGrain.QUARTER: "DATE_TRUNC_STR(TOSTRING({col}),'quarter')",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "MILLIS_TO_STR({col} * 1000)"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "MILLIS_TO_STR({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        if target_type.lower() == "date":
            formatted_date = dttm.date().isoformat()
        else:
            formatted_date = dttm.replace(microsecond=0).isoformat()
        return f"DATETIME(DATE_FORMAT_STR(STR_TO_UTC('{formatted_date}'), 'iso8601'))"

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: BaseBasicParametersType,
        encrypted_extra: Optional[dict[str, Any]] = None,
    ) -> str:
        query_params = parameters.get("query", {}).copy()
        if parameters.get("encryption"):
            query_params["ssl"] = "true"
        else:
            query_params["ssl"] = "false"

        if parameters.get("port") is None:
            uri = URL.create(
                "couchbase",
                username=parameters.get("username"),
                password=parameters.get("password"),
                host=parameters["host"],
                port=None,
                query=query_params,
            )
        else:
            uri = URL.create(
                "couchbase",
                username=parameters.get("username"),
                password=parameters.get("password"),
                host=parameters["host"],
                port=parameters.get("port"),
                query=query_params,
            )
        print(uri)
        return str(uri)

    @classmethod
    def get_parameters_from_uri(
        cls, uri: str, encrypted_extra: Optional[dict[str, Any]] = None
    ) -> BaseBasicParametersType:
        print("get_parameters is called : ", uri)
        url = make_url_safe(uri)
        query = {
            key: value
            for key, value in url.query.items()
            if (key, value) not in cls.encryption_parameters.items()
        }
        ssl_value = url.query.get("ssl", "false").lower()
        encryption = ssl_value == "true"
        return BaseBasicParametersType(
            username=url.username,
            password=url.password,
            host=url.host,
            port=url.port,
            database=url.database,
            query=query,
            encryption=encryption,
        )

    @classmethod
    def validate_parameters(
        cls, properties: BaseBasicPropertiesType
    ) -> list[SupersetError]:
        """
        Couchbase local server needs hostname and port but on cloud we need only connection String along with credentials to connect.
        """
        errors: list[SupersetError] = []

        required = {"host", "username", "password", "database"}
        parameters = properties.get("parameters", {})
        present = {key for key in parameters if parameters.get(key, ())}

        if missing := sorted(required - present):
            errors.append(
                SupersetError(
                    message=f'One or more parameters are missing: {", ".join(missing)}',
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.WARNING,
                    extra={"missing": missing},
                ),
            )

        host = parameters.get("host", None)
        if not host:
            return errors
        # host can be a connection string in case of couchbase cloud. So Connection Check is not required in that case.
        if not is_hostname_valid(host):
            errors.append(
                SupersetError(
                    message="The hostname provided can't be resolved.",
                    error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={"invalid": ["host"]},
                ),
            )
            return errors

        if port := parameters.get("port", None):
            try:
                port = int(port)
            except (ValueError, TypeError):
                errors.append(
                    SupersetError(
                        message="Port must be a valid integer.",
                        error_type=SupersetErrorType.CONNECTION_INVALID_PORT_ERROR,
                        level=ErrorLevel.ERROR,
                        extra={"invalid": ["port"]},
                    ),
                )
            if not (isinstance(port, int) and 0 <= port < 2**16):
                errors.append(
                    SupersetError(
                        message=(
                            "The port must be an integer between 0 and 65535 "
                            "(inclusive)."
                        ),
                        error_type=SupersetErrorType.CONNECTION_INVALID_PORT_ERROR,
                        level=ErrorLevel.ERROR,
                        extra={"invalid": ["port"]},
                    ),
                )
            elif not is_port_open(host, port):
                errors.append(
                    SupersetError(
                        message="The port is closed.",
                        error_type=SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
                        level=ErrorLevel.ERROR,
                        extra={"invalid": ["port"]},
                    ),
                )

        return errors

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> Optional[str]:
        """
        Return the configured schema.
        """
        return parse.unquote(sqlalchemy_uri.database)
