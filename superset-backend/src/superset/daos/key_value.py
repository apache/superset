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
from typing import Any
from uuid import UUID

from sqlalchemy import and_

from superset import db
from superset.daos.base import BaseDAO
from superset.key_value.exceptions import (
    KeyValueCreateFailedError,
    KeyValueUpdateFailedError,
)
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import Key, KeyValueCodec, KeyValueResource
from superset.key_value.utils import get_filter
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class KeyValueDAO(BaseDAO[KeyValueEntry]):
    @staticmethod
    def get_entry(
        resource: KeyValueResource,
        key: Key,
    ) -> KeyValueEntry | None:
        filter_ = get_filter(resource, key)
        return db.session.query(KeyValueEntry).filter_by(**filter_).first()

    @classmethod
    def get_value(
        cls,
        resource: KeyValueResource,
        key: Key,
        codec: KeyValueCodec,
    ) -> Any:
        entry = cls.get_entry(resource, key)
        if not entry or entry.is_expired():
            return None

        return codec.decode(entry.value)

    @staticmethod
    def delete_entry(resource: KeyValueResource, key: Key) -> bool:
        if entry := KeyValueDAO.get_entry(resource, key):
            db.session.delete(entry)
            return True

        return False

    @staticmethod
    def delete_expired_entries(resource: KeyValueResource) -> None:
        (
            db.session.query(KeyValueEntry)
            .filter(
                and_(
                    KeyValueEntry.resource == resource.value,
                    KeyValueEntry.expires_on <= datetime.now(),
                )
            )
            .delete()
        )

    @staticmethod
    def create_entry(
        resource: KeyValueResource,
        value: Any,
        codec: KeyValueCodec,
        key: Key | None = None,
        expires_on: datetime | None = None,
    ) -> KeyValueEntry:
        try:
            encoded_value = codec.encode(value)
        except Exception as ex:
            raise KeyValueCreateFailedError("Unable to encode value") from ex
        entry = KeyValueEntry(
            resource=resource.value,
            value=encoded_value,
            created_on=datetime.now(),
            created_by_fk=get_user_id(),
            expires_on=expires_on,
        )
        if key is not None:
            try:
                if isinstance(key, UUID):
                    entry.uuid = key
                else:
                    entry.id = key
            except ValueError as ex:
                raise KeyValueCreateFailedError() from ex
        db.session.add(entry)
        return entry

    @staticmethod
    def upsert_entry(
        resource: KeyValueResource,
        value: Any,
        codec: KeyValueCodec,
        key: Key,
        expires_on: datetime | None = None,
    ) -> KeyValueEntry:
        if entry := KeyValueDAO.get_entry(resource, key):
            entry.value = codec.encode(value)
            entry.expires_on = expires_on
            entry.changed_on = datetime.now()
            entry.changed_by_fk = get_user_id()
            return entry

        return KeyValueDAO.create_entry(resource, value, codec, key, expires_on)

    @staticmethod
    def update_entry(
        resource: KeyValueResource,
        value: Any,
        codec: KeyValueCodec,
        key: Key,
        expires_on: datetime | None = None,
    ) -> KeyValueEntry:
        if entry := KeyValueDAO.get_entry(resource, key):
            entry.value = codec.encode(value)
            entry.expires_on = expires_on
            entry.changed_on = datetime.now()
            entry.changed_by_fk = get_user_id()
            return entry

        raise KeyValueUpdateFailedError()
