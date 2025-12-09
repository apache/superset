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
from datetime import datetime

from sqlalchemy.orm.exc import NoResultFound

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.api_keys import ApiKey

logger = logging.getLogger(__name__)


class ApiKeyDAO(BaseDAO[ApiKey]):
    model_cls = ApiKey

    @staticmethod
    def find_by_hash(key_hash: str) -> ApiKey | None:
        """
        Find an API key by its hash.

        This is used during authentication to look up the key from the database.

        Args:
            key_hash: The bcrypt hash of the API key

        Returns:
            The ApiKey object, or None if not found
        """
        try:
            return db.session.query(ApiKey).filter_by(key_hash=key_hash).one()
        except NoResultFound:
            return None

    @staticmethod
    def find_by_user(user_id: int) -> list[ApiKey]:
        """
        Find all API keys for a user.

        Args:
            user_id: The user's ID

        Returns:
            List of ApiKey objects owned by the user
        """
        return db.session.query(ApiKey).filter_by(user_id=user_id).all()

    @staticmethod
    def find_active_by_user(user_id: int) -> list[ApiKey]:
        """
        Find all active (non-revoked, non-expired) API keys for a user.

        Args:
            user_id: The user's ID

        Returns:
            List of active ApiKey objects owned by the user
        """
        now = datetime.utcnow()
        return (
            db.session.query(ApiKey)
            .filter_by(user_id=user_id)
            .filter(ApiKey.revoked_on.is_(None))
            .filter((ApiKey.expires_on.is_(None)) | (ApiKey.expires_on > now))
            .all()
        )

    @staticmethod
    def create_api_key(
        user_id: int,
        name: str,
        key_hash: str,
        key_prefix: str,
        workspace_name: str,
        created_by_fk: int | None = None,
        expires_on: datetime | None = None,
    ) -> ApiKey:
        """
        Create a new API key.

        Args:
            user_id: The user who owns this key
            name: User-friendly name for the key
            key_hash: bcrypt hash of the API key
            key_prefix: First 8 characters of the key for identification
            workspace_name: Workspace this key is scoped to
            created_by_fk: User who created this key (may differ from user_id)
            expires_on: Optional expiration datetime

        Returns:
            The created ApiKey object
        """
        api_key = ApiKey(
            user_id=user_id,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            workspace_name=workspace_name,
            created_by_fk=created_by_fk,
            expires_on=expires_on,
            created_on=datetime.utcnow(),
        )
        db.session.add(api_key)
        db.session.commit()
        return api_key

    @staticmethod
    def revoke(api_key: ApiKey, revoked_by_fk: int) -> None:
        """
        Revoke an API key.

        This sets the revoked_on timestamp and revoked_by_fk fields.

        Args:
            api_key: The ApiKey object to revoke
            revoked_by_fk: User ID of the user revoking the key
        """
        api_key.revoked_on = datetime.utcnow()
        api_key.revoked_by_fk = revoked_by_fk
        db.session.commit()

    @staticmethod
    def update_last_used(api_key: ApiKey) -> None:
        """
        Update the last_used_on timestamp for an API key.

        This should be called after successful authentication with the key.

        Args:
            api_key: The ApiKey object to update
        """
        api_key.last_used_on = datetime.utcnow()
        db.session.commit()

    @staticmethod
    def delete_api_key(api_key: ApiKey) -> None:
        """
        Delete an API key from the database.

        Note: Prefer using revoke() instead of delete() to maintain audit history.

        Args:
            api_key: The ApiKey object to delete
        """
        db.session.delete(api_key)
        db.session.commit()
