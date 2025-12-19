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
from typing import Any, Optional

from flask_babel import gettext as _
from sqlalchemy.exc import DBAPIError, NoSuchModuleError

from superset import is_feature_enabled
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseSecurityUnsafeError,
    DatabaseTestConnectionDriverError,
    DatabaseTestConnectionUnexpectedError,
)
from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelDatabasePortError,
    SSHTunnelingNotEnabledError,
)
from superset.commands.database.utils import ping
from superset.daos.database import DatabaseDAO
from superset.databases.utils import make_url_safe
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetErrorsException,
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.extensions import event_logger
from superset.models.core import Database
from superset.utils.ssh_tunnel import unmask_password_info

logger = logging.getLogger(__name__)


def get_log_connection_action(
    action: str, ssh_tunnel: Optional[Any], exc: Optional[Exception] = None
) -> str:
    action_modified = action
    if exc:
        action_modified += f".{exc.__class__.__name__}"
    if ssh_tunnel:
        action_modified += ".ssh_tunnel"
    return action_modified


class TestConnectionDatabaseCommand(BaseCommand):
    __test__ = False
    _model: Optional[Database] = None
    _context: dict[str, Any]
    _uri: str

    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

        if (database_name := self._properties.get("database_name")) is not None:
            self._model = DatabaseDAO.get_database_by_name(database_name)

        uri = self._properties.get("sqlalchemy_uri", "")
        if self._model and uri == self._model.safe_sqlalchemy_uri():
            uri = self._model.sqlalchemy_uri_decrypted

        url = make_url_safe(uri)

        context = {
            "hostname": url.host,
            "password": url.password,
            "port": url.port,
            "username": url.username,
            "database": url.database,
        }

        self._context = context
        self._uri = uri

    def run(  # noqa: C901
        self,
    ) -> None:  # pylint: disable=too-many-statements,too-many-branches
        self.validate()
        ex_str = ""

        url = make_url_safe(self._uri)
        engine = url.get_backend_name()

        serialized_encrypted_extra = self._properties.get(
            "masked_encrypted_extra",
            "{}",
        )
        if self._model:
            serialized_encrypted_extra = (
                self._model.db_engine_spec.unmask_encrypted_extra(
                    self._model.encrypted_extra,
                    serialized_encrypted_extra,
                )
            )

        # collect SSH tunnel info
        ssh_tunnel_properties = self._properties.get("ssh_tunnel")
        if ssh_tunnel_properties and self._model and self._model.ssh_tunnel:
            # unmask password while allowing for updated values
            ssh_tunnel_properties = unmask_password_info(
                ssh_tunnel_properties,
                self._model.ssh_tunnel,
            )

        database: Database | None = None
        try:
            database = DatabaseDAO.build_db_for_connection_test(
                server_cert=self._properties.get("server_cert", ""),
                extra=self._properties.get("extra", "{}"),
                impersonate_user=self._properties.get("impersonate_user", False),
                encrypted_extra=serialized_encrypted_extra,
                ssh_tunnel=ssh_tunnel_properties,
            )

            database.set_sqlalchemy_uri(self._uri)
            database.db_engine_spec.mutate_db_for_connection_test(database)

            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_attempt",
                    ssh_tunnel_properties,
                ),
                engine=engine,
            )

            with database.get_sqla_engine() as engine:
                try:
                    alive = ping(engine)
                except SupersetTimeoutException as ex:
                    raise SupersetTimeoutException(
                        error_type=SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
                        message=(
                            "Please check your connection details and database settings, "  # noqa: E501
                            "and ensure that your database is accepting connections, "
                            "then try connecting again."
                        ),
                        level=ErrorLevel.ERROR,
                        extra={"sqlalchemy_uri": database.sqlalchemy_uri},
                    ) from ex
                except Exception as ex:  # pylint: disable=broad-except
                    # If the connection failed because OAuth2 is needed, start the flow.
                    if (
                        database.is_oauth2_enabled()
                        and database.db_engine_spec.needs_oauth2(ex)
                    ):
                        database.start_oauth2_dance()

                    alive = False
                    # So we stop losing the original message if any
                    ex_str = str(ex)

            if not alive:
                raise DBAPIError(ex_str or None, None, None)

            # Log successful connection test with engine
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_success",
                    ssh_tunnel_properties,
                ),
                engine=engine,
            )

        except (NoSuchModuleError, ModuleNotFoundError) as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error",
                    ssh_tunnel_properties,
                    ex,
                ),
                engine=engine,
            )
            raise DatabaseTestConnectionDriverError(
                message=_(
                    "Could not load database driver for: %(engine)s",
                    engine=engine,
                ),
            ) from ex
        except DBAPIError as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error",
                    ssh_tunnel_properties,
                    ex,
                ),
                engine=engine,
            )

            if not database:
                raise
            # check for custom errors (wrong username, wrong password, etc)
            errors = database.db_engine_spec.extract_errors(
                ex, self._context, database_name=database.unique_name
            )
            raise SupersetErrorsException(errors, status=400) from ex
        except OAuth2RedirectError:
            raise
        except SupersetSecurityException as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error",
                    ssh_tunnel_properties,
                    ex,
                ),
                engine=engine,
            )
            raise DatabaseSecurityUnsafeError(message=str(ex)) from ex
        except (SupersetTimeoutException, SSHTunnelingNotEnabledError) as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error",
                    ssh_tunnel_properties,
                    ex,
                ),
                engine=engine,
            )
            # bubble up the exception to return proper status code
            raise
        except Exception as ex:
            if not database:
                raise

            if database.is_oauth2_enabled() and database.db_engine_spec.needs_oauth2(
                ex
            ):
                database.start_oauth2_dance()
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error",
                    ssh_tunnel_properties,
                    ex,
                ),
                engine=engine,
            )
            errors = database.db_engine_spec.extract_errors(ex, self._context)
            raise DatabaseTestConnectionUnexpectedError(errors) from ex

    def validate(self) -> None:
        if self._properties.get("ssh_tunnel"):
            if not is_feature_enabled("SSH_TUNNELING"):
                raise SSHTunnelingNotEnabledError()
            if not self._context.get("port"):
                raise SSHTunnelDatabasePortError()
