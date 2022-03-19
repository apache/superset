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
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from urllib import parse

import simplejson as json
from flask import current_app
from sqlalchemy.engine.url import make_url, URL

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)


class TrinoEngineSpec(BaseEngineSpec):
    engine = "trino"
    engine_aliases = {"trinonative"}
    engine_name = "Trino"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "date_trunc('second', CAST({col} AS TIMESTAMP))",
        "PT1M": "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        "PT1H": "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        "P1D": "date_trunc('day', CAST({col} AS TIMESTAMP))",
        "P1W": "date_trunc('week', CAST({col} AS TIMESTAMP))",
        "P1M": "date_trunc('month', CAST({col} AS TIMESTAMP))",
        "P3M": "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        "P1Y": "date_trunc('year', CAST({col} AS TIMESTAMP))",
        # "1969-12-28T00:00:00Z/P1W",  # Week starting Sunday
        # "1969-12-29T00:00:00Z/P1W",  # Week starting Monday
        # "P1W/1970-01-03T00:00:00Z",  # Week ending Saturday
        # "P1W/1970-01-04T00:00:00Z",  # Week ending Sunday
    }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Convert a Python `datetime` object to a SQL expression.

        :param target_type: The target type of expression
        :param dttm: The datetime object
        :param db_extra: The database extra object
        :return: The SQL expression

        Superset only defines time zone naive `datetime` objects, though this method
        handles both time zone naive and aware conversions.
        """
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"from_iso8601_date('{dttm.date().isoformat()}')"
        if tt in (
            utils.TemporalType.TIMESTAMP,
            utils.TemporalType.TIMESTAMP_WITH_TIME_ZONE,
        ):
            return f"""from_iso8601_timestamp('{dttm.isoformat(timespec="microseconds")}')"""  # pylint: disable=line-too-long,useless-suppression
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def adjust_database_uri(
        cls, uri: URL, selected_schema: Optional[str] = None
    ) -> None:
        database = uri.database
        if selected_schema and database:
            selected_schema = parse.quote(selected_schema, safe="")
            database = database.split("/")[0] + "/" + selected_schema
            uri.database = database

    @classmethod
    def update_impersonation_config(
        cls, connect_args: Dict[str, Any], uri: str, username: Optional[str],
    ) -> None:
        """
        Update a configuration dictionary
        that can set the correct properties for impersonating users
        :param connect_args: config to be updated
        :param uri: URI string
        :param username: Effective username
        :return: None
        """
        url = make_url(uri)
        backend_name = url.get_backend_name()

        # Must be Trino connection, enable impersonation, and set optional param
        # auth=LDAP|KERBEROS
        # Set principal_username=$effective_username
        if backend_name == "trino" and username is not None:
            connect_args["user"] = username

    @classmethod
    def modify_url_for_impersonation(
        cls, url: URL, impersonate_user: bool, username: Optional[str]
    ) -> None:
        """
        Modify the SQL Alchemy URL object with the user to impersonate if applicable.
        :param url: SQLAlchemy URL object
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        """
        # Do nothing and let update_impersonation_config take care of impersonation

    @classmethod
    def get_allow_cost_estimate(cls, extra: Dict[str, Any]) -> bool:
        return True

    @classmethod
    def estimate_statement_cost(cls, statement: str, cursor: Any) -> Dict[str, Any]:
        """
        Run a SQL query that estimates the cost of a given statement.

        :param statement: A single SQL statement
        :param cursor: Cursor instance
        :return: JSON response from Trino
        """
        sql = f"EXPLAIN (TYPE IO, FORMAT JSON) {statement}"
        cursor.execute(sql)

        # the output from Trino is a single column and a single row containing
        # JSON:
        #
        #   {
        #     ...
        #     "estimate" : {
        #       "outputRowCount" : 8.73265878E8,
        #       "outputSizeInBytes" : 3.41425774958E11,
        #       "cpuCost" : 3.41425774958E11,
        #       "maxMemory" : 0.0,
        #       "networkCost" : 3.41425774958E11
        #     }
        #   }
        result = json.loads(cursor.fetchone()[0])
        return result

    @classmethod
    def query_cost_formatter(
        cls, raw_cost: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """
        Format cost estimate.

        :param raw_cost: JSON estimate from Trino
        :return: Human readable cost estimate
        """

        def humanize(value: Any, suffix: str) -> str:
            try:
                value = int(value)
            except ValueError:
                return str(value)

            prefixes = ["K", "M", "G", "T", "P", "E", "Z", "Y"]
            prefix = ""
            to_next_prefix = 1000
            while value > to_next_prefix and prefixes:
                prefix = prefixes.pop(0)
                value //= to_next_prefix

            return f"{value} {prefix}{suffix}"

        cost = []
        columns = [
            ("outputRowCount", "Output count", " rows"),
            ("outputSizeInBytes", "Output size", "B"),
            ("cpuCost", "CPU cost", ""),
            ("maxMemory", "Max memory", "B"),
            ("networkCost", "Network cost", ""),
        ]
        for row in raw_cost:
            estimate: Dict[str, float] = row.get("estimate", {})
            statement_cost = {}
            for key, label, suffix in columns:
                if key in estimate:
                    statement_cost[label] = humanize(estimate[key], suffix).strip()
            cost.append(statement_cost)

        return cost

    @staticmethod
    def get_extra_params(database: "Database") -> Dict[str, Any]:
        """
        Some databases require adding elements to connection parameters,
        like passing certificates to `extra`. This can be done here.

        :param database: database instance from which to extract extras
        :raises CertificateException: If certificate is not valid/unparseable
        """
        extra: Dict[str, Any] = BaseEngineSpec.get_extra_params(database)
        engine_params: Dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: Dict[str, Any] = engine_params.setdefault("connect_args", {})

        if database.server_cert:
            connect_args["http_scheme"] = "https"
            connect_args["verify"] = utils.create_ssl_cert_file(database.server_cert)

        return extra

    @staticmethod
    def update_encrypted_extra_params(
        database: "Database", params: Dict[str, Any]
    ) -> None:
        if not database.encrypted_extra:
            return
        try:
            encrypted_extra = json.loads(database.encrypted_extra)
            auth_method = encrypted_extra.pop("auth_method", None)
            auth_params = encrypted_extra.pop("auth_params", {})
            if not auth_method:
                return

            connect_args = params.setdefault("connect_args", {})
            connect_args["http_scheme"] = "https"
            # pylint: disable=import-outside-toplevel
            if auth_method == "basic":
                from trino.auth import BasicAuthentication as trino_auth  # noqa
            elif auth_method == "kerberos":
                from trino.auth import KerberosAuthentication as trino_auth  # noqa
            elif auth_method == "jwt":
                from trino.auth import JWTAuthentication as trino_auth  # noqa
            else:
                allowed_extra_auths = current_app.config[
                    "ALLOWED_EXTRA_AUTHENTICATIONS"
                ].get("trino", {})
                if auth_method in allowed_extra_auths:
                    trino_auth = allowed_extra_auths.get(auth_method)
                else:
                    raise ValueError(
                        f"For security reason, custom authentication '{auth_method}' "
                        f"must be listed in 'ALLOWED_EXTRA_AUTHENTICATIONS' config"
                    )

            connect_args["auth"] = trino_auth(**auth_params)
        except json.JSONDecodeError as ex:
            logger.error(ex, exc_info=True)
            raise ex
