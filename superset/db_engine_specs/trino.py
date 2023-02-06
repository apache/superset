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
from typing import Any, Dict, Optional, Type, TYPE_CHECKING

import simplejson as json
from flask import current_app
from sqlalchemy.engine.url import URL
from sqlalchemy.orm import Session

from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY, USER_AGENT
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.exceptions import SupersetDBAPIConnectionError
from superset.db_engine_specs.presto import PrestoBaseEngineSpec
from superset.models.sql_lab import Query
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.models.core import Database

    try:
        from trino.dbapi import Cursor
    except ImportError:
        pass

logger = logging.getLogger(__name__)


class TrinoEngineSpec(PrestoBaseEngineSpec):
    engine = "trino"
    engine_name = "Trino"

    @classmethod
    def extra_table_metadata(
        cls,
        database: Database,
        table_name: str,
        schema_name: Optional[str],
    ) -> Dict[str, Any]:
        metadata = {}

        indexes = database.get_indexes(table_name, schema_name)
        if indexes:
            col_names, latest_parts = cls.latest_partition(
                table_name, schema_name, database, show_first=True
            )

            if not latest_parts:
                latest_parts = tuple([None] * len(col_names))

            metadata["partitions"] = {
                "cols": sorted(
                    list(
                        set(
                            column_name
                            for index in indexes
                            if index.get("name") == "partition"
                            for column_name in index.get("column_names", [])
                        )
                    )
                ),
                "latest": dict(zip(col_names, latest_parts)),
                "partitionQuery": cls._partition_query(
                    table_name=(
                        f"{schema_name}.{table_name}"
                        if schema_name and "." not in table_name
                        else table_name
                    ),
                    database=database,
                ),
            }

        if database.has_view_by_name(table_name, schema_name):
            metadata["view"] = database.inspector.get_view_definition(
                table_name, schema_name
            )

        return metadata

    @classmethod
    def update_impersonation_config(
        cls,
        connect_args: Dict[str, Any],
        uri: str,
        username: Optional[str],
    ) -> None:
        """
        Update a configuration dictionary
        that can set the correct properties for impersonating users
        :param connect_args: config to be updated
        :param uri: URI string
        :param username: Effective username
        :return: None
        """
        url = make_url_safe(uri)
        backend_name = url.get_backend_name()

        # Must be Trino connection, enable impersonation, and set optional param
        # auth=LDAP|KERBEROS
        # Set principal_username=$effective_username
        if backend_name == "trino" and username is not None:
            connect_args["user"] = username

    @classmethod
    def get_url_for_impersonation(
        cls, url: URL, impersonate_user: bool, username: Optional[str]
    ) -> URL:
        """
        Return a modified URL with the username set.

        :param url: SQLAlchemy URL object
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        """
        # Do nothing and let update_impersonation_config take care of impersonation
        return url

    @classmethod
    def get_allow_cost_estimate(cls, extra: Dict[str, Any]) -> bool:
        return True

    @classmethod
    def get_tracking_url(cls, cursor: Cursor) -> Optional[str]:
        try:
            return cursor.info_uri
        except AttributeError:
            try:
                conn = cursor.connection
                # pylint: disable=protected-access, line-too-long
                return f"{conn.http_scheme}://{conn.host}:{conn.port}/ui/query.html?{cursor._query.query_id}"
            except AttributeError:
                pass
        return None

    @classmethod
    def handle_cursor(cls, cursor: Cursor, query: Query, session: Session) -> None:
        tracking_url = cls.get_tracking_url(cursor)
        if tracking_url:
            query.tracking_url = tracking_url

        # Adds the executed query id to the extra payload so the query can be cancelled
        query.set_extra_json_key(
            key=QUERY_CANCEL_KEY,
            value=(cancel_query_id := cursor.stats["queryId"]),
        )

        session.commit()

        # if query cancelation was requested prior to the handle_cursor call, but
        # the query was still executed, trigger the actual query cancelation now
        if query.extra.get(QUERY_EARLY_CANCEL_KEY):
            cls.cancel_query(
                cursor=cursor,
                query=query,
                cancel_query_id=cancel_query_id,
            )

        super().handle_cursor(cursor=cursor, query=query, session=session)

    @classmethod
    def prepare_cancel_query(cls, query: Query, session: Session) -> None:
        if QUERY_CANCEL_KEY not in query.extra:
            query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
            session.commit()

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel query in the underlying database.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: Trino `queryId`
        :return: True if query cancelled successfully, False otherwise
        """
        try:
            cursor.execute(
                f"CALL system.runtime.kill_query(query_id => '{cancel_query_id}',"
                "message => 'Query cancelled by Superset')"
            )
            cursor.fetchall()  # needed to trigger the call
        except Exception:  # pylint: disable=broad-except
            return False

        return True

    @staticmethod
    def get_extra_params(database: Database) -> Dict[str, Any]:
        """
        Some databases require adding elements to connection parameters,
        like passing certificates to `extra`. This can be done here.

        :param database: database instance from which to extract extras
        :raises CertificateException: If certificate is not valid/unparseable
        """
        extra: Dict[str, Any] = BaseEngineSpec.get_extra_params(database)
        engine_params: Dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: Dict[str, Any] = engine_params.setdefault("connect_args", {})

        connect_args.setdefault("source", USER_AGENT)

        if database.server_cert:
            connect_args["http_scheme"] = "https"
            connect_args["verify"] = utils.create_ssl_cert_file(database.server_cert)

        return extra

    @staticmethod
    def update_params_from_encrypted_extra(
        database: Database,
        params: Dict[str, Any],
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
            elif auth_method == "certificate":
                from trino.auth import CertificateAuthentication as trino_auth  # noqa
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

    @classmethod
    def get_dbapi_exception_mapping(cls) -> Dict[Type[Exception], Type[Exception]]:
        # pylint: disable=import-outside-toplevel
        from requests import exceptions as requests_exceptions

        return {
            requests_exceptions.ConnectionError: SupersetDBAPIConnectionError,
        }
