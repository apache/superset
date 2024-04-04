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
from typing import Any, TypedDict, TYPE_CHECKING

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask_babel import gettext as __
from marshmallow import fields, Schema
from sqlalchemy import types
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL

from superset.config import VERSION_STRING
from superset.constants import TimeGrain, USER_AGENT, PASSWORD_MASK
from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import SupersetErrorType
from superset.errors import SupersetError

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from flask_babel import gettext as __, lazy_gettext as _
from marshmallow import fields, Schema
from marshmallow.validate import Range
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlalchemy import util
from superset.databases.utils import make_url_safe
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils.network import is_hostname_valid, is_port_open

if TYPE_CHECKING:
    # prevent circular imports
    from superset.models.core import Database


COLUMN_DOES_NOT_EXIST_REGEX = re.compile("no such column: (?P<column_name>.+)")


class MDURI(util.namedtuple(
        "MDURI",
        [
            "password",
            "database",
            "motherduck_token",
            "query",
        ],
    )):
    drivername = "duckdb"

    def __str__(self):
        query = ""
        if self.motherduck_token:
            query += f"?motherduck_token={self.motherduck_token}"
        else:
            query += "?"
        query += "&".join([f"{key}={value}" for key, value in self.query.items()])
        return f"{DuckDBEngineSpec.engine}:///{self.database}{query}"


    @classmethod
    def from_str(cls, name: str):
        pattern = re.compile(
            r"""
                (?P<driver_name>[\w\+]+):///
                (?:
                    (md:(?P<database>[^/\?]*))?
                )?
                (?:\?(?P<query>.*))?
                """,
            re.X,
        )
        m = pattern.match(name)
        if m is not None:
            components = m.groupdict()
            if components["query"] is not None:
                query = {}

                for key, value in util.parse_qsl(components["query"]):
                    if util.py2k:
                        key = key.encode("ascii")
                    if key in query:
                        query[key] = util.to_list(query[key])
                        query[key].append(value)
                    else:
                        query[key] = value
            else:
                query = None
            if query is not None:
                token = query.pop("motherduck_token")
            else:
                token = None

            components["query"] = query

            return cls(
                password=token,
                database=components.get("database"),
                motherduck_token=token,
                query=query
            )

    def strip(self):
        return self
    
    def set(
        self,
        password=None,
        database=None,
        query=None,
    ):
        """return a new :class:`_engine.URL` object with modifications.

        Values are used if they are non-None.  To set a value to ``None``
        explicitly, use the :meth:`MDURI._replace` method adapted
        from ``namedtuple``.

        :param password: new password
        :param database: new database
        :param query: new query parameters, passed a dict of string keys
         referring to string or sequence of string values.  Fully
         replaces the previous list of arguments.

        :return: new :class:`_engine.URL` object.

        .. versionadded:: 1.4

        .. seealso::

            :meth:`_engine.URL.update_query_dict`

        """

        kw = {}
        if password is not None:
            kw["password"] = password
        if database is not None:
            kw["database"] = database
        if query is not None:
            kw["query"] = query

        return self._replace(**kw)
    
    def get_backend_name(self):
        """Return the backend name.

        This is the name that corresponds to the database backend in
        use, and is the portion of the :attr:`_engine.URL.drivername`
        that is to the left of the plus sign.

        """
        return self.drivername

    def get_driver_name(self):
        """Return the backend name.

        This is the name that corresponds to the DBAPI driver in
        use, and is the portion of the :attr:`_engine.URL.drivername`
        that is to the right of the plus sign.

        If the :attr:`_engine.URL.drivername` does not include a plus sign,
        then the default :class:`_engine.Dialect` for this :class:`_engine.URL`
        is imported in order to get the driver name.

        """
        return self.drivername

# schema for adding a database by providing parameters instead of the
# full SQLAlchemy URI
class DuckDBParametersSchema(Schema):
    access_token = fields.String(allow_none=True, metadata={"description": __("MotherDuck token")})
    database = fields.String(
        required=True, metadata={"description": __("Database name")}
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

    # schema describing the parameters used to configure the DB
    parameters_schema = DuckDBParametersSchema()

    # recommended driver name for the DB engine spec
    default_driver = ""

    # query parameter to enable encryption in the database connection
    # for Postgres this would be `{"sslmode": "verify-ca"}`, eg.
    encryption_parameters: dict[str, str] = {}

    @classmethod
    def build_sqlalchemy_uri(  # pylint: disable=unused-argument
        cls,
        parameters: DuckDBParametersType,
        encrypted_extra: dict[str, str] | None = None,
    ) -> str:
        # make a copy so that we don't update the original
        query = parameters.get("query", {}).copy()
        token = parameters.get("access_token", "")
        database = parameters.get("database", "")

        if database or token:
            database = "md:" + database

        return MDURI(token, database, token, query)
    
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
        encryption = all(
            item in url.query.items() for item in cls.encryption_parameters.items()
        )
        return {
            "access_token": url.access_token,
            "database": url.database,
            "query": query,
        }

    @classmethod
    def validate_parameters(
        cls, properties: DuckDBPropertiesType
    ) -> list[SupersetError]:
        """
        Validates any number of parameters, for progressive validation.

        If only the hostname is present it will check if the name is resolvable. As more
        parameters are present in the request, more validation is done.
        """
        errors: list[SupersetError] = []

        required = {"access_token"}
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
    engine = "duckdb"
    engine_name = "MotherDuck"

    sqlalchemy_uri_placeholder = (
        "duckdb:///md:{database_name}?motherduck_token={SERVICE_TOKEN}"
    )
