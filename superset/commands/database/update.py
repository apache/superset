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
    DatabaseExistsValidationError,
    DatabaseInvalidError,
    DatabaseNotFoundError,
    DatabaseUpdateFailedError,
    DatabaseUpdateUnsafeRebindError,
    MissingOAuth2TokenError,
)
from superset.commands.database.sync_permissions import SyncPermissionsCommand
from superset.commands.database.utils import (
    engine_params_changed,
    ssh_tunnel_rebind_unsafe,
    uri_identity_changed,
)
from superset.constants import PASSWORD_MASK
from superset.daos.database import DatabaseDAO
from superset.databases.utils import make_url_safe
from superset.exceptions import OAuth2RedirectError
from superset.models.core import Database
from superset.utils import json
from superset.utils.core import get_username
from superset.utils.decorators import on_error, transaction

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

        return database

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

        if self._model:
            self._check_no_unsafe_secret_rebind()

    def _check_no_unsafe_secret_rebind(self) -> None:
        """
        Refuse an update that changes the connection's effective destination
        (URI host/port, `extra.engine_params`, or the SSH tunnel endpoint)
        while leaving the corresponding stored secret masked.

        Without this, an editor could silently redirect the real stored
        password/encrypted_extra/SSH tunnel credential to a different
        destination -- and since an update persists, every subsequent use of
        the database (by any user) would send the real secret there, not
        just the editor's own request.
        """
        model = self._model
        assert model is not None

        connection_identity_changed = False
        submitted_password: str | None = None

        if "sqlalchemy_uri" in self._properties:
            submitted_uri = self._properties["sqlalchemy_uri"] or ""
            connection_identity_changed = uri_identity_changed(
                model.sqlalchemy_uri, submitted_uri
            )
            try:
                submitted_password = make_url_safe(submitted_uri).password
            except DatabaseInvalidError:
                submitted_password = None

        if "extra" in self._properties and engine_params_changed(
            model.extra, self._properties["extra"]
        ):
            connection_identity_changed = True

        if connection_identity_changed:
            # The URI password is only one of the secrets that can silently
            # carry over onto a changed destination. `encrypted_extra` (e.g.
            # a service-account key or OAuth2 client secret) is reattached
            # unconditionally in `run()` via `unmask_encrypted_extra` unless
            # we catch it here -- gating on the URI password alone would
            # both miss that reuse when a fresh URI password is supplied,
            # and wrongly block engines that keep credentials entirely in
            # `encrypted_extra` and carry no URI password at all (BigQuery,
            # GSheets), since those never have a "fresh" URI password to
            # give.
            uri_password_reused = model.password is not None and submitted_password in (
                None,
                PASSWORD_MASK,
            )
            # encrypted_extra is a blob with per-field masks, so "reused"
            # means unmasking the submission against the stored value
            # changes nothing -- including not submitting it at all, which
            # leaves the old (real) value attached unchanged.
            encrypted_extra_reused = model.encrypted_extra not in (
                None,
                "",
                "{}",
            ) and (
                "masked_encrypted_extra" not in self._properties
                or model.db_engine_spec.unmask_encrypted_extra(
                    model.encrypted_extra,
                    self._properties["masked_encrypted_extra"],
                )
                == model.encrypted_extra
            )
            if uri_password_reused or encrypted_extra_reused:
                raise DatabaseInvalidError(
                    exceptions=[DatabaseUpdateUnsafeRebindError()]
                )

        if "ssh_tunnel" in self._properties and ssh_tunnel_rebind_unsafe(
            model.ssh_tunnel, self._properties["ssh_tunnel"]
        ):
            raise DatabaseInvalidError(
                exceptions=[DatabaseUpdateUnsafeRebindError(field_name="ssh_tunnel")]
            )
