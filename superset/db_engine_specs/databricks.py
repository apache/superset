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
from typing import Any, TYPE_CHECKING, TypedDict, Union

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.validate import Range
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL

from superset.constants import TimeGrain, USER_AGENT
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec, BasicParametersMixin
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils import json
from superset.utils.network import is_hostname_valid, is_port_open

if TYPE_CHECKING:
    from superset.models.core import Database


class DatabricksBaseSchema(Schema):
    """
    Fields that are required for both Databricks drivers that uses a
    dynamic form.
    """

    access_token = fields.Str(required=True)
    host = fields.Str(required=True)
    port = fields.Integer(
        required=True,
        metadata={"description": __("Database port")},
        validate=Range(min=0, max=2**16, max_inclusive=False),
    )
    encryption = fields.Boolean(
        required=False,
        metadata={"description": __("Use an encrypted connection to the database")},
    )


class DatabricksBaseParametersType(TypedDict):
    """
    The parameters are all the keys that do not exist on the Database model.
    These are used to build the sqlalchemy uri.
    """

    access_token: str
    host: str
    port: int
    encryption: bool


class DatabricksNativeSchema(DatabricksBaseSchema):
    """
    Additional fields required only for the DatabricksNativeEngineSpec.
    """

    database = fields.Str(required=True)


class DatabricksNativePropertiesSchema(DatabricksNativeSchema):
    """
    Properties required only for the DatabricksNativeEngineSpec.
    """

    http_path = fields.Str(required=True)


class DatabricksNativeParametersType(DatabricksBaseParametersType):
    """
    Additional parameters required only for the DatabricksNativeEngineSpec.
    """

    database: str


class DatabricksNativePropertiesType(TypedDict):
    """
    All properties that need to be available to the DatabricksNativeEngineSpec
    in order tocreate a connection if the dynamic form is used.
    """

    parameters: DatabricksNativeParametersType
    extra: str


class DatabricksPythonConnectorSchema(DatabricksBaseSchema):
    """
    Additional fields required only for the DatabricksPythonConnectorEngineSpec.
    """

    http_path_field = fields.Str(required=True)
    default_catalog = fields.Str(required=True)
    default_schema = fields.Str(required=True)


class DatabricksPythonConnectorParametersType(DatabricksBaseParametersType):
    """
    Additional parameters required only for the DatabricksPythonConnectorEngineSpec.
    """

    http_path_field: str
    default_catalog: str
    default_schema: str


class DatabricksPythonConnectorPropertiesType(TypedDict):
    """
    All properties that need to be available to the DatabricksPythonConnectorEngineSpec
    in order to create a connection if the dynamic form is used.
    """

    parameters: DatabricksPythonConnectorParametersType
    extra: str


time_grain_expressions: dict[str | None, str] = {
    None: "{col}",
    TimeGrain.SECOND: "date_trunc('second', {col})",
    TimeGrain.MINUTE: "date_trunc('minute', {col})",
    TimeGrain.HOUR: "date_trunc('hour', {col})",
    TimeGrain.DAY: "date_trunc('day', {col})",
    TimeGrain.WEEK: "date_trunc('week', {col})",
    TimeGrain.MONTH: "date_trunc('month', {col})",
    TimeGrain.QUARTER: "date_trunc('quarter', {col})",
    TimeGrain.YEAR: "date_trunc('year', {col})",
    TimeGrain.WEEK_ENDING_SATURDAY: (
        "date_trunc('week', {col} + interval '1 day') + interval '5 days'"
    ),
    TimeGrain.WEEK_STARTING_SUNDAY: (
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


class DatabricksBaseEngineSpec(BaseEngineSpec):
    _time_grain_expressions = time_grain_expressions

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        return HiveEngineSpec.convert_dttm(target_type, dttm, db_extra=db_extra)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return HiveEngineSpec.epoch_to_dttm()


class DatabricksODBCEngineSpec(DatabricksBaseEngineSpec):
    engine_name = "Databricks SQL Endpoint"

    engine = "databricks"
    drivers = {"pyodbc": "ODBC driver for SQL endpoint"}
    default_driver = "pyodbc"


class DatabricksDynamicBaseEngineSpec(BasicParametersMixin, DatabricksBaseEngineSpec):
    default_driver = ""
    encryption_parameters = {"ssl": "1"}
    required_parameters = {"access_token", "host", "port"}
    context_key_mapping = {
        "access_token": "password",
        "host": "hostname",
        "port": "port",
    }

    @staticmethod
    def get_extra_params(database: Database) -> dict[str, Any]:
        """
        Add a user agent to be used in the requests.
        Trim whitespace from connect_args to avoid databricks driver errors
        """
        extra: dict[str, Any] = BaseEngineSpec.get_extra_params(database)
        engine_params: dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: dict[str, Any] = engine_params.setdefault("connect_args", {})

        connect_args.setdefault("http_headers", [("User-Agent", USER_AGENT)])
        connect_args.setdefault("_user_agent_entry", USER_AGENT)

        # trim whitespace from http_path to avoid databricks errors on connecting
        if http_path := connect_args.get("http_path"):
            connect_args["http_path"] = http_path.strip()

        return extra

    @classmethod
    def get_table_names(
        cls,
        database: Database,
        inspector: Inspector,
        schema: str | None,
    ) -> set[str]:
        return super().get_table_names(
            database, inspector, schema
        ) - cls.get_view_names(database, inspector, schema)

    @classmethod
    def extract_errors(
        cls, ex: Exception, context: dict[str, Any] | None = None
    ) -> list[SupersetError]:
        raw_message = cls._extract_error_message(ex)

        context = context or {}
        # access_token isn't currently parseable from the
        # databricks error response, but adding it in here
        # for reference if their error message changes

        for key, value in cls.context_key_mapping.items():
            context[key] = context.get(value)

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
    def validate_parameters(  # type: ignore
        cls,
        properties: Union[
            DatabricksNativePropertiesType,
            DatabricksPythonConnectorPropertiesType,
        ],
    ) -> list[SupersetError]:
        errors: list[SupersetError] = []
        if extra := json.loads(properties.get("extra")):  # type: ignore
            engine_params = extra.get("engine_params", {})
            connect_args = engine_params.get("connect_args", {})
        parameters = {
            **properties,
            **properties.get("parameters", {}),
        }
        if connect_args.get("http_path"):
            parameters["http_path"] = connect_args.get("http_path")

        present = {key for key in parameters if parameters.get(key, ())}

        if missing := sorted(cls.required_parameters - present):
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


class DatabricksNativeEngineSpec(DatabricksDynamicBaseEngineSpec):
    engine = "databricks"
    engine_name = "Databricks"
    drivers = {"connector": "Native all-purpose driver"}
    default_driver = "connector"

    parameters_schema = DatabricksNativeSchema()
    properties_schema = DatabricksNativePropertiesSchema()

    sqlalchemy_uri_placeholder = (
        "databricks+connector://token:{access_token}@{host}:{port}/{database_name}"
    )
    context_key_mapping = {
        **DatabricksDynamicBaseEngineSpec.context_key_mapping,
        "database": "database",
        "username": "username",
    }
    required_parameters = DatabricksDynamicBaseEngineSpec.required_parameters | {
        "database",
        "extra",
    }

    supports_dynamic_schema = supports_catalog = supports_dynamic_catalog = True

    @classmethod
    def build_sqlalchemy_uri(  # type: ignore
        cls, parameters: DatabricksNativeParametersType, *_
    ) -> str:
        query = {}
        if parameters.get("encryption"):
            if not cls.encryption_parameters:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "Unable to build a URL with encryption enabled"
                )
            query.update(cls.encryption_parameters)

        return str(
            URL.create(
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
    def get_parameters_from_uri(  # type: ignore
        cls, uri: str, *_, **__
    ) -> DatabricksNativeParametersType:
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

    @classmethod
    def get_default_catalog(
        cls,
        database: Database,
    ) -> str | None:
        """
        Return the default catalog.

        The default behavior for Databricks is confusing. When Unity Catalog is not
        enabled we have (the DB engine spec hasn't been tested with it enabled):

            > SHOW CATALOGS;
            spark_catalog
            > SELECT current_catalog();
            hive_metastore

        To handle permissions correctly we use the result of `SHOW CATALOGS` when a
        single catalog is returned.
        """
        with database.get_sqla_engine() as engine:
            catalogs = {catalog for (catalog,) in engine.execute("SHOW CATALOGS")}
            if len(catalogs) == 1:
                return catalogs.pop()

            return engine.execute("SELECT current_catalog()").scalar()

    @classmethod
    def get_prequeries(
        cls,
        database: Database,
        catalog: str | None = None,
        schema: str | None = None,
    ) -> list[str]:
        prequeries = []
        if catalog:
            prequeries.append(f"USE CATALOG {catalog}")
        if schema:
            prequeries.append(f"USE SCHEMA {schema}")
        return prequeries

    @classmethod
    def get_catalog_names(
        cls,
        database: Database,
        inspector: Inspector,
    ) -> set[str]:
        return {catalog for (catalog,) in inspector.bind.execute("SHOW CATALOGS")}


class DatabricksPythonConnectorEngineSpec(DatabricksDynamicBaseEngineSpec):
    engine = "databricks"
    engine_name = "Databricks Python Connector"
    default_driver = "databricks-sql-python"
    drivers = {"databricks-sql-python": "Databricks SQL Python"}

    parameters_schema = DatabricksPythonConnectorSchema()

    sqlalchemy_uri_placeholder = (
        "databricks://token:{access_token}@{host}:{port}?http_path={http_path}"
        "&catalog={default_catalog}&schema={default_schema}"
    )

    context_key_mapping = {
        **DatabricksDynamicBaseEngineSpec.context_key_mapping,
        "default_catalog": "catalog",
        "default_schema": "schema",
        "http_path_field": "http_path",
    }

    required_parameters = DatabricksDynamicBaseEngineSpec.required_parameters | {
        "default_catalog",
        "default_schema",
        "http_path_field",
    }

    supports_dynamic_schema = supports_catalog = supports_dynamic_catalog = True

    @classmethod
    def build_sqlalchemy_uri(  # type: ignore
        cls, parameters: DatabricksPythonConnectorParametersType, *_
    ) -> str:
        query = {}
        if http_path := parameters.get("http_path_field"):
            query["http_path"] = http_path
        if catalog := parameters.get("default_catalog"):
            query["catalog"] = catalog
        if schema := parameters.get("default_schema"):
            query["schema"] = schema
        if parameters.get("encryption"):
            query.update(cls.encryption_parameters)

        return str(
            URL.create(
                cls.engine,
                username="token",
                password=parameters.get("access_token"),
                host=parameters["host"],
                port=parameters["port"],
                query=query,
            )
        )

    @classmethod
    def get_parameters_from_uri(  # type: ignore
        cls, uri: str, *_: Any, **__: Any
    ) -> DatabricksPythonConnectorParametersType:
        url = make_url_safe(uri)
        query = {
            key: value
            for (key, value) in url.query.items()
            if (key, value) not in cls.encryption_parameters.items()
        }
        encryption = all(
            item in url.query.items() for item in cls.encryption_parameters.items()
        )
        return {
            "access_token": url.password,
            "host": url.host,
            "port": url.port,
            "http_path_field": query["http_path"],
            "default_catalog": query["catalog"],
            "default_schema": query["schema"],
            "encryption": encryption,
        }

    @classmethod
    def get_default_catalog(
        cls,
        database: Database,
    ) -> str | None:
        return database.url_object.query.get("catalog")

    @classmethod
    def get_catalog_names(
        cls,
        database: Database,
        inspector: Inspector,
    ) -> set[str]:
        return {catalog for (catalog,) in inspector.bind.execute("SHOW CATALOGS")}

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: str | None = None,
        schema: str | None = None,
    ) -> tuple[URL, dict[str, Any]]:
        if catalog:
            uri = uri.update_query_dict({"catalog": catalog})

        if schema:
            uri = uri.update_query_dict({"schema": schema})

        return uri, connect_args
