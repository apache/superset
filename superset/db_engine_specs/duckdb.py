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

import re
from datetime import datetime
from re import Pattern
from typing import Any, TYPE_CHECKING, TypedDict

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask_babel import gettext as __
from marshmallow import fields, Schema
from sqlalchemy import types
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL

from superset.config import VERSION_STRING
from superset.constants import TimeGrain, USER_AGENT
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType

if TYPE_CHECKING:
    # prevent circular imports
    from superset.models.core import Database


COLUMN_DOES_NOT_EXIST_REGEX = re.compile("no such column: (?P<column_name>.+)")
DEFAULT_ACCESS_TOKEN_URL = (
    "https://app.motherduck.com/token-request?appName=Superset&close=y"  # noqa: S105
)


# schema for adding a database by providing parameters instead of the
# full SQLAlchemy URI
class DuckDBParametersSchema(Schema):
    access_token = fields.String(
        allow_none=True,
        metadata={"description": __("MotherDuck token")},
        load_default=DEFAULT_ACCESS_TOKEN_URL,
    )
    database = fields.String(
        required=False, metadata={"description": __("Database name")}
    )
    query = fields.Dict(
        keys=fields.Str(),
        values=fields.Raw(),
        metadata={"description": __("Additional parameters")},
    )


class DuckDBParametersType(TypedDict, total=False):
    access_token: str | None
    database: str
    query: dict[str, Any]


class DuckDBPropertiesType(TypedDict):
    parameters: DuckDBParametersType


class DuckDBParametersMixin:
    """
    Mixin for configuring DB engine specs via a dictionary.

    With this mixin the SQLAlchemy engine can be configured through
    individual parameters, instead of the full SQLAlchemy URI. This
    mixin is for DuckDB:

        duckdb:///file_path[?key=value&key=value...]
        duckdb:///md:database[?key=value&key=value...]

    """

    engine = "duckdb"

    # schema describing the parameters used to configure the DB
    parameters_schema = DuckDBParametersSchema()

    # recommended driver name for the DB engine spec
    default_driver = ""

    # query parameter to enable encryption in the database connection
    # for Postgres this would be `{"sslmode": "verify-ca"}`, eg.
    encryption_parameters: dict[str, str] = {}

    @staticmethod
    def _is_motherduck(database: str) -> bool:
        return "md:" in database

    @classmethod
    def build_sqlalchemy_uri(  # pylint: disable=unused-argument
        cls,
        parameters: DuckDBParametersType,
        encrypted_extra: dict[str, str] | None = None,
    ) -> str:
        """
        Build SQLAlchemy URI for connecting to a DuckDB database.
        If an access token is specified, return a URI to connect to a MotherDuck database.
        """  # noqa: E501
        if parameters is None:
            parameters = {}
        query = parameters.get("query", {})
        database = parameters.get("database", ":memory:")
        token = parameters.get("access_token")

        if cls._is_motherduck(database) or (
            token and token != DEFAULT_ACCESS_TOKEN_URL
        ):
            return MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)

        return str(URL(drivername=cls.engine, database=database, query=query))

    @classmethod
    def get_parameters_from_uri(  # pylint: disable=unused-argument
        cls, uri: str, encrypted_extra: dict[str, Any] | None = None
    ) -> DuckDBParametersType:
        url = make_url_safe(uri)
        query = {
            key: value
            for (key, value) in url.query.items()
            if (key, value) not in cls.encryption_parameters.items()
        }
        access_token = query.pop("motherduck_token", "")
        return {
            "access_token": access_token,
            "database": url.database,
            "query": query,
        }

    @classmethod
    def validate_parameters(
        cls, properties: DuckDBPropertiesType
    ) -> list[SupersetError]:
        """
        Validates any number of parameters, for progressive validation.
        """
        errors: list[SupersetError] = []

        parameters = properties.get("parameters", {})
        if cls._is_motherduck(parameters.get("database", "")):
            required = {"access_token"}
        else:
            required = set()
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

        spec = APISpec(
            title="Database Parameters",
            version="1.0.0",
            openapi_version="3.0.2",
            plugins=[MarshmallowPlugin()],
        )
        spec.components.schema(cls.__name__, schema=cls.parameters_schema)
        return spec.to_dict()["components"]["schemas"][cls.__name__]


class DuckDBEngineSpec(DuckDBParametersMixin, BaseEngineSpec):
    engine = "duckdb"
    engine_name = "DuckDB"
    default_driver = "duckdb_engine"

    sqlalchemy_uri_placeholder = "duckdb:////path/to/duck.db"

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC('second', {col})",
        TimeGrain.MINUTE: "DATE_TRUNC('minute', {col})",
        TimeGrain.HOUR: "DATE_TRUNC('hour', {col})",
        TimeGrain.DAY: "DATE_TRUNC('day', {col})",
        TimeGrain.WEEK: "DATE_TRUNC('week', {col})",
        TimeGrain.MONTH: "DATE_TRUNC('month', {col})",
        TimeGrain.QUARTER: "DATE_TRUNC('quarter', {col})",
        TimeGrain.YEAR: "DATE_TRUNC('year', {col})",
    }

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('We can\'t seem to resolve the column "%(column_name)s"'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, (types.String, types.DateTime)):
            return f"""'{dttm.isoformat(sep=" ", timespec="microseconds")}'"""
        return None

    @classmethod
    def get_table_names(
        cls, database: Database, inspector: Inspector, schema: str | None
    ) -> set[str]:
        return set(inspector.get_table_names(schema))

    @staticmethod
    def get_extra_params(database: Database) -> dict[str, Any]:
        """
        Add a user agent to be used in the requests.
        """
        extra: dict[str, Any] = BaseEngineSpec.get_extra_params(database)
        engine_params: dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: dict[str, Any] = engine_params.setdefault("connect_args", {})
        config: dict[str, Any] = connect_args.setdefault("config", {})
        custom_user_agent = config.pop("custom_user_agent", "")
        delim = " " if custom_user_agent else ""
        user_agent = USER_AGENT.replace(" ", "-").lower()
        user_agent = f"{user_agent}/{VERSION_STRING}{delim}{custom_user_agent}"
        config.setdefault("custom_user_agent", user_agent)

        return extra


class MotherDuckEngineSpec(DuckDBEngineSpec):
    engine = "motherduck"
    engine_name = "MotherDuck"
    engine_aliases: set[str] = {"duckdb"}

    sqlalchemy_uri_placeholder = (
        "duckdb:///md:{database_name}?motherduck_token={SERVICE_TOKEN}"
    )

    @staticmethod
    def _is_motherduck(database: str) -> bool:
        return True

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: DuckDBParametersType,
        encrypted_extra: dict[str, str] | None = None,
    ) -> str:
        """
        Build SQLAlchemy URI for connecting to a MotherDuck database
        """
        # make a copy so that we don't update the original
        query = parameters.get("query", {}).copy()
        database = parameters.get("database", "")
        token = parameters.get("access_token", "")

        if not database.startswith("md:"):
            database = f"md:{database}"
        if token and token != DEFAULT_ACCESS_TOKEN_URL:
            query["motherduck_token"] = token
        else:
            raise ValueError(
                f"Need MotherDuck token to connect to database '{database}'."
            )

        return str(
            URL(drivername=DuckDBEngineSpec.engine, database=database, query=query)
        )
