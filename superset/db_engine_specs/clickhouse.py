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
import uuid
from datetime import datetime, timezone
from typing import Any, cast, TYPE_CHECKING
from urllib import parse

from flask import current_app as app, has_app_context
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.validate import Range
from sqlalchemy import func, types
from sqlalchemy.engine.url import URL
from sqlalchemy.sql.expression import ColumnElement
from urllib3.exceptions import NewConnectionError

from superset.constants import QUERY_CANCEL_KEY
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersMixin,
    BasicParametersType,
    BasicPropertiesType,
    DatabaseCategory,
)
from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.extensions import cache_manager
from superset.utils.core import GenericDataType
from superset.utils.network import is_hostname_valid, is_port_open

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.models.sql_lab import Query

logger = logging.getLogger(__name__)


class ClickHouseBaseEngineSpec(BaseEngineSpec):
    """Shared engine spec for ClickHouse."""

    time_groupby_inline = True
    # ClickHouse resolves an identifier to a SELECT alias first, in every clause:
    # with `toStartOfDay(toDateTime(ts)) AS ts`, `GROUP BY toStartOfDay(...(ts))`
    # re-truncates the alias and `WHERE ts >= ...` filters on the bucket.
    select_alias_shadows_source_column = True
    supports_multivalues_insert = True
    supports_multivalue_columns = True

    # ClickHouse doesn't support IS true/false syntax, use = true/false instead
    use_equality_for_boolean_filters = True

    # ClickHouse enforces max_rows_to_read against a pre-execution estimate
    # that ignores LIMIT, so bounded sampling queries on large tables are
    # rejected with TOO_MANY_ROWS before reading begins. Break mode keeps the
    # operator's row cap as the read bound and returns the partial result
    # instead of erroring. The clause is applied on its own line because the
    # retry operates on the final statement text, which SQL mutators may have
    # terminated with a single-line comment.
    sampling_read_limit_override_suffix = "\nSETTINGS read_overflow_mode='break'"

    @classmethod
    def apply_sampling_read_limit_override(cls, sql: str) -> str | None:
        """Append a read-overflow override so bounded sampling SQL succeeds.

        Returns ``None`` when no retry should be attempted: the SQL already
        carries the override, or it contains a SETTINGS clause from another
        source (ClickHouse permits only one per statement, so appending a
        second would produce invalid SQL — including subquery SETTINGS in
        this check merely degrades to the engine's normal rejection). The
        guard matches the clause shape ``SETTINGS <key> = ...`` rather than
        the bare token, and string literals, quoted identifiers, and comments
        are blanked out before matching, so a column named ``settings`` or a
        literal/comment merely containing that text does not suppress the
        retry. A trailing statement terminator is stripped so the SETTINGS
        clause attaches to the statement itself.
        """
        code_only = re.sub(
            r"'(?:[^']|'')*'"  # single-quoted string literals ('' escape)
            r'|"(?:[^"]|"")*"'  # double-quoted identifiers
            r"|`[^`]*`"  # backtick-quoted identifiers
            r"|--[^\n]*"  # single-line comments
            r"|/\*.*?\*/",  # block comments
            " ",
            sql,
            flags=re.DOTALL,
        )
        if re.search(r"\bSETTINGS\s+\w+\s*=", code_only, re.IGNORECASE):
            return None
        stripped = sql.rstrip().rstrip(";").rstrip()
        return f"{stripped}{cls.sampling_read_limit_override_suffix}"

    @classmethod
    def is_read_limit_error(cls, ex: Exception) -> bool:
        """Recognize ClickHouse's max_rows_to_read rejection (TOO_MANY_ROWS).

        Anchored to the error-code tokens ClickHouse emits ("Code: 158" /
        "TOO_MANY_ROWS") rather than the setting name, so unrelated errors
        that merely mention the setting are not misclassified.
        """
        message = str(ex)
        return "TOO_MANY_ROWS" in message or "Code: 158" in message

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "toStartOfSecond(toDateTime64({col}, 3))",
        "PT1M": "toStartOfMinute(toDateTime({col}))",
        "PT5M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 300)*300)",
        "PT10M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 600)*600)",
        "PT15M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 900)*900)",
        "PT30M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 1800)*1800)",
        "PT1H": "toStartOfHour(toDateTime({col}))",
        "P1D": "toStartOfDay(toDateTime({col}))",
        "P1W": "toMonday(toDateTime({col}))",
        "P1M": "toStartOfMonth(toDateTime({col}))",
        "P3M": "toStartOfQuarter(toDateTime({col}))",
        "P1Y": "toStartOfYear(toDateTime({col}))",
    }

    column_type_mappings = (
        (
            # Anchor to the start so only top-level arrays match. This must be
            # ordered before the ``Enum`` entry below: ``Array(Enum8(...))`` is a
            # real array and should classify as MULTI_VALUE, not STRING. The
            # anchor also prevents over-matching nested arrays such as
            # ``Map(String, Array(String))`` or ``Tuple(Array(String))``, which
            # are not themselves array columns and must keep their own type.
            re.compile(r"^Array\(", re.IGNORECASE),
            types.String(),
            GenericDataType.MULTI_VALUE,
        ),
        (
            re.compile(r".*Enum.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*UUID.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*Bool.*", re.IGNORECASE),
            types.Boolean(),
            GenericDataType.BOOLEAN,
        ),
        (
            re.compile(r".*String.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*Int\d+.*", re.IGNORECASE),
            types.INTEGER(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r".*Decimal.*", re.IGNORECASE),
            types.DECIMAL(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r".*DateTime.*", re.IGNORECASE),
            types.DateTime(),
            GenericDataType.TEMPORAL,
        ),
        (
            re.compile(r".*Date.*", re.IGNORECASE),
            types.Date(),
            GenericDataType.TEMPORAL,
        ),
    )

    @classmethod
    def array_contains_any(cls, col: ColumnElement, values: list[Any]) -> ColumnElement:
        # ClickHouse: hasAny(arr, [v1, v2]) -> 1 if arr shares any element.
        # func.array(*values) renders as array(v1, v2) == [v1, v2].
        return func.hasAny(col, func.array(*values))

    @classmethod
    def array_contains_all(cls, col: ColumnElement, values: list[Any]) -> ColumnElement:
        # ClickHouse: hasAll(arr, [v1, v2]) -> 1 if arr contains all elements.
        return func.hasAll(col, func.array(*values))

    @classmethod
    def array_length(cls, col: ColumnElement) -> ColumnElement:
        # ClickHouse: length(arr) -> number of elements
        return func.length(col)

    @classmethod
    def array_literal(cls, values: list[Any]) -> ColumnElement:
        # ClickHouse: array(v1, v2) is equivalent to the literal [v1, v2].
        return func.array(*values)

    @classmethod
    def array_explode(cls, col: ColumnElement) -> ColumnElement:
        # ClickHouse: arrayJoin(arr) yields one row per element, so
        # SELECT DISTINCT arrayJoin(arr) returns the distinct elements.
        return func.arrayJoin(col)

    # Matches the element type inside a top-level ``Array(...)`` column, e.g.
    # ``Array(Int32)`` -> ``Int32``, ``Array(Nullable(String))`` -> ``String``.
    _ARRAY_ELEMENT_RE = re.compile(r"^Array\((?P<inner>.+)\)$", re.IGNORECASE)
    # Element-type wrappers that don't change the underlying generic type.
    _ELEMENT_WRAPPER_RE = re.compile(
        r"^(?:Nullable|LowCardinality)\((?P<inner>.+)\)$", re.IGNORECASE
    )

    @classmethod
    def get_array_element_type(cls, native_type: str | None) -> GenericDataType | None:
        if not native_type:
            return None
        match = cls._ARRAY_ELEMENT_RE.match(native_type.strip())
        if not match:
            return None
        inner = match.group("inner").strip()
        # Peel wrappers (Nullable/LowCardinality) that don't alter the generic
        # type so the inner scalar type drives classification.
        while wrapper := cls._ELEMENT_WRAPPER_RE.match(inner):
            inner = wrapper.group("inner").strip()
        spec = cls.get_column_spec(inner)
        return spec.generic_type if spec else None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "{col}"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"toDate('{dttm.date().isoformat()}')"
        if isinstance(sqla_type, types.DateTime):
            if dttm.tzinfo is not None and dttm.utcoffset() is not None:
                dttm = dttm.astimezone(timezone.utc).replace(tzinfo=None)
            formatted_dttm: str = dttm.isoformat(sep=" ", timespec="seconds")
            return f"toDateTime('{formatted_dttm}', 'UTC')"
        return None


class ClickHouseEngineSpec(ClickHouseBaseEngineSpec):
    """Engine spec for clickhouse_sqlalchemy connector (legacy)"""

    engine = "clickhouse"
    engine_name = "ClickHouse (sqlalchemy)"  # Internal name for legacy connector

    _show_functions_column = "name"
    supports_file_upload = False

    metadata = {
        "description": (
            "ClickHouse is an open-source column-oriented database for real-time "
            "analytics using SQL (legacy clickhouse-sqlalchemy driver)."
        ),
        "logo": "clickhouse.png",
        "homepage_url": "https://clickhouse.com/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["clickhouse-sqlalchemy"],
        "connection_string": "clickhouse://{username}:{password}@{host}:{port}/{database}",
        "default_port": 8123,
    }

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        return {NewConnectionError: SupersetDBAPIDatabaseError}

    @classmethod
    def get_dbapi_mapped_exception(cls, exception: Exception) -> Exception:
        new_exception = cls.get_dbapi_exception_mapping().get(type(exception))
        if new_exception == SupersetDBAPIDatabaseError:
            return SupersetDBAPIDatabaseError("Connection failed")
        if not new_exception:
            return exception
        return new_exception(str(exception))

    @classmethod
    @cache_manager.cache.memoize()
    def get_function_names(cls, database: Database) -> list[str]:
        """
        Get a list of function names that are able to be called on the database.
        Used for SQL Lab autocomplete.

        :param database: The database to get functions for
        :return: A list of function names usable in the database
        """
        system_functions_sql = "SELECT name FROM system.functions"
        try:
            df = database.get_df(system_functions_sql)
            if cls._show_functions_column in df:
                return df[cls._show_functions_column].tolist()
            columns = df.columns.values.tolist()
            logger.error(
                "Payload from `%s` has the incorrect format. "
                "Expected column `%s`, found: %s.",
                system_functions_sql,
                cls._show_functions_column,
                ", ".join(columns),
                exc_info=True,
            )
            # if the results have a single column, use that
            if len(columns) == 1:
                return df[columns[0]].tolist()
        except Exception as ex:  # pylint: disable=broad-except
            logger.error(
                "Query `%s` fire error %s. ",
                system_functions_sql,
                str(ex),
                exc_info=True,
            )
            return []

        # otherwise, return no function names to prevent errors
        return []


class ClickHouseParametersSchema(Schema):
    username = fields.String(allow_none=True, metadata={"description": __("Username")})
    password = fields.String(allow_none=True, metadata={"description": __("Password")})
    host = fields.String(
        required=True, metadata={"description": __("Hostname or IP address")}
    )
    port = fields.Integer(
        allow_none=True,
        metadata={"description": __("Database port")},
        validate=Range(min=0, max=65535),
    )
    database = fields.String(
        allow_none=True, metadata={"description": __("Database name")}
    )
    encryption = fields.Boolean(
        dump_default=True,
        metadata={"description": __("Use an encrypted connection to the database")},
    )
    query = fields.Dict(
        keys=fields.Str(),
        values=fields.Raw(),
        metadata={"description": __("Additional parameters")},
    )
    ssh = fields.Boolean(
        required=False,
        metadata={"description": __("Use an ssh tunnel connection to the database")},
    )


try:
    from clickhouse_connect.common import set_setting
    from clickhouse_connect.datatypes.format import set_default_formats

    # override default formats for compatibility
    set_default_formats(
        "FixedString",
        "string",
        "IPv*",
        "string",
        "UInt64",
        "signed",
        "UUID",
        "string",
        "*Int256",
        "string",
        "*Int128",
        "string",
    )
    # Importing this module happens as a side effect of iterating db_engine_specs
    # (e.g. from a standalone script or test that never builds a Flask app), so
    # `current_app` may not be bound to an app context yet -- guard the version
    # lookup rather than let that crash the import outright.
    version_string = (
        app.config.get("VERSION_STRING", "dev") if has_app_context() else "dev"
    )
    set_setting(
        "product_name",
        f"superset/{version_string}",
    )
except ImportError:  # ClickHouse Connect not installed, do nothing
    pass


class ClickHouseConnectEngineSpec(BasicParametersMixin, ClickHouseEngineSpec):
    """Engine spec for clickhouse-connect connector (recommended)"""

    engine = "clickhousedb"
    engine_name = "ClickHouse"

    default_driver = "connect"
    _function_names: list[str] = []

    sqlalchemy_uri_placeholder = (
        "clickhousedb://user:password@host[:port][/dbname][?secure=value&=value...]"
    )
    parameters_schema = ClickHouseParametersSchema()
    encryption_parameters = {"secure": "true"}

    supports_dynamic_schema = True

    metadata = {
        "description": (
            "ClickHouse is an open-source column-oriented database for real-time "
            "analytics using SQL. It's known for extremely fast query performance "
            "on large datasets."
        ),
        "logo": "clickhouse.png",
        "homepage_url": "https://clickhouse.com/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["clickhouse-connect>=0.13.0"],
        "connection_string": "clickhousedb://{username}:{password}@{host}:{port}/{database}",
        "default_port": 8123,
        "drivers": [
            {
                "name": "clickhouse-connect (Recommended)",
                "pypi_package": "clickhouse-connect>=0.13.0",
                "connection_string": (
                    "clickhousedb://{username}:{password}@{host}:{port}/{database}"
                ),
                "is_recommended": True,
                "notes": (
                    "Official ClickHouse Python driver with native protocol support."
                ),
            },
            {
                "name": "clickhouse-sqlalchemy (Legacy)",
                "pypi_package": "clickhouse-sqlalchemy",
                "connection_string": (
                    "clickhouse://{username}:{password}@{host}:{port}/{database}"
                ),
                "is_recommended": False,
                "notes": (
                    "Older driver using HTTP interface. Use clickhouse-connect "
                    "for new deployments."
                ),
            },
        ],
        "connection_examples": [
            {
                "description": "Altinity Cloud",
                "connection_string": (
                    "clickhousedb://demo:demo@github.demo.trial.altinity.cloud"
                    "/default?secure=true"
                ),
            },
            {
                "description": "Local (no auth, no SSL)",
                "connection_string": "clickhousedb://localhost/default",
            },
        ],
        "install_instructions": (
            'echo "clickhouse-connect>=0.13.0" >> ./docker/requirements-local.txt'
        ),
        "compatible_databases": [
            {
                "name": "ClickHouse Cloud",
                "description": (
                    "ClickHouse Cloud is the official fully-managed cloud service "
                    "for ClickHouse. It provides automatic scaling, built-in "
                    "backups, and enterprise security features."
                ),
                "logo": "clickhouse.png",
                "homepage_url": "https://clickhouse.cloud/",
                "categories": [
                    DatabaseCategory.ANALYTICAL_DATABASES,
                    DatabaseCategory.CLOUD_DATA_WAREHOUSES,
                    DatabaseCategory.HOSTED_OPEN_SOURCE,
                ],
                "pypi_packages": ["clickhouse-connect>=0.13.0"],
                "connection_string": (
                    "clickhousedb://{username}:{password}@{host}:8443/{database}?secure=true"
                ),
                "parameters": {
                    "username": "ClickHouse Cloud username",
                    "password": "ClickHouse Cloud password",
                    "host": "Your ClickHouse Cloud hostname",
                    "database": "Database name (default)",
                },
                "docs_url": "https://clickhouse.com/docs/en/cloud",
            },
            {
                "name": "Altinity.Cloud",
                "description": (
                    "Altinity.Cloud is a managed ClickHouse service providing "
                    "Kubernetes-native deployments with enterprise support."
                ),
                "logo": "altinity.png",
                "homepage_url": "https://altinity.cloud/",
                "categories": [
                    DatabaseCategory.ANALYTICAL_DATABASES,
                    DatabaseCategory.CLOUD_DATA_WAREHOUSES,
                    DatabaseCategory.HOSTED_OPEN_SOURCE,
                ],
                "pypi_packages": ["clickhouse-connect>=0.13.0"],
                "connection_string": (
                    "clickhousedb://{username}:{password}@{host}/{database}?secure=true"
                ),
                "docs_url": "https://docs.altinity.com/",
            },
        ],
    }

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        return {}

    @classmethod
    def get_dbapi_mapped_exception(cls, exception: Exception) -> Exception:
        new_exception = cls.get_dbapi_exception_mapping().get(type(exception))
        if new_exception == SupersetDBAPIDatabaseError:
            return SupersetDBAPIDatabaseError("Connection failed")
        if not new_exception:
            return exception
        return new_exception(str(exception))

    @classmethod
    def get_function_names(cls, database: Database) -> list[str]:
        # pylint: disable=import-outside-toplevel, import-error
        from clickhouse_connect.driver.exceptions import ClickHouseError

        if cls._function_names:
            return cls._function_names
        try:
            names = database.get_df(
                "SELECT name FROM system.functions UNION ALL "  # noqa: S608
                + "SELECT name FROM system.table_functions LIMIT 10000"
            )["name"].tolist()
            cls._function_names = names
            return names
        except ClickHouseError:
            logger.exception("Error retrieving system.functions")
            return []

    @classmethod
    def get_datatype(cls, type_code: str) -> str:
        # keep it lowercase, as ClickHouse types aren't typical SHOUTCASE ANSI SQL
        return type_code

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: BasicParametersType,
        encrypted_extra: dict[str, str] | None = None,
    ) -> str:
        url_params = parameters.copy()
        if url_params.get("encryption"):
            query = parameters.get("query", {}).copy()
            query.update(cls.encryption_parameters)
            url_params["query"] = query
        if not url_params.get("database"):
            url_params["database"] = "__default__"

        # SQLAlchemy 2.0 made URL.__str__() hide the password by default
        # (it rendered in full under 1.4); render_as_string(hide_password=
        # False) is required here since this URI is stored/used to actually
        # connect, not just displayed.
        return URL.create(
            f"{cls.engine}+{cls.default_driver}",
            username=url_params.get("username"),
            password=url_params.get("password"),
            host=url_params.get("host"),
            port=url_params.get("port"),
            database=url_params.get("database"),
            query=url_params.get("query"),
        ).render_as_string(hide_password=False)

    @classmethod
    def get_parameters_from_uri(
        cls, uri: str, encrypted_extra: dict[str, Any] | None = None
    ) -> BasicParametersType:
        url = make_url_safe(uri)
        query = dict(url.query)
        if "secure" in query:
            encryption = query.get("secure") == "true"
            query.pop("secure")
        else:
            encryption = False
        return BasicParametersType(
            username=url.username,
            password=url.password,
            host=url.host,
            port=url.port,
            database="" if url.database == "__default__" else cast(str, url.database),
            query=query,
            encryption=encryption,
        )

    @classmethod
    def validate_parameters(
        cls, properties: BasicPropertiesType
    ) -> list[SupersetError]:
        # pylint: disable=import-outside-toplevel, import-error
        from clickhouse_connect.driver import default_port

        parameters = properties.get("parameters", {})
        host = parameters.get("host", None)
        if not host:
            return [
                SupersetError(
                    "Hostname is required",
                    SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    ErrorLevel.WARNING,
                    {"missing": ["host"]},
                )
            ]
        if not is_hostname_valid(host):
            return [
                SupersetError(
                    "The hostname provided can't be resolved.",
                    SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
                    ErrorLevel.ERROR,
                    {"invalid": ["host"]},
                )
            ]
        port = parameters.get("port")
        if port is None:
            port = default_port("http", parameters.get("encryption", False))
        try:
            port = int(port)
        except (ValueError, TypeError):
            port = -1
        if port <= 0 or port >= 65535:
            return [
                SupersetError(
                    "Port must be a valid integer between 0 and 65535 (inclusive).",
                    SupersetErrorType.CONNECTION_INVALID_PORT_ERROR,
                    ErrorLevel.ERROR,
                    {"invalid": ["port"]},
                )
            ]
        if not is_port_open(host, port):
            return [
                SupersetError(
                    "The port is closed.",
                    SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
                    ErrorLevel.ERROR,
                    {"invalid": ["port"]},
                )
            ]
        return []

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: str | None = None,
        schema: str | None = None,
    ) -> tuple[URL, dict[str, Any]]:
        if schema:
            uri = uri.set(database=parse.quote(schema, safe=""))
        return uri, connect_args

    @classmethod
    def get_column_description_retry_sql(cls, sql: str) -> str | None:
        # clickhouse-connect's cursor only backfills `cursor.description` for
        # a zero-row result -- e.g. the `WHERE false` probe used to detect an
        # adhoc column's type without scanning any rows -- when the operation
        # string starts with SELECT/WITH after stripping whitespace. Leading
        # SQL comments inserted by SQL_QUERY_MUTATOR (e.g. query attribution)
        # defeat that check, so wrap the untouched, already-mutated SQL in a
        # bare outer SELECT to satisfy it without altering or dropping any of
        # the mutator's comments.
        return f"SELECT * FROM (\n{sql}\n) AS __superset_type_probe LIMIT 0"  # noqa: S608

    # ClickHouse never hands back a server-assigned identifier Superset could
    # read and reuse later -- but its HTTP interface accepts a client-chosen
    # `query_id`, and `KILL QUERY WHERE query_id = ...` accepts that same id
    # from a second, independent connection. Minting it here needs no round
    # trip: `has_query_id_before_execute` (the base default) runs this before
    # the statement is sent, so the id is threaded into `execute_with_cursor`
    # below in time to be passed to the driver.
    @classmethod
    def get_cancel_query_id(  # pylint: disable=unused-argument
        cls,
        cursor: Any,
        query: Query,
    ) -> str | None:
        return str(uuid.uuid4())

    @classmethod
    def execute_with_cursor(
        cls,
        cursor: Any,
        sql: str,
        query: Query,
    ) -> None:
        """
        Forward the id `get_cancel_query_id` recorded into `query.extra` on
        to `execute` as a `settings` kwarg -- the base `execute_with_cursor`/
        `execute` pair never threads per-query kwargs through to
        `cursor.execute()`, so cancellation needs this override to reach the
        driver at all.
        """
        logger.debug("Query %d: Running query: %s", query.id, sql)
        cancel_query_id = query.extra.get(QUERY_CANCEL_KEY)
        settings = {"query_id": cancel_query_id} if cancel_query_id else None
        cls.execute(cursor, sql, query.database, settings=settings)
        logger.debug("Query %d: Handling cursor", query.id)
        cls.handle_cursor(cursor, query)

    @classmethod
    def execute(  # pylint: disable=unused-argument
        cls,
        cursor: Any,
        query: str,
        database: Database,
        **kwargs: Any,
    ) -> None:
        if cls.arraysize:
            cursor.arraysize = cls.arraysize
        try:
            cursor.execute(query, settings=kwargs.get("settings"))
        except Exception as ex:
            raise cls.get_dbapi_mapped_exception(ex) from ex

    # ClickHouse's own enum for the `kill_status` column `KILL QUERY SYNC`
    # returns per matched process (https://clickhouse.com/docs/sql-reference/
    # statements/kill): "finished" is the only value confirming the query
    # was actually terminated. The other four are documented failure/
    # indeterminate states -- a real process matched, but termination wasn't
    # confirmed -- and must not be reported as a successful cancel.
    _KILL_STATUS_CONFIRMED = "finished"
    _KILL_STATUS_KNOWN_NOT_CONFIRMED = frozenset(
        {"waiting", "cant_cancel", "pending", "unknown_status"}
    )

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        :param cancel_query_id: client-chosen `query_id` minted by
            `get_cancel_query_id` and passed to the driver at execute time
        :return: True if query cancelled successfully, False otherwise
        """
        # UUID4-shaped: defense-in-depth against SQL injection, mirroring
        # every other engine's own id-shaped pattern for this check (e.g.
        # Postgres/MySQL's `^\\d+$` for their integer ids).
        if not cls.validate_cancel_query_id(
            cancel_query_id,
            r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
            r"[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        ):
            return False

        try:
            # SYNC blocks until ClickHouse confirms the outcome. The default
            # ASYNC mode returns immediately with kill_status="waiting" --
            # before termination is confirmed -- which would make this
            # method's return value meaningless.
            cursor.execute(  # noqa: S608
                f"KILL QUERY WHERE query_id = '{cancel_query_id}' SYNC"
            )
            rows = cursor.fetchall()
        except Exception:  # pylint: disable=broad-except
            return False

        kill_status = rows[0][0] if rows and rows[0] else None
        if kill_status == cls._KILL_STATUS_CONFIRMED:
            return True
        if kill_status in cls._KILL_STATUS_KNOWN_NOT_CONFIRMED:
            # A real process matched our query_id, but ClickHouse itself
            # couldn't confirm termination -- there's positive evidence the
            # query may still be running, so don't report success.
            return False

        # No recognizable kill_status landed in the first column. Verified
        # empirically against a real server, this covers two cases that
        # can't be told apart from this response alone:
        #   1. No process matched `query_id` at all -- most likely the query
        #      had already finished on its own between the stop request and
        #      this KILL QUERY reaching the server: ClickHouse returns a
        #      genuinely empty HTTP body for a non-matching `KILL QUERY`
        #      (0 result_rows per its own X-ClickHouse-Summary header). The
        #      desired end state -- query not running -- already holds.
        #   2. clickhouse-connect==1.9.0's DB-API cursor synthesizes a
        #      1-row "stats" result from that same X-ClickHouse-Summary
        #      header whenever the real HTTP body is empty, so `rows` is
        #      never actually `[]` here even when nothing matched; its
        #      first column is an int (a row count), never one of the
        #      known kill_status strings above.
        # Both report "nothing to confirm", not "confirmed failure" --
        # treating this as success avoids stranding the SQL Lab UI on a
        # query that has already finished on its own. See RCA.md for the
        # full reasoning and empirical verification.
        return True
