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
from functools import partial

from flask import g

from superset.commands.api_key.exceptions import (
    ApiKeyForbiddenError,
    ApiKeyNotFoundError,
    ApiKeyRevokeFailedError,
)
from superset.commands.base import BaseCommand
from superset.daos.api_key import ApiKeyDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class RevokeApiKeyCommand(BaseCommand):
    """
    Command to revoke an API key.

    Users can only revoke their own API keys unless they have admin privileges.
    """

    def __init__(self, api_key_id: int):
        self._api_key_id = api_key_id

    def run(self) -> None:
        """
        Revoke the API key.

        Raises:
            ApiKeyNotFoundError: If the API key doesn't exist
            ApiKeyForbiddenError: If the user doesn't own this key
            ApiKeyRevokeFailedError: If revocation fails
        """
        self.validate()
        self._revoke_api_key()

    def validate(self) -> None:
        """
        Validate that the API key exists and belongs to the current user.

        Raises:
            ApiKeyNotFoundError: If the API key doesn't exist
            ApiKeyForbiddenError: If the user doesn't own this key
        """
        api_key = ApiKeyDAO.find_by_id(self._api_key_id)

        if not api_key:
            raise ApiKeyNotFoundError()

        # Check ownership (users can only revoke their own keys)
        if api_key.user_id != g.user.id:
            raise ApiKeyForbiddenError()

    @transaction(on_error=partial(on_error, reraise=ApiKeyRevokeFailedError))
    def _revoke_api_key(self) -> None:
        """Revoke the API key in the database."""
        api_key = ApiKeyDAO.find_by_id(self._api_key_id)

        if not api_key:
            raise ApiKeyNotFoundError()

        ApiKeyDAO.revoke(api_key, revoked_by_fk=g.user.id)

        logger.info(
            "API key revoked: id=%s, user_id=%s, name=%s",
            api_key.id,
            api_key.user_id,
            api_key.name,
        )
