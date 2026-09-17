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
from typing import Any, cast, TYPE_CHECKING

from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.validate import Range
from sqlalchemy import types
from sqlalchemy.engine.url import URL
from urllib3.exceptions import NewConnectionError

from superset.constants import TimeGrain
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersMixin,
    BasicParametersType,
    BasicPropertiesType,
)
from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils.core import GenericDataType
from superset.utils.hashing import md5_sha_from_str
from superset.utils.network import is_hostname_valid, is_port_open

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)


class DatabendBaseEngineSpec(BaseEngineSpec):
    """Shared engine spec for Databend."""

    time_secondary_columns = True
    time_groupby_inline = True

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC('SECOND', {col})",
        TimeGrain.MINUTE: "to_start_of_minute(TO_DATETIME({col}))",
        TimeGrain.FIVE_MINUTES: "to_start_of_five_minutes(TO_DATETIME({col}))",
        TimeGrain.TEN_MINUTES: "to_start_of_ten_minutes(TO_DATETIME({col}))",
        TimeGrain.FIFTEEN_MINUTES: "to_start_of_fifteen_minutes(TO_DATETIME({col}))",
        TimeGrain.HOUR: "to_start_of_hour(TO_DATETIME({col}))",
        TimeGrain.DAY: "to_start_of_day(TO_DATETIME({col}))",
        TimeGrain.WEEK: "to_monday(TO_DATETIME({col}))",
        TimeGrain.MONTH: "to_start_of_month(TO_DATETIME({col}))",
        TimeGrain.QUARTER: "to_start_of_quarter(TO_DATETIME({col}))",
        TimeGrain.YEAR: "to_start_of_year(TO_DATETIME({col}))",
    }

    column_type_mappings = (
        (
            re.compile(r".*Varchar.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*Array.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*Map.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*Json.*", re.IGNORECASE),
            types.JSON(),
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
            re.compile(r".*Float\d+.*", re.IGNORECASE),
            types.FLOAT(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r".*Double\d+.*", re.IGNORECASE),
            types.FLOAT(),
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
    def epoch_to_dttm(cls) -> str:
        return "{col}"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"to_date('{dttm.date().isoformat()}')"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""TO_TIMESTAMP('{dttm.isoformat(timespec="microseconds")}')"""
        if isinstance(sqla_type, types.DateTime):
            return f"""to_dateTime('{dttm.isoformat(sep=" ", timespec="seconds")}')"""
        return None


class DatabendEngineSpec(DatabendBaseEngineSpec):
    """Engine spec for databend_sqlalchemy connector"""

    engine = "databend"
    engine_name = "Databend"
    _function_names: list[str] = []

    _show_functions_column = "name"
    supports_file_upload = False

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
    def get_function_names(cls, database: Database) -> list[str]:
        if cls._function_names:
            return cls._function_names
        try:
            names = database.get_df("SELECT name FROM system.functions;")[
                "name"
            ].tolist()
            cls._function_names = names
            return names
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Error retrieving system.functions: %s", str(ex))
            return []


class DatabendParametersSchema(Schema):
    username = fields.String(allow_none=True, description=__("Username"))
    password = fields.String(allow_none=True, description=__("Password"))
    host = fields.String(required=True, description=__("Hostname or IP address"))
    port = fields.Integer(
        allow_none=True,
        description=__("Database port"),
        validate=Range(min=0, max=65535),
    )
    database = fields.String(allow_none=True, description=__("Database name"))
    encryption = fields.Boolean(
        default=True, description=__("Use an encrypted connection to the database")
    )
    query = fields.Dict(
        keys=fields.Str(), values=fields.Raw(), description=__("Additional parameters")
    )


class DatabendConnectEngineSpec(BasicParametersMixin, DatabendEngineSpec):
    """Engine spec for databend sqlalchemy connector"""

    engine = "databend"
    engine_name = "Databend"

    default_driver = "databend"
    _function_names: list[str] = []

    sqlalchemy_uri_placeholder = (
        "databend://user:password@host[:port][/dbname][?secure=value&=value...]"
    )
    parameters_schema = DatabendParametersSchema()
    encryption_parameters = {"secure": "true"}

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
        if cls._function_names:
            return cls._function_names
        try:
            names = database.get_df("SELECT name FROM system.functions;")[
                "name"
            ].tolist()
            cls._function_names = names
            return names
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Error retrieving system.functions: %s", str(ex))
            return []

    @classmethod
    def get_datatype(cls, type_code: str) -> str:
        return type_code

    @classmethod
    def build_sqlalchemy_uri(
        cls, parameters: BasicParametersType, *_args: dict[str, str] | None
    ) -> str:
        url_params = parameters.copy()
        if url_params.get("encryption"):
            query = parameters.get("query", {}).copy()
            query.update(cls.encryption_parameters)
            url_params["query"] = query
        if not url_params.get("database"):
            url_params["database"] = "__default__"
        url_params.pop("encryption", None)
        return str(URL(f"{cls.engine}", **url_params))

    @classmethod
    def get_parameters_from_uri(
        cls, uri: str, *_args: dict[str, Any] | None
    ) -> BasicParametersType:
        url = make_url_safe(uri)
        query = url.query
        if "secure" in query:
            encryption = url.query.get("secure") == "true"
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
    def default_port(cls, interface: str, secure: bool) -> int:
        if interface.startswith("http"):
            return 443 if secure else 8000
        raise ValueError("Unrecognized Databend interface")

    @classmethod
    def validate_parameters(
        cls, properties: BasicPropertiesType
    ) -> list[SupersetError]:
        # The newest versions of superset send a "properties" object with a
        # parameters key, instead of just the parameters, so we hack to be compatible
        parameters = properties.get("parameters", properties)
        host = parameters.get("host", None)
        host = str(host) if host is not None else None
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
        if port is not None:
            if isinstance(port, (int, str)):
                try:
                    port = int(port)
                    if port <= 0 or port >= 65535:
                        port = -1
                except (ValueError, TypeError):
                    port = -1
        encryption = parameters.get("encryption", False)
        if port is None or port == -1:
            encryption = bool(encryption)
            port = cls.default_port("http", encryption)
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

    @staticmethod
    def _mutate_label(label: str) -> str:
        """
        Suffix with the first six characters from the md5 of the label to avoid
        collisions with original column names

        :param label: Expected expression label
        :return: Conditionally mutated label
        """
        return f"{label}_{md5_sha_from_str(label)[:6]}"
