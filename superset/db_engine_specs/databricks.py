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
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, TYPE_CHECKING

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.validate import Range
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from typing_extensions import TypedDict

from superset.constants import USER_AGENT
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec, BasicParametersMixin
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils.network import is_hostname_valid, is_port_open

if TYPE_CHECKING:
    from superset.models.core import Database


class DatabricksParametersSchema(Schema):
    """
    This is the list of fields that are expected
    from the client in order to build the sqlalchemy string
    """

    access_token = fields.Str(required=True)
    host = fields.Str(required=True)
    port = fields.Integer(
        required=True,
        description=__("Database port"),
        validate=Range(min=0, max=2**16, max_inclusive=False),
    )
    database = fields.Str(required=True)
    encryption = fields.Boolean(
        required=False, description=__("Use an encrypted connection to the database")
    )


class DatabricksPropertiesSchema(DatabricksParametersSchema):
    """
    This is the list of fields expected
    for successful database creation execution
    """

    http_path = fields.Str(required=True)


class DatabricksParametersType(TypedDict):
    """
    The parameters are all the keys that do
    not exist on the Database model.
    These are used to build the sqlalchemy uri
    """

    access_token: str
    host: str
    port: int
    database: str
    encryption: bool


class DatabricksPropertiesType(TypedDict):
    """
    All properties that need to be available to
    this engine in order to create a connection
    if the dynamic form is used
    """

    parameters: DatabricksParametersType
    extra: str


time_grain_expressions = {
    None: "{col}",
    "PT1S": "date_trunc('second', {col})",
    "PT1M": "date_trunc('minute', {col})",
    "PT1H": "date_trunc('hour', {col})",
    "P1D": "date_trunc('day', {col})",
    "P1W": "date_trunc('week', {col})",
    "P1M": "date_trunc('month', {col})",
    "P3M": "date_trunc('quarter', {col})",
    "P1Y": "date_trunc('year', {col})",
    "P1W/1970-01-03T00:00:00Z": (
        "date_trunc('week', {col} + interval '1 day') + interval '5 days'"
    ),
    "1969-12-28T00:00:00Z/P1W": (
        "date_trunc('week', {col} + interval '1 day') - interval '1 day'"
    ),
}


class DatabricksHiveEngineSpec(HiveEngineSpec):
    engine_name = "Databricks Interactive Cluster"

    engine = "databricks"
    drivers = {"pyhive": "Hive driver for Interactive Cluster"}
    default_driver = "pyhive"

    _show_functions_column = "function"

    _time_grain_expressions = time_grain_expressions


class DatabricksODBCEngineSpec(BaseEngineSpec):
    engine_name = "Databricks SQL Endpoint"

    engine = "databricks"
    drivers = {"pyodbc": "ODBC driver for SQL endpoint"}
    default_driver = "pyodbc"

    _time_grain_expressions = time_grain_expressions

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        return HiveEngineSpec.convert_dttm(target_type, dttm, db_extra=db_extra)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return HiveEngineSpec.epoch_to_dttm()


class DatabricksNativeEngineSpec(DatabricksODBCEngineSpec, BasicParametersMixin):
    engine_name = "Databricks"

    engine = "databricks"
    drivers = {"connector": "Native all-purpose driver"}
    default_driver = "connector"

    parameters_schema = DatabricksParametersSchema()
    properties_schema = DatabricksPropertiesSchema()

    sqlalchemy_uri_placeholder = (
        "databricks+connector://token:{access_token}@{host}:{port}/{database_name}"
    )
    encryption_parameters = {"ssl": "1"}

    @staticmethod
    def get_extra_params(database: "Database") -> Dict[str, Any]:
        """
        Add a user agent to be used in the requests.
        Trim whitespace from connect_args to avoid databricks driver errors
        """
        extra: Dict[str, Any] = BaseEngineSpec.get_extra_params(database)
        engine_params: Dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: Dict[str, Any] = engine_params.setdefault("connect_args", {})

        connect_args.setdefault("http_headers", [("User-Agent", USER_AGENT)])
        connect_args.setdefault("_user_agent_entry", USER_AGENT)

        # trim whitespace from http_path to avoid databricks errors on connecting
        if http_path := connect_args.get("http_path"):
            connect_args["http_path"] = http_path.strip()

        return extra

    @classmethod
    def get_table_names(
        cls,
        database: "Database",
        inspector: Inspector,
        schema: Optional[str],
    ) -> Set[str]:
        return super().get_table_names(
            database, inspector, schema
        ) - cls.get_view_names(database, inspector, schema)

    @classmethod
    def build_sqlalchemy_uri(  # type: ignore
        cls, parameters: DatabricksParametersType, *_
    ) -> str:

        query = {}
        if parameters.get("encryption"):
            if not cls.encryption_parameters:
                raise Exception("Unable to build a URL with encryption enabled")
            query.update(cls.encryption_parameters)

        return str(
            URL(
                f"{cls.engine}+{cls.default_driver}".rstrip("+"),
                username="token",
                password=parameters.get("access_token"),
                host=parameters["host"],
                port=parameters["port"],
                database=parameters["database"],
                query=query,
            )
        )

    @classmethod
    def extract_errors(
        cls, ex: Exception, context: Optional[Dict[str, Any]] = None
    ) -> List[SupersetError]:
        raw_message = cls._extract_error_message(ex)

        context = context or {}
        # access_token isn't currently parseable from the
        # databricks error response, but adding it in here
        # for reference if their error message changes
        context = {
            "host": context.get("hostname"),
            "access_token": context.get("password"),
            "port": context.get("port"),
            "username": context.get("username"),
            "database": context.get("database"),
        }
        for regex, (message, error_type, extra) in cls.custom_errors.items():
            match = regex.search(raw_message)
            if match:
                params = {**context, **match.groupdict()}
                extra["engine_name"] = cls.engine_name
                return [
                    SupersetError(
                        error_type=error_type,
                        message=message % params,
                        level=ErrorLevel.ERROR,
                        extra=extra,
                    )
                ]

        return [
            SupersetError(
                error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                message=cls._extract_error_message(ex),
                level=ErrorLevel.ERROR,
                extra={"engine_name": cls.engine_name},
            )
        ]

    @classmethod
    def get_parameters_from_uri(  # type: ignore
        cls, uri: str, *_, **__
    ) -> DatabricksParametersType:
        url = make_url_safe(uri)
        encryption = all(
            item in url.query.items() for item in cls.encryption_parameters.items()
        )
        return {
            "access_token": url.password,
            "host": url.host,
            "port": url.port,
            "database": url.database,
            "encryption": encryption,
        }

    @classmethod
    def validate_parameters(  # type: ignore
        cls,
        properties: DatabricksPropertiesType,
    ) -> List[SupersetError]:
        errors: List[SupersetError] = []
        required = {"access_token", "host", "port", "database", "extra"}
        extra = json.loads(properties.get("extra", "{}"))
        engine_params = extra.get("engine_params", {})
        connect_args = engine_params.get("connect_args", {})
        parameters = {
            **properties,
            **properties.get("parameters", {}),
        }
        if connect_args.get("http_path"):
            parameters["http_path"] = connect_args.get("http_path")

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

        host = parameters.get("host", None)
        if not host:
            return errors

        if not is_hostname_valid(host):  # type: ignore
            errors.append(
                SupersetError(
                    message="The hostname provided can't be resolved.",
                    error_type=SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={"invalid": ["host"]},
                ),
            )
            return errors

        port = parameters.get("port", None)
        if not port:
            return errors
        try:
            port = int(port)  # type: ignore
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
        elif not is_port_open(host, port):  # type: ignore
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
    def parameters_json_schema(cls) -> Any:
        """
        Return configuration parameters as OpenAPI.
        """
        if not cls.properties_schema:
            return None

        spec = APISpec(
            title="Database Parameters",
            version="1.0.0",
            openapi_version="3.0.2",
            plugins=[MarshmallowPlugin()],
        )
        spec.components.schema(cls.__name__, schema=cls.properties_schema)
        return spec.to_dict()["components"]["schemas"][cls.__name__]
