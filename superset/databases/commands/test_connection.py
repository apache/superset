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
from typing import Any, Dict, Optional

from flask import current_app as app
from flask_babel import gettext as _
from func_timeout import func_timeout, FunctionTimedOut
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError, NoSuchModuleError

from superset.commands.base import BaseCommand
from superset.databases.commands.exceptions import (
    DatabaseSecurityUnsafeError,
    DatabaseTestConnectionDriverError,
    DatabaseTestConnectionFailedError,
    DatabaseTestConnectionUnexpectedError,
)
from superset.databases.dao import DatabaseDAO
from superset.databases.utils import make_url_safe
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetSecurityException, SupersetTimeoutException
from superset.extensions import event_logger
from superset.models.core import Database

logger = logging.getLogger(__name__)


class TestConnectionDatabaseCommand(BaseCommand):
    def __init__(self, data: Dict[str, Any]):
        self._properties = data.copy()
        self._model: Optional[Database] = None

    def run(self) -> None:  # pylint: disable=too-many-statements
        self.validate()
        uri = self._properties.get("sqlalchemy_uri", "")
        if self._model and uri == self._model.safe_sqlalchemy_uri():
            uri = self._model.sqlalchemy_uri_decrypted

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

            engine = database.get_sqla_engine()
            event_logger.log_with_context(
                action="test_connection_attempt",
                engine=database.db_engine_spec.__name__,
            )

            def ping(engine: Engine) -> bool:
                with closing(engine.raw_connection()) as conn:
                    return engine.dialect.do_ping(conn)

            try:
                alive = func_timeout(
                    int(app.config["TEST_DATABASE_CONNECTION_TIMEOUT"].total_seconds()),
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
            except Exception:  # pylint: disable=broad-except
                alive = False
            if not alive:
                raise DBAPIError(None, None, None)

            # Log succesful connection test with engine
            event_logger.log_with_context(
                action="test_connection_success",
                engine=database.db_engine_spec.__name__,
            )

        except (NoSuchModuleError, ModuleNotFoundError) as ex:
            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseTestConnectionDriverError(
                message=_("Could not load database driver: {}").format(
                    database.db_engine_spec.__name__
                ),
            ) from ex
        except DBAPIError as ex:
            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            # check for custom errors (wrong username, wrong password, etc)
            errors = database.db_engine_spec.extract_errors(ex, context)
            raise DatabaseTestConnectionFailedError(errors) from ex
        except SupersetSecurityException as ex:
            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseSecurityUnsafeError(message=str(ex)) from ex
        except SupersetTimeoutException as ex:

            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            # bubble up the exception to return a 408
            raise ex
        except Exception as ex:
            event_logger.log_with_context(
                action=f"test_connection_error.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            errors = database.db_engine_spec.extract_errors(ex, context)
            raise DatabaseTestConnectionUnexpectedError(errors) from ex

    def validate(self) -> None:
        database_name = self._properties.get("database_name")
        if database_name is not None:
            self._model = DatabaseDAO.get_database_by_name(database_name)
