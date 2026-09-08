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
from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseExistsValidationError,
    DatabaseInvalidError,
    DatabaseNotFoundError,
    DatabaseUpdateFailedError,
    MissingOAuth2TokenError,
)
from superset.commands.database.sync_permissions import SyncPermissionsCommand
from superset.constants import PASSWORD_MASK
from superset.daos.database import DatabaseDAO
from superset.databases.utils import make_url_safe
from superset.exceptions import OAuth2RedirectError
from superset.models.core import Database
from superset.utils import json
from superset.utils.core import get_username
from superset.utils.decorators import on_error, transaction
from superset.utils.ssh_tunnel import unmask_password_info

logger = logging.getLogger(__name__)


class UpdateDatabaseCommand(BaseCommand):
    _model: Database | None

    def __init__(self, model_id: int, data: dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Database | None = None

    @transaction(on_error=partial(on_error, reraise=DatabaseUpdateFailedError))
    def run(self) -> Model:
        self._model = DatabaseDAO.find_by_id(self._model_id)

        if not self._model:
            raise DatabaseNotFoundError()

        self.validate()

        if "masked_encrypted_extra" in self._properties:
            # unmask ``encrypted_extra``
            self._properties["encrypted_extra"] = (
                self._model.db_engine_spec.unmask_encrypted_extra(
                    self._model.encrypted_extra,
                    self._properties.pop("masked_encrypted_extra"),
                )
            )

            # Depending on the changes to the OAuth2 configuration we may need to purge
            # existing personal tokens.
            self._handle_oauth2()

        # The DAO updates the model in place, so compare settings before applying them.
        can_skip_failed_sync = self._can_skip_failed_sync()

        # Some DBs require running a query to get the default catalog.
        # In these cases, if the current connection is broken then
        # `get_default_catalog` would raise an exception. We need to
        # gracefully handle that so that the connection can be fixed.
        original_database_name = self._model.database_name
        force_update: bool = False
        try:
            original_catalog = self._model.get_default_catalog()
        except Exception:
            original_catalog = None
            force_update = True

        # build new DB
        database = DatabaseDAO.update(self._model, self._properties)
        database.set_sqlalchemy_uri(database.sqlalchemy_uri)

        new_catalog = database.get_default_catalog()

        # update assets when the database catalog changes, if the database was not
        # configured with multi-catalog support; if it was enabled or is enabled in the
        # update we don't update the assets
        if (
            force_update
            or new_catalog != original_catalog
            and not self._model.allow_multi_catalog
            and not database.allow_multi_catalog
        ):
            self._update_catalog_attribute(self._model.id, new_catalog)

        # if the database name changed we need to update any existing permissions,
        # since they're name based
        try:
            current_username = get_username()
            SyncPermissionsCommand(
                self._model_id,
                current_username,
                old_db_connection_name=original_database_name,
                db_connection=database,
            ).run()
        except (OAuth2RedirectError, MissingOAuth2TokenError):
            pass
        except DatabaseConnectionFailedError:
            if not can_skip_failed_sync:
                raise
            logger.warning(
                "Skipping permission sync for database %s: connection unavailable "
                "and connection settings unchanged",
                self._model_id,
            )

        return database

    def _can_skip_failed_sync(self) -> bool:
        """Check that the connection and permission identity remain unchanged."""
        assert self._model

        connection_fields = {
            "database_name",  # Schema and catalog permissions include this name.
            "sqlalchemy_uri",
            "encrypted_extra",
            "extra",
            "server_cert",
            "impersonate_user",
            "ssh_tunnel",
        }
        for key in connection_fields & self._properties.keys():
            incoming = self._properties[key]
            original = getattr(self._model, key)
            if key == "sqlalchemy_uri":
                try:
                    original = make_url_safe(self._model.sqlalchemy_uri_decrypted)
                except Exception:
                    # An unavailable old password store must not block repairs.
                    return False
                incoming = make_url_safe(incoming.strip())
                if incoming.password == PASSWORD_MASK:
                    incoming = incoming.set(password=original.password)
            elif key in {"extra", "encrypted_extra"}:
                try:
                    original = json.loads(original or "{}")
                    incoming = json.loads(incoming or "{}")
                except json.JSONDecodeError:
                    return False
            elif key == "server_cert":
                original = original or None
                incoming = incoming or None
            elif key == "ssh_tunnel" and original is not None and incoming is not None:
                incoming = unmask_password_info(incoming.copy(), original)
                incoming = {
                    field: incoming.get(field) for field in original.export_fields
                }
                original = {
                    field: getattr(original, field) for field in original.export_fields
                }
            if incoming != original:
                return False

        return True

    def _handle_oauth2(self) -> None:
        """
        Handle changes in OAuth2.
        """
        if not self._model:
            return

        if self._properties["encrypted_extra"] is None:
            self._model.purge_oauth2_tokens()
            return

        current_config = self._model.get_oauth2_config()
        if not current_config:
            return

        encrypted_extra = json.loads(self._properties["encrypted_extra"])
        new_config = encrypted_extra.get("oauth2_client_info", {})

        # Keys that require purging personal tokens because they probably are no longer
        # valid. For example, if the scope has changed the existing tokens are still
        # associated with the old scope. Similarly, if the endpoints changed the tokens
        # are probably no longer valid.
        keys = {
            "id",
            "scope",
            "authorization_request_uri",
            "token_request_uri",
        }
        for key in keys:
            if current_config.get(key) != new_config.get(key):
                self._model.purge_oauth2_tokens()
                break

    def _update_catalog_attribute(
        self,
        database_id: int,
        new_catalog: str | None,
    ) -> None:
        """
        Update the catalog of the datasets that are associated with database.
        """
        from superset.connectors.sqla.models import SqlaTable
        from superset.models.sql_lab import Query, SavedQuery, TableSchema, TabState

        for model in [
            SqlaTable,
            Query,
            SavedQuery,
            TabState,
            TableSchema,
        ]:
            fk = "db_id" if model == SavedQuery else "database_id"
            predicate = {fk: database_id}
            update = {"catalog": new_catalog}
            db.session.query(model).filter_by(**predicate).update(update)

    def validate(self) -> None:
        if database_name := self._properties.get("database_name"):
            if not DatabaseDAO.validate_update_uniqueness(
                self._model_id,
                database_name,
            ):
                raise DatabaseInvalidError(exceptions=[DatabaseExistsValidationError()])
