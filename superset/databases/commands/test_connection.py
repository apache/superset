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
from contextlib import closing
from typing import Any, Dict, Optional

from flask_appbuilder.security.sqla.models import User
from flask_babel import gettext as _
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import DBAPIError, NoSuchModuleError

from superset.commands.base import BaseCommand
from superset.databases.commands.exceptions import (
    DatabaseSecurityUnsafeError,
    DatabaseTestConnectionDriverError,
    DatabaseTestConnectionFailedError,
    DatabaseTestConnectionNetworkError,
    DatabaseTestConnectionUnexpectedError,
)
from superset.databases.dao import DatabaseDAO
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.extensions import event_logger
from superset.models.core import Database
from superset.utils.network import is_host_up, is_hostname_valid, is_port_open

logger = logging.getLogger(__name__)


class TestConnectionDatabaseCommand(BaseCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()
        self._model: Optional[Database] = None

    @staticmethod
    def _diagnose(uri: str) -> None:
        parsed_uri = make_url(uri)
        if parsed_uri.host:
            if not is_hostname_valid(parsed_uri.host):
                raise DatabaseTestConnectionNetworkError(
                    error_type=SupersetErrorType.TEST_CONNECTION_INVALID_HOSTNAME_ERROR,
                    message=_(
                        'Unable to resolve hostname "%(hostname)s".',
                        hostname=parsed_uri.host,
                    ),
                    level=ErrorLevel.ERROR,
                    extra={"hostname": parsed_uri.host},
                )

            if parsed_uri.port:
                if not is_port_open(parsed_uri.host, parsed_uri.port):
                    if is_host_up(parsed_uri.host):
                        raise DatabaseTestConnectionNetworkError(
                            error_type=(
                                SupersetErrorType.TEST_CONNECTION_PORT_CLOSED_ERROR
                            ),
                            message=_(
                                "The host %(host)s is up, but the port %(port)s is "
                                "closed.",
                                host=parsed_uri.host,
                                port=parsed_uri.port,
                            ),
                            level=ErrorLevel.ERROR,
                            extra={
                                "hostname": parsed_uri.host,
                                "port": parsed_uri.port,
                            },
                        )

                    raise DatabaseTestConnectionNetworkError(
                        error_type=SupersetErrorType.TEST_CONNECTION_HOST_DOWN_ERROR,
                        message=_(
                            "The host %(host)s might be down, ond can't be reached on "
                            "port %(port)s.",
                            host=parsed_uri.host,
                            port=parsed_uri.port,
                        ),
                        level=ErrorLevel.ERROR,
                        extra={"hostname": parsed_uri.host, "port": parsed_uri.port,},
                    )

    def run(self) -> None:
        self.validate()
        uri = self._properties.get("sqlalchemy_uri", "")
        if self._model and uri == self._model.safe_sqlalchemy_uri():
            uri = self._model.sqlalchemy_uri_decrypted
        try:
            database = DatabaseDAO.build_db_for_connection_test(
                server_cert=self._properties.get("server_cert", ""),
                extra=self._properties.get("extra", "{}"),
                impersonate_user=self._properties.get("impersonate_user", False),
                encrypted_extra=self._properties.get("encrypted_extra", "{}"),
            )

            database.set_sqlalchemy_uri(uri)
            database.db_engine_spec.mutate_db_for_connection_test(database)
            username = self._actor.username if self._actor is not None else None
            engine = database.get_sqla_engine(user_name=username)
            with closing(engine.raw_connection()) as conn:
                if not engine.dialect.do_ping(conn):
                    raise DBAPIError(None, None, None)

        except (NoSuchModuleError, ModuleNotFoundError) as ex:
            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseTestConnectionDriverError(
                message=_("Could not load database driver: {}").format(
                    database.db_engine_spec.__name__
                ),
            )
        except DBAPIError as ex:
            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            # check if we have connectivity to the host, and if the port is open
            self._diagnose(uri)
            raise DatabaseTestConnectionFailedError()
        except SupersetSecurityException as ex:
            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseSecurityUnsafeError(message=str(ex))
        except Exception as ex:  # pylint: disable=broad-except
            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseTestConnectionUnexpectedError(str(ex))

    def validate(self) -> None:
        database_name = self._properties.get("database_name")
        if database_name is not None:
            self._model = DatabaseDAO.get_database_by_name(database_name)
