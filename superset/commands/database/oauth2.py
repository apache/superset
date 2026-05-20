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

from datetime import datetime, timedelta
from functools import partial
from typing import cast
from uuid import UUID

from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.daos.database import DatabaseUserOAuth2TokensDAO
from superset.daos.key_value import KeyValueDAO
from superset.databases.schemas import OAuth2ProviderResponseSchema
from superset.db_engine_specs import get_engine_spec
from superset.db_engine_specs.base import BaseEngineSpec
from superset.exceptions import OAuth2Error
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
from superset.models.core import Database, DatabaseUserOAuth2Tokens
from superset.superset_typing import (
    OAuth2ClientConfig,
    OAuth2State,
    OAuth2TokenResponse,
)
from superset.utils.decorators import on_error, transaction
from superset.utils.oauth2 import decode_oauth2_state

# how long the pre-create token cache lives in the KV store
PRE_CREATE_TOKEN_TTL = timedelta(minutes=5)


class OAuth2StoreTokenCommand(BaseCommand):
    """
    Command to store OAuth2 tokens.

    Normal flow: the OAuth2 callback resolves the database via ``state.database_id``
    and persists access/refresh tokens to ``database_user_oauth2_tokens``.

    Pre-create flow: when ``state.database_id`` is ``None`` (the database hasn't
    been saved yet — typically the "Create database" wizard), the command reads
    the OAuth2 client config and engine name from the KV store entry that
    :meth:`BaseEngineSpec.start_oauth2_dance` stashed there, exchanges the code,
    and caches the resulting access token in the same KV entry for
    :func:`get_oauth2_access_token` to pick up on the retry.
    """

    def __init__(self, parameters: OAuth2ProviderResponseSchema):
        self._parameters = parameters
        self._state: OAuth2State | None = None
        self._database: Database | None = None
        self._oauth2_config: OAuth2ClientConfig | None = None
        self._engine_spec: type[BaseEngineSpec] | None = None
        self._tab_uuid: UUID | None = None

    @transaction(on_error=partial(on_error, reraise=OAuth2Error))
    def run(self) -> DatabaseUserOAuth2Tokens | None:
        self.validate()
        self._state = cast(OAuth2State, self._state)
        self._oauth2_config = cast(OAuth2ClientConfig, self._oauth2_config)
        self._engine_spec = cast(type[BaseEngineSpec], self._engine_spec)

        # Look up PKCE code_verifier from KV store (RFC 7636)
        code_verifier = self._pop_code_verifier()

        token_response = self._engine_spec.get_oauth2_token(
            self._oauth2_config,
            self._parameters["code"],
            code_verifier=code_verifier,
        )

        if self._database is None:
            # Pre-create flow: cache the access token in the KV entry the
            # initial dance created. The retry of "Test Connection" will read
            # it via ``get_oauth2_access_token``.
            self._cache_pre_create_token(token_response)
            return None

        return self._persist_token(token_response)

    def validate(self) -> None:
        if error := self._parameters.get("error"):
            raise OAuth2Error(error)

        self._state = decode_oauth2_state(self._parameters["state"])

        try:
            self._tab_uuid = UUID(self._state["tab_id"])
        except (KeyError, ValueError):
            # Legacy paths may use non-UUID tab ids; we still want to support
            # them when ``database_id`` is set. The pre-create path below
            # requires a valid UUID.
            self._tab_uuid = None

        if database_id := self._state.get("database_id"):
            self._database = DatabaseUserOAuth2TokensDAO.get_database(database_id)
            if self._database is None:
                raise DatabaseNotFoundError("Database not found")
            self._oauth2_config = self._database.get_oauth2_config()
            self._engine_spec = self._database.db_engine_spec
        else:
            if self._tab_uuid is None:
                raise OAuth2Error(
                    "Pre-create OAuth2 callback requires a UUID tab_id",
                )
            cached = KeyValueDAO.get_value(
                resource=KeyValueResource.OAUTH2_PRE_CREATE_TOKEN,
                key=self._tab_uuid,
                codec=JsonKeyValueCodec(),
            )
            if not cached or not cached.get("config"):
                raise OAuth2Error("Pre-create OAuth2 context not found or expired")
            self._oauth2_config = cast(OAuth2ClientConfig, cached["config"])
            engine = self._state.get("engine") or cached.get("engine")
            if not engine:
                raise OAuth2Error("Pre-create OAuth2 context missing engine name")
            self._engine_spec = get_engine_spec(engine)

        if self._oauth2_config is None:
            raise OAuth2Error("No configuration found for OAuth2")

    def _pop_code_verifier(self) -> str | None:
        if self._tab_uuid is None:
            return None
        kv_value = KeyValueDAO.get_value(
            resource=KeyValueResource.PKCE_CODE_VERIFIER,
            key=self._tab_uuid,
            codec=JsonKeyValueCodec(),
        )
        if not kv_value:
            return None
        KeyValueDAO.delete_entry(KeyValueResource.PKCE_CODE_VERIFIER, self._tab_uuid)
        return kv_value.get("code_verifier")

    def _cache_pre_create_token(self, token_response: OAuth2TokenResponse) -> None:
        self._state = cast(OAuth2State, self._state)
        self._tab_uuid = cast(UUID, self._tab_uuid)
        self._oauth2_config = cast(OAuth2ClientConfig, self._oauth2_config)
        self._engine_spec = cast(type[BaseEngineSpec], self._engine_spec)

        expires_on = datetime.now() + PRE_CREATE_TOKEN_TTL
        KeyValueDAO.upsert_entry(
            resource=KeyValueResource.OAUTH2_PRE_CREATE_TOKEN,
            key=self._tab_uuid,
            value={
                "engine": self._engine_spec.engine,
                "config": self._oauth2_config,
                "user_id": self._state["user_id"],
                "access_token": token_response["access_token"],
            },
            codec=JsonKeyValueCodec(),
            expires_on=expires_on,
        )

    def _persist_token(
        self,
        token_response: OAuth2TokenResponse,
    ) -> DatabaseUserOAuth2Tokens:
        self._state = cast(OAuth2State, self._state)

        if existing := DatabaseUserOAuth2TokensDAO.find_one_or_none(
            user_id=self._state["user_id"],
            database_id=self._state["database_id"],
        ):
            DatabaseUserOAuth2TokensDAO.delete([existing])

        expiration = datetime.now() + timedelta(seconds=token_response["expires_in"])
        return DatabaseUserOAuth2TokensDAO.create(
            attributes={
                "user_id": self._state["user_id"],
                "database_id": self._state["database_id"],
                "access_token": token_response["access_token"],
                "access_token_expiration": expiration,
                "refresh_token": token_response.get("refresh_token"),
            },
        )
