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

from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.daos.database import DatabaseUserOAuth2TokensDAO
from superset.databases.schemas import OAuth2ProviderResponseSchema
from superset.exceptions import OAuth2Error
from superset.models.core import Database, DatabaseUserOAuth2Tokens
from superset.superset_typing import OAuth2State
from superset.utils.decorators import on_error, transaction
from superset.utils.oauth2 import decode_oauth2_state


class OAuth2StoreTokenCommand(BaseCommand):
    """
    Command to store OAuth2 tokens in the database.
    """

    def __init__(self, parameters: OAuth2ProviderResponseSchema):
        self._parameters = parameters
        self._state: OAuth2State | None = None
        self._database: Database | None = None

    @transaction(on_error=partial(on_error, reraise=OAuth2Error))
    def run(self) -> DatabaseUserOAuth2Tokens:
        self.validate()
        self._database = cast(Database, self._database)
        self._state = cast(OAuth2State, self._state)

        oauth2_config = self._database.get_oauth2_config()
        if oauth2_config is None:
            raise OAuth2Error("No configuration found for OAuth2")

        token_response = self._database.db_engine_spec.get_oauth2_token(
            oauth2_config,
            self._parameters["code"],
        )

        # delete old tokens
        if existing := DatabaseUserOAuth2TokensDAO.find_one_or_none(
            user_id=self._state["user_id"],
            database_id=self._state["database_id"],
        ):
            DatabaseUserOAuth2TokensDAO.delete([existing])

        # store tokens
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

    def validate(self) -> None:
        if error := self._parameters.get("error"):
            raise OAuth2Error(error)

        self._state = decode_oauth2_state(self._parameters["state"])

        if database := DatabaseUserOAuth2TokensDAO.get_database(
            self._state["database_id"]
        ):
            self._database = database
        else:
            raise DatabaseNotFoundError("Database not found")
