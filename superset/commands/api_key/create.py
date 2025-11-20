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
from datetime import datetime
from functools import partial
from typing import Any

from flask import g

from superset.commands.api_key.exceptions import (
    ApiKeyCreateFailedError,
    ApiKeyRequiredFieldValidationError,
)
from superset.commands.base import BaseCommand
from superset.daos.api_key import ApiKeyDAO
from superset.models.api_keys import ApiKey
from superset.utils.api_key import generate_api_key
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateApiKeyCommand(BaseCommand):
    """
    Command to create a new API key for the current user.

    Returns a tuple of (ApiKey, plaintext_key) where plaintext_key
    is the full API key that should be shown to the user only once.
    """

    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    def run(self) -> tuple[ApiKey, str]:
        """
        Create a new API key.

        Returns:
            Tuple of (ApiKey object, plaintext key string)

        Raises:
            ApiKeyRequiredFieldValidationError: If required fields are missing
            ApiKeyCreateFailedError: If creation fails
        """
        self.validate()
        return self._create_api_key()

    def validate(self) -> None:
        """
        Validate the API key creation request.

        Raises:
            ApiKeyRequiredFieldValidationError: If required fields are missing
        """
        # Name is required
        if not self._properties.get("name"):
            raise ApiKeyRequiredFieldValidationError("name")

        # Default workspace name if not provided
        if not self._properties.get("workspace_name"):
            self._properties["workspace_name"] = "default"

    @transaction(on_error=partial(on_error, reraise=ApiKeyCreateFailedError))
    def _create_api_key(self) -> tuple[ApiKey, str]:
        """Create the API key in the database."""
        # Generate the API key
        plaintext_key, key_hash, key_prefix = generate_api_key()

        # Extract properties
        name = self._properties["name"]
        workspace_name = self._properties["workspace_name"]
        expires_on = self._properties.get("expires_on")

        # Parse expires_on if it's a string
        if isinstance(expires_on, str):
            expires_on = datetime.fromisoformat(expires_on)

        # Create the API key
        api_key = ApiKeyDAO.create_api_key(
            user_id=g.user.id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            workspace_name=workspace_name,
            created_by_fk=g.user.id,
            expires_on=expires_on,
        )

        logger.info(
            "API key created: id=%s, user_id=%s, name=%s, workspace=%s",
            api_key.id,
            api_key.user_id,
            api_key.name,
            api_key.workspace_name,
        )

        return api_key, plaintext_key
