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
import sqlite3
from contextlib import closing
from typing import Any, Optional

from flask import current_app as app
from flask_babel import gettext as _
from func_timeout import func_timeout, FunctionTimedOut
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError, NoSuchModuleError

from superset import is_feature_enabled
from superset.commands.base import BaseCommand
from superset.daos.database import DatabaseDAO, SSHTunnelDAO
from superset.databases.commands.exceptions import (
    DatabaseSecurityUnsafeError,
    DatabaseTestConnectionDriverError,
    DatabaseTestConnectionUnexpectedError,
)
from superset.databases.ssh_tunnel.commands.exceptions import (
    SSHTunnelingNotEnabledError,
)
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.databases.utils import make_url_safe
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import (
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
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()
        self._model: Optional[Database] = None

    def run(self) -> None:  # pylint: disable=too-many-statements, too-many-branches
        self.validate()
        ex_str = ""
        uri = self._properties.get("sqlalchemy_uri", "")
        if self._model and uri == self._model.safe_sqlalchemy_uri():
            uri = self._model.sqlalchemy_uri_decrypted
        ssh_tunnel = self._properties.get("ssh_tunnel")

        # context for error messages
        url = make_url_safe(uri)
        context = {
            "hostname": url.host,
            "password": url.password,
            "port": url.port,
            "username": url.username,
            "database": url.database,
        }

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

        try:
            database = DatabaseDAO.build_db_for_connection_test(
                server_cert=self._properties.get("server_cert", ""),
                extra=self._properties.get("extra", "{}"),
                impersonate_user=self._properties.get("impersonate_user", False),
                encrypted_extra=serialized_encrypted_extra,
            )

            database.set_sqlalchemy_uri(uri)
            database.db_engine_spec.mutate_db_for_connection_test(database)

            # Generate tunnel if present in the properties
            if ssh_tunnel:
                if not is_feature_enabled("SSH_TUNNELING"):
                    raise SSHTunnelingNotEnabledError()
                # If there's an existing tunnel for that DB we need to use the stored
                # password, private_key and private_key_password instead
                if ssh_tunnel_id := ssh_tunnel.pop("id", None):
                    if existing_ssh_tunnel := SSHTunnelDAO.find_by_id(ssh_tunnel_id):
                        ssh_tunnel = unmask_password_info(
                            ssh_tunnel, existing_ssh_tunnel
                        )
                ssh_tunnel = SSHTunnel(**ssh_tunnel)

            event_logger.log_with_context(
                action=get_log_connection_action("test_connection_attempt", ssh_tunnel),
                engine=database.db_engine_spec.__name__,
            )

            def ping(engine: Engine) -> bool:
                with closing(engine.raw_connection()) as conn:
                    return engine.dialect.do_ping(conn)

            with database.get_sqla_engine_with_context(
                override_ssh_tunnel=ssh_tunnel
            ) as engine:
                try:
                    alive = func_timeout(
                        app.config["TEST_DATABASE_CONNECTION_TIMEOUT"].total_seconds(),
                        ping,
                        args=(engine,),
                    )
                except (sqlite3.ProgrammingError, RuntimeError):
                    # SQLite can't run on a separate thread, so ``func_timeout`` fails
                    # RuntimeError catches the equivalent error from duckdb.
                    alive = engine.dialect.do_ping(engine)
                except FunctionTimedOut as ex:
                    raise SupersetTimeoutException(
                        error_type=SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
                        message=(
                            "Please check your connection details and database settings, "
                            "and ensure that your database is accepting connections, "
                            "then try connecting again."
                        ),
                        level=ErrorLevel.ERROR,
                        extra={"sqlalchemy_uri": database.sqlalchemy_uri},
                    ) from ex
                except Exception as ex:  # pylint: disable=broad-except
                    alive = False
                    # So we stop losing the original message if any
                    ex_str = str(ex)

            if not alive:
                raise DBAPIError(ex_str or None, None, None)

            # Log succesful connection test with engine
            event_logger.log_with_context(
                action=get_log_connection_action("test_connection_success", ssh_tunnel),
                engine=database.db_engine_spec.__name__,
            )

        except (NoSuchModuleError, ModuleNotFoundError) as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error", ssh_tunnel, ex
                ),
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseTestConnectionDriverError(
                message=_("Could not load database driver: {}").format(
                    database.db_engine_spec.__name__
                ),
            ) from ex
        except DBAPIError as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error", ssh_tunnel, ex
                ),
                engine=database.db_engine_spec.__name__,
            )
            # check for custom errors (wrong username, wrong password, etc)
            errors = database.db_engine_spec.extract_errors(ex, context)
            raise SupersetErrorsException(errors) from ex
        except SupersetSecurityException as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error", ssh_tunnel, ex
                ),
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseSecurityUnsafeError(message=str(ex)) from ex
        except SupersetTimeoutException as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error", ssh_tunnel, ex
                ),
                engine=database.db_engine_spec.__name__,
            )
            # bubble up the exception to return a 408
            raise ex
        except SSHTunnelingNotEnabledError as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error", ssh_tunnel, ex
                ),
                engine=database.db_engine_spec.__name__,
            )
            # bubble up the exception to return a 400
            raise ex
        except Exception as ex:
            event_logger.log_with_context(
                action=get_log_connection_action(
                    "test_connection_error", ssh_tunnel, ex
                ),
                engine=database.db_engine_spec.__name__,
            )
            errors = database.db_engine_spec.extract_errors(ex, context)
            raise DatabaseTestConnectionUnexpectedError(errors) from ex

    def validate(self) -> None:
        if (database_name := self._properties.get("database_name")) is not None:
            self._model = DatabaseDAO.get_database_by_name(database_name)
