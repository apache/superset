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
from typing import Any, Dict, List, Optional, TYPE_CHECKING

import simplejson as json
from flask import current_app
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlalchemy.orm import Session

from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.models.sql_lab import Query
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)


class TrinoEngineSpec(PrestoEngineSpec):
    engine = "trino"
    engine_aliases = {"trinonative"}  # Required for backwards compatibility.
    engine_name = "Trino"

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
    def get_table_names(
        cls,
        database: "Database",
        inspector: Inspector,
        schema: Optional[str],
    ) -> List[str]:
        return BaseEngineSpec.get_table_names(
            database=database,
            inspector=inspector,
            schema=schema,
        )

    @classmethod
    def get_view_names(
        cls,
        database: "Database",
        inspector: Inspector,
        schema: Optional[str],
    ) -> List[str]:
        return BaseEngineSpec.get_view_names(
            database=database,
            inspector=inspector,
            schema=schema,
        )

    @classmethod
    def handle_cursor(cls, cursor: Any, query: Query, session: Session) -> None:
        """Updates progress information"""
        BaseEngineSpec.handle_cursor(cursor=cursor, query=query, session=session)

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
