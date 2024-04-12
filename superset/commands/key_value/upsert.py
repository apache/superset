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
from typing import Any, Optional, Union
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.base import BaseCommand
from superset.commands.key_value.create import CreateKeyValueCommand
from superset.key_value.exceptions import (
    KeyValueCreateFailedError,
    KeyValueUpsertFailedError,
)
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import Key, KeyValueCodec, KeyValueResource
from superset.key_value.utils import get_filter
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class UpsertKeyValueCommand(BaseCommand):
    resource: KeyValueResource
    value: Any
    key: Union[int, UUID]
    codec: KeyValueCodec
    expires_on: Optional[datetime]

    def __init__(  # pylint: disable=too-many-arguments
        self,
        resource: KeyValueResource,
        key: Union[int, UUID],
        value: Any,
        codec: KeyValueCodec,
        expires_on: Optional[datetime] = None,
    ):
        """
        Upsert a key value entry

        :param resource: the resource (dashboard, chart etc)
        :param key: the key to update
        :param value: the value to persist in the key-value store
        :param codec: codec used to encode the value
        :param expires_on: entry expiration time
        :return: the key associated with the updated value
        """
        self.resource = resource
        self.key = key
        self.value = value
        self.codec = codec
        self.expires_on = expires_on

    def run(self) -> Key:
        try:
            return self.upsert()
        except (KeyValueCreateFailedError, SQLAlchemyError) as ex:
            db.session.rollback()
            raise KeyValueUpsertFailedError() from ex

    def validate(self) -> None:
        pass

    def upsert(self) -> Key:
        filter_ = get_filter(self.resource, self.key)
        entry: KeyValueEntry = (
            db.session.query(KeyValueEntry).filter_by(**filter_).first()
        )
        if entry:
            entry.value = self.codec.encode(self.value)
            entry.expires_on = self.expires_on
            entry.changed_on = datetime.now()
            entry.changed_by_fk = get_user_id()
            db.session.commit()
            return Key(entry.id, entry.uuid)

        return CreateKeyValueCommand(
            resource=self.resource,
            value=self.value,
            codec=self.codec,
            key=self.key,
            expires_on=self.expires_on,
        ).run()
