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
from typing import Any, Callable, cast, TYPE_CHECKING, TypedDict, Union

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask import g
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.validate import Range
from sqlalchemy import text, types
from sqlalchemy.engine.default import DefaultDialect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL

from superset.constants import TimeGrain
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersMixin,
    DatabaseCategory,
)
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2Error
from superset.utils import json
from superset.utils.core import get_user_agent, QuerySource
from superset.utils.network import is_hostname_valid, is_port_open

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.superset_typing import (
        OAuth2ClientConfig,
        OAuth2State,
        OAuth2TokenResponse,
    )


logger = logging.getLogger(__name__)

INSUFFICIENT_PERMISSIONS_REGEX: Pattern[str] = re.compile(
    r"\[INSUFFICIENT_PERMISSIONS\]|\bSQLSTATE:\s*42501\b"
)


try:
    from databricks.sql.utils import ParamEscaper
except ImportError:

    class ParamEscaper:  # type: ignore
        """Dummy class."""


class DatabricksStringType(types.TypeDecorator):
    impl = types.String
    cache_ok = True
    pe = ParamEscaper()

    def process_literal_param(self, value: Any, dialect: Any) -> str:
        return self.pe.escape_string(value)

    def literal_processor(self, dialect: Any) -> Callable[[Any], str]:
        def process(value: Any) -> str:
            _step1 = self.process_literal_param(value, dialect="databricks")
            if dialect.identifier_preparer._double_percents:
                _step2 = _step1.replace("%", "%%")
            else:
                _step2 = _step1

            return "%s" % _step2

        return process


def monkeypatch_dialect() -> None:
    """
    Monkeypatch dialect to correctly escape single quotes for Databricks.

    The Databricks SQLAlchemy dialect (<3.0) incorrectly escapes single quotes by
    doubling them ('O''Hara') instead of using backslash escaping ('O\'Hara'). The
    fixed version requires SQLAlchemy>=2.0, which is not yet compatible with Superset.

    Since the DatabricksDialect.colspecs points to the base class (HiveDialect.colspecs)
    we can't patch it without affecting other Hive-based dialects. The solution is to
    introduce a dialect-aware string type so that the change applies only to Databricks.
    """
    try:
        from pyhive.sqlalchemy_hive import HiveDialect

        class ContextAwareStringType(types.TypeDecorator):
            impl = types.String
            cache_ok = True

            def literal_processor(
                self, dialect: DefaultDialect
            ) -> Callable[[Any], str]:
                if dialect.__class__.__name__ == "DatabricksDialect":
                    return DatabricksStringType().literal_processor(dialect)
                return super().literal_processor(dialect)

        HiveDialect.colspecs[types.String] = ContextAwareStringType

    except ImportError:
        pass


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
    """Databricks engine spec using Hive connector for Interactive Clusters."""

    engine_name = "Databricks Interactive Cluster"

    engine = "databricks"
    drivers = {"pyhive": "Hive driver for Interactive Cluster"}
    default_driver = "pyhive"

    # Note: Primary metadata is in DatabricksPythonConnectorEngineSpec which
    # consolidates all Databricks connection methods. This spec exists for
    # backwards compatibility with Interactive Cluster connections.

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

    @classmethod
    def extract_errors(
        cls,
        ex: Exception,
        context: dict[str, Any] | None = None,
        database_name: str | None = None,
    ) -> list[SupersetError]:
        raw_message = cls._extract_error_message(ex)
        if INSUFFICIENT_PERMISSIONS_REGEX.search(raw_message):
            return [
                SupersetError(
                    error_type=SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
                    message=raw_message,
                    level=ErrorLevel.WARNING,
                    extra={"engine_name": cls.engine_name},
                )
            ]
        return super().extract_errors(ex, context, database_name)


class DatabricksODBCEngineSpec(DatabricksBaseEngineSpec):
    """Databricks engine spec using ODBC driver for SQL Endpoints."""

    engine_name = "Databricks SQL Endpoint"

    engine = "databricks"
    drivers = {"pyodbc": "ODBC driver for SQL endpoint"}
    default_driver = "pyodbc"

    # Note: Primary metadata is in DatabricksPythonConnectorEngineSpec which
    # consolidates all Databricks connection methods. This spec exists for
    # backwards compatibility with ODBC connections to SQL Endpoints.


class DatabricksDynamicBaseEngineSpec(BasicParametersMixin, DatabricksBaseEngineSpec):
    default_driver = ""
    encryption_parameters = {"ssl": "1"}
    required_parameters = {"access_token", "host", "port"}
    context_key_mapping = {
        "access_token": "password",
        "host": "hostname",
        "port": "port",
    }

    # The Databricks SQL driver has no dedicated authentication exception, so an
    # expired or missing token surfaces as a generic driver error. These case-
    # insensitive substrings flag the errors that should bootstrap a re-auth.
    oauth2_auth_failure_signals = (
        "http 401",
        "unauthorized",
        "unauthenticated",
        "invalid access token",
        "invalid token",
        "expired token",
        "token expired",
        # Raised by the databricks-sql-connector when no usable credentials are
        # present (e.g. an OAuth2 token that has been cleared/expired).
        "no valid authentication settings",
    )

    @classmethod
    def _workspace_oauth2_endpoint(cls, database: Database, path: str) -> str:
        """
        Build a Databricks OAuth2 (U2M) endpoint from the workspace host.

        Databricks fronts the user-to-machine OAuth2 flow on every workspace at
        ``https://<workspace-host>/oidc/v1/{authorize,token}`` across AWS, Azure
        and GCP, so the endpoints derive directly from the connection host and
        need no account or tenant identifier.
        """
        host = database.url_object.host
        if not host:
            raise OAuth2Error(
                "Databricks OAuth2 endpoint could not be resolved: the database "
                "connection has no host."
            )
        return f"https://{host}/oidc/v1/{path}"

    @classmethod
    def needs_oauth2(cls, ex: Exception) -> bool:
        """
        Identify driver errors that should trigger the OAuth2 dance.

        Unlike Trino (``TrinoAuthError``) or GSheets (``UnauthenticatedError``),
        the Databricks driver raises no dedicated auth exception, so in addition
        to the base ``isinstance`` check we match the auth signals above on the
        error message (mirrors ``GSheetsEngineSpec.needs_oauth2``).
        """
        if not (g and hasattr(g, "user")):
            return False
        if isinstance(ex, cls.oauth2_exception):
            return True
        message = str(ex).lower()
        return any(signal in message for signal in cls.oauth2_auth_failure_signals)

    @classmethod
    def get_oauth2_authorization_uri(
        cls,
        config: "OAuth2ClientConfig",
        state: "OAuth2State",
        code_verifier: str | None = None,
    ) -> str:
        """
        Return the URI for the initial OAuth2 request.

        A fully-resolved ``authorization_request_uri`` from
        ``DATABASE_OAUTH2_CLIENTS`` is preserved; otherwise the endpoint is
        derived from the workspace host (``https://<host>/oidc/v1/authorize``),
        which is valid on AWS, Azure and GCP.
        """
        if not config.get("authorization_request_uri"):
            from superset import db
            from superset.models.core import Database

            database_id = state["database_id"]
            if database := db.session.get(Database, database_id):
                config = cast(
                    "OAuth2ClientConfig",
                    dict(config)
                    | {
                        "authorization_request_uri": cls._workspace_oauth2_endpoint(
                            database, "authorize"
                        )
                    },
                )

        return super().get_oauth2_authorization_uri(config, state, code_verifier)

    @classmethod
    def get_oauth2_token(
        cls,
        config: "OAuth2ClientConfig",
        code: str,
        code_verifier: str | None = None,
    ) -> "OAuth2TokenResponse":
        """
        Exchange the authorization code for refresh/access tokens.

        Token exchange runs in a separate request with no database context, so
        the workspace host is not available to derive the endpoint here. Require
        a configured ``token_request_uri``
        (``https://<workspace-host>/oidc/v1/token``) and fail fast rather than
        POST to an unresolved endpoint.
        """
        if not config.get("token_request_uri"):
            raise OAuth2Error(
                "Databricks OAuth2 token endpoint is not configured: set "
                "`token_request_uri` to https://<workspace-host>/oidc/v1/token "
                "in DATABASE_OAUTH2_CLIENTS."
            )

        return super().get_oauth2_token(config, code, code_verifier)

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
        Update connection with the user's OAuth2 access token for impersonation.

        When impersonation is enabled but no user token is available yet (e.g. the
        first connection, before the OAuth2 dance has run), the stored credential
        is cleared rather than left in place. The driver then raises a "no valid
        authentication settings" error, which ``needs_oauth2`` catches to bootstrap
        the OAuth2 flow instead of silently connecting with a stale credential.
        """
        # Replace the credential in the URL with the user's OAuth2 token, falling
        # back to an empty string to force re-authentication when none is set.
        url = url.set(password=user_token or "")

        # The Python connector passes the token via ``connect_args`` instead of the
        # URL password, so keep it in sync (clearing it likewise forces re-auth).
        connect_args = engine_kwargs.setdefault("connect_args", {})
        if "access_token" in connect_args:
            connect_args["access_token"] = user_token or ""

        return url, engine_kwargs

    @staticmethod
    def update_params_from_encrypted_extra(
        database: Database, params: dict[str, Any]
    ) -> None:
        """
        Merge ``encrypted_extra`` into the connection params, dropping the
        ``oauth2_client_info`` block.

        ``oauth2_client_info`` holds the per-database OAuth2 client configuration
        consumed by ``Database.get_oauth2_config``; it is not a Databricks driver
        connection argument, so it must be stripped here to avoid poisoning the
        connection when OAuth2 is configured on the database itself.
        """
        if not database.encrypted_extra:
            return
        try:
            encrypted_extra = json.loads(database.encrypted_extra)
        except json.JSONDecodeError as ex:
            logger.error(ex, exc_info=True)
            raise
        encrypted_extra.pop("oauth2_client_info", None)
        params.update(encrypted_extra)

    @staticmethod
    def get_extra_params(
        database: Database, source: QuerySource | None = None
    ) -> dict[str, Any]:
        """
        Add a user agent to be used in the requests.
        Trim whitespace from connect_args to avoid databricks driver errors
        """
        extra: dict[str, Any] = BaseEngineSpec.get_extra_params(database, source)
        engine_params: dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: dict[str, Any] = engine_params.setdefault("connect_args", {})

        user_agent = get_user_agent(database, source)
        connect_args.setdefault("http_headers", [("User-Agent", user_agent)])
        connect_args.setdefault("_user_agent_entry", user_agent)

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
        cls,
        ex: Exception,
        context: dict[str, Any] | None = None,
        database_name: str | None = None,
    ) -> list[SupersetError]:
        context = context or {}

        # access_token isn't currently parseable from the
        # databricks error response, but adding it in here
        # for reference if their error message changes
        for key, value in cls.context_key_mapping.items():
            context[key] = context.get(value)

        return super().extract_errors(ex, context, database_name)

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
                    message=f"One or more parameters are missing: {', '.join(missing)}",
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
                        "The port must be an integer between 0 and 65535 (inclusive)."
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
    """Legacy Databricks connector using databricks-dbapi."""

    engine = "databricks"
    engine_name = "Databricks (legacy)"
    drivers = {"connector": "Native all-purpose driver"}
    default_driver = "connector"

    parameters_schema = DatabricksNativeSchema()
    properties_schema = DatabricksNativePropertiesSchema()

    sqlalchemy_uri_placeholder = (
        "databricks+connector://token:{access_token}@{host}:{port}/{database_name}"
    )

    # Note: Primary metadata is in DatabricksPythonConnectorEngineSpec which
    # consolidates all Databricks connection methods. This spec exists for
    # backwards compatibility with legacy databricks-dbapi connections.
    context_key_mapping = {
        **DatabricksDynamicBaseEngineSpec.context_key_mapping,
        "database": "database",
        "username": "username",
    }
    required_parameters = DatabricksDynamicBaseEngineSpec.required_parameters | {
        "database",
        "extra",
    }

    supports_dynamic_schema = True
    supports_catalog = True
    supports_dynamic_catalog = True
    supports_cross_catalog_queries = True

    # OAuth 2.0 support. The flow (endpoint resolution from the workspace host,
    # `needs_oauth2` detection) is shared via `DatabricksDynamicBaseEngineSpec`.
    supports_oauth2 = True
    oauth2_scope = "sql"

    # Authorization endpoint is derived from the workspace host at runtime; the
    # token endpoint must be configured (no DB context at exchange time).
    oauth2_authorization_request_uri = ""
    oauth2_token_request_uri = ""

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
    def get_default_catalog(cls, database: Database) -> str:
        """
        Return the default catalog.

        It's optionally specified in `connect_args.catalog`. If not:

        The default behavior for Databricks is confusing. When Unity Catalog is not
        enabled we have (the DB engine spec hasn't been tested with it enabled):

            > SHOW CATALOGS;
            spark_catalog
            > SELECT current_catalog();
            hive_metastore

        To handle permissions correctly we use the result of `SHOW CATALOGS` when a
        single catalog is returned.
        """
        connect_args = cls.get_extra_params(database)["engine_params"]["connect_args"]
        if default_catalog := connect_args.get("catalog"):
            return default_catalog

        with database.get_sqla_engine() as engine:
            with engine.connect() as conn:
                catalogs = {
                    catalog for (catalog,) in conn.execute(text("SHOW CATALOGS"))
                }
                if len(catalogs) == 1:
                    return catalogs.pop()

                return conn.execute(text("SELECT current_catalog()")).scalar()

    @classmethod
    def get_prequeries(
        cls,
        database: Database,
        catalog: str | None = None,
        schema: str | None = None,
    ) -> list[str]:
        prequeries = []
        if catalog:
            escaped_catalog = catalog.replace("`", "``")
            prequeries.append(f"USE CATALOG `{escaped_catalog}`")
        if schema:
            escaped_schema = schema.replace("`", "``")
            prequeries.append(f"USE SCHEMA `{escaped_schema}`")
        return prequeries

    @classmethod
    def get_catalog_names(
        cls,
        database: Database,
        inspector: Inspector,
    ) -> set[str]:
        with inspector.engine.connect() as conn:
            return {catalog for (catalog,) in conn.execute(text("SHOW CATALOGS"))}


class DatabricksPythonConnectorEngineSpec(DatabricksDynamicBaseEngineSpec):
    engine = "databricks"
    engine_name = "Databricks"
    default_driver = "databricks-sql-python"
    drivers = {"databricks-sql-python": "Databricks SQL Python"}

    parameters_schema = DatabricksPythonConnectorSchema()

    sqlalchemy_uri_placeholder = (
        "databricks://token:{access_token}@{host}:{port}?http_path={http_path}"
        "&catalog={default_catalog}&schema={default_schema}"
    )

    metadata = {
        "description": (
            "Databricks is a unified analytics platform built on Apache "
            "Spark, providing data engineering, data science, and machine "
            "learning capabilities in the cloud. Use the Python Connector "
            "for SQL warehouses and clusters."
        ),
        "logo": "databricks.png",
        "homepage_url": "https://www.databricks.com/",
        "categories": [
            DatabaseCategory.CLOUD_DATA_WAREHOUSES,
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.HOSTED_OPEN_SOURCE,
        ],
        "pypi_packages": ["apache-superset[databricks]"],
        "install_instructions": "pip install apache-superset[databricks]",
        "connection_string": (
            "databricks://token:{access_token}@{host}:{port}"
            "?http_path={http_path}&catalog={catalog}&schema={schema}"
        ),
        "parameters": {
            "access_token": "Personal access token from Settings > User Settings",
            "host": "Server hostname from cluster JDBC/ODBC settings",
            "port": "Port (default 443)",
            "http_path": "HTTP path from cluster JDBC/ODBC settings",
        },
        "drivers": [
            {
                "name": "Databricks Python Connector (Recommended)",
                "pypi_package": "databricks-sql-connector",
                "connection_string": (
                    "databricks://token:{access_token}@{host}:{port}"
                    "?http_path={http_path}&catalog={catalog}&schema={schema}"
                ),
                "is_recommended": True,
                "notes": (
                    "Official Databricks connector. Best for SQL warehouses "
                    "and clusters."
                ),
            },
            {
                "name": "Hive Connector (Interactive Clusters)",
                "pypi_package": "databricks-dbapi[sqlalchemy]",
                "connection_string": (
                    "databricks+pyhive://token:{access_token}@{host}:{port}/{database}"
                ),
                "is_recommended": False,
                "notes": (
                    "For Interactive Clusters. Requires http_path in engine parameters."
                ),
            },
            {
                "name": "ODBC (SQL Endpoints)",
                "pypi_package": "pyodbc",
                "connection_string": (
                    "databricks+pyodbc://token:{access_token}@{host}:{port}/{database}"
                ),
                "is_recommended": False,
                "notes": "Requires ODBC driver. For serverless SQL warehouses.",
            },
            {
                "name": "databricks-dbapi (Legacy)",
                "pypi_package": "databricks-dbapi[sqlalchemy]",
                "connection_string": (
                    "databricks+connector://token:{access_token}@{host}:{port}/{database}"
                ),
                "is_recommended": False,
                "notes": "Legacy connector. Use Python Connector for new deployments.",
            },
        ],
    }

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

    # OAuth 2.0 support. The flow (endpoint resolution from the workspace host,
    # `needs_oauth2` detection) is shared via `DatabricksDynamicBaseEngineSpec`.
    supports_oauth2 = True
    oauth2_scope = "sql"

    # Authorization endpoint is derived from the workspace host at runtime; the
    # token endpoint must be configured (no DB context at exchange time).
    oauth2_authorization_request_uri = ""
    oauth2_token_request_uri = ""

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
        with inspector.engine.connect() as conn:
            return {catalog for (catalog,) in conn.execute(text("SHOW CATALOGS"))}

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


# TODO: remove once we've upgraded to SQLAlchemy>=2.0 and databricks-sql-python>=3.x
monkeypatch_dialect()
