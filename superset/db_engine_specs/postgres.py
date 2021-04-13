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
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Match,
    Optional,
    Pattern,
    Tuple,
    TYPE_CHECKING,
    Union,
)

from flask_babel import gettext as __
from pytz import _FixedOffset  # type: ignore
from sqlalchemy.dialects.postgresql import ARRAY, DOUBLE_PRECISION, ENUM, JSON
from sqlalchemy.dialects.postgresql.base import PGInspector
from sqlalchemy.types import String, TypeEngine

from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetException
from superset.utils import core as utils
from superset.utils.core import ColumnSpec, GenericDataType

if TYPE_CHECKING:
    from superset.models.core import Database  # pragma: no cover

logger = logging.getLogger()


# Replace psycopg2.tz.FixedOffsetTimezone with pytz, which is serializable by PyArrow
# https://github.com/stub42/pytz/blob/b70911542755aeeea7b5a9e066df5e1c87e8f2c8/src/pytz/reference.py#L25
class FixedOffsetTimezone(_FixedOffset):
    pass


# Regular expressions to catch custom errors
INVALID_USERNAME_REGEX = re.compile('role "(?P<username>.*?)" does not exist')
INVALID_PASSWORD_REGEX = re.compile(
    'password authentication failed for user "(?P<username>.*?)"'
)
INVALID_HOSTNAME_REGEX = re.compile(
    'could not translate host name "(?P<hostname>.*?)" to address: '
    "nodename nor servname provided, or not known"
)
CONNECTION_PORT_CLOSED_REGEX = re.compile(
    r"could not connect to server: Connection refused\s+Is the server "
    r'running on host "(?P<hostname>.*?)" (\(.*?\) )?and accepting\s+TCP/IP '
    r"connections on port (?P<port>.*?)\?"
)
CONNECTION_HOST_DOWN_REGEX = re.compile(
    r"could not connect to server: (?P<reason>.*?)\s+Is the server running on "
    r'host "(?P<hostname>.*?)" (\(.*?\) )?and accepting\s+TCP/IP '
    r"connections on port (?P<port>.*?)\?"
)


class PostgresBaseEngineSpec(BaseEngineSpec):
    """ Abstract class for Postgres 'like' databases """

    engine = ""
    engine_name = "PostgreSQL"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATE_TRUNC('second', {col})",
        "PT1M": "DATE_TRUNC('minute', {col})",
        "PT1H": "DATE_TRUNC('hour', {col})",
        "P1D": "DATE_TRUNC('day', {col})",
        "P1W": "DATE_TRUNC('week', {col})",
        "P1M": "DATE_TRUNC('month', {col})",
        "P0.25Y": "DATE_TRUNC('quarter', {col})",
        "P1Y": "DATE_TRUNC('year', {col})",
    }

    custom_errors = {
        INVALID_USERNAME_REGEX: (
            __('The username "%(username)s" does not exist.'),
            SupersetErrorType.TEST_CONNECTION_INVALID_USERNAME_ERROR,
        ),
        INVALID_PASSWORD_REGEX: (
            __('The password provided for username "%(username)s" is incorrect.'),
            SupersetErrorType.TEST_CONNECTION_INVALID_PASSWORD_ERROR,
        ),
        INVALID_HOSTNAME_REGEX: (
            __('The hostname "%(hostname)s" cannot be resolved.'),
            SupersetErrorType.TEST_CONNECTION_INVALID_HOSTNAME_ERROR,
        ),
        CONNECTION_PORT_CLOSED_REGEX: (
            __("Port %(port)s on hostname %(hostname)s refused the connection."),
            SupersetErrorType.TEST_CONNECTION_PORT_CLOSED_ERROR,
        ),
        CONNECTION_HOST_DOWN_REGEX: (
            __(
                "The host %(hostname)s might be down, and can't be "
                "reached on port %(port)s"
            ),
            SupersetErrorType.TEST_CONNECTION_HOST_DOWN_ERROR,
        ),
    }

    @classmethod
    def fetch_data(
        cls, cursor: Any, limit: Optional[int] = None
    ) -> List[Tuple[Any, ...]]:
        cursor.tzinfo_factory = FixedOffsetTimezone
        if not cursor.description:
            return []
        return super().fetch_data(cursor, limit)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "(timestamp 'epoch' + {col} * interval '1 second')"


class PostgresEngineSpec(PostgresBaseEngineSpec):
    engine = "postgresql"
    engine_aliases = ("postgres",)
    max_column_name_length = 63
    try_remove_schema_from_table_name = False

    column_type_mappings = (
        (
            re.compile(r"^double precision", re.IGNORECASE),
            DOUBLE_PRECISION(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^array.*", re.IGNORECASE),
            lambda match: ARRAY(int(match[2])) if match[2] else String(),
            utils.GenericDataType.STRING,
        ),
        (re.compile(r"^json.*", re.IGNORECASE), JSON(), utils.GenericDataType.STRING,),
        (re.compile(r"^enum.*", re.IGNORECASE), ENUM(), utils.GenericDataType.STRING,),
    )

    @classmethod
    def get_allow_cost_estimate(cls, extra: Dict[str, Any]) -> bool:
        return True

    @classmethod
    def estimate_statement_cost(cls, statement: str, cursor: Any) -> Dict[str, Any]:
        sql = f"EXPLAIN {statement}"
        cursor.execute(sql)

        result = cursor.fetchone()[0]
        match = re.search(r"cost=([\d\.]+)\.\.([\d\.]+)", result)
        if match:
            return {
                "Start-up cost": float(match.group(1)),
                "Total cost": float(match.group(2)),
            }

        return {}

    @classmethod
    def query_cost_formatter(
        cls, raw_cost: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        return [{k: str(v) for k, v in row.items()} for row in raw_cost]

    @classmethod
    def get_table_names(
        cls, database: "Database", inspector: PGInspector, schema: Optional[str]
    ) -> List[str]:
        """Need to consider foreign tables for PostgreSQL"""
        tables = inspector.get_table_names(schema)
        tables.extend(inspector.get_foreign_table_names(schema))
        return sorted(tables)

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"TO_DATE('{dttm.date().isoformat()}', 'YYYY-MM-DD')"
        if "TIMESTAMP" in tt or "DATETIME" in tt:
            dttm_formatted = dttm.isoformat(sep=" ", timespec="microseconds")
            return f"""TO_TIMESTAMP('{dttm_formatted}', 'YYYY-MM-DD HH24:MI:SS.US')"""
        return None

    @staticmethod
    def get_extra_params(database: "Database") -> Dict[str, Any]:
        """
        For Postgres, the path to a SSL certificate is placed in `connect_args`.

        :param database: database instance from which to extract extras
        :raises CertificateException: If certificate is not valid/unparseable
        :raises SupersetException: If database extra json payload is unparseable
        """
        try:
            extra = json.loads(database.extra or "{}")
        except json.JSONDecodeError:
            raise SupersetException("Unable to parse database extras")

        if database.server_cert:
            engine_params = extra.get("engine_params", {})
            connect_args = engine_params.get("connect_args", {})
            connect_args["sslmode"] = connect_args.get("sslmode", "verify-full")
            path = utils.create_ssl_cert_file(database.server_cert)
            connect_args["sslrootcert"] = path
            engine_params["connect_args"] = connect_args
            extra["engine_params"] = engine_params
        return extra

    @classmethod
    def get_column_spec(  # type: ignore
        cls,
        native_type: Optional[str],
        source: utils.ColumnTypeSource = utils.ColumnTypeSource.GET_TABLE,
        column_type_mappings: Tuple[
            Tuple[
                Pattern[str],
                Union[TypeEngine, Callable[[Match[str]], TypeEngine]],
                GenericDataType,
            ],
            ...,
        ] = column_type_mappings,
    ) -> Union[ColumnSpec, None]:

        column_spec = super().get_column_spec(native_type)
        if column_spec:
            return column_spec

        return super().get_column_spec(
            native_type, column_type_mappings=column_type_mappings
        )
