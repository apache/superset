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
import pickle
from datetime import datetime
from typing import Any, Optional, Union
from uuid import UUID

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.base import BaseCommand
from superset.key_value.exceptions import KeyValueUpdateFailedError
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import Key, KeyValueResource
from superset.key_value.utils import get_filter

logger = logging.getLogger(__name__)


class UpdateKeyValueCommand(BaseCommand):
    actor: Optional[User]
    resource: KeyValueResource
    value: Any
    key: Union[int, UUID]
    expires_on: Optional[datetime]

    def __init__(
        self,
        resource: KeyValueResource,
        key: Union[int, UUID],
        value: Any,
        actor: Optional[User] = None,
        expires_on: Optional[datetime] = None,
    ):
        """
        Update a key value entry

        :param resource: the resource (dashboard, chart etc)
        :param key: the key to update
        :param value: the value to persist in the key-value store
        :param actor: the user performing the command
        :param expires_on: entry expiration time
        :return: the key associated with the updated value
        """
        self.actor = actor
        self.resource = resource
        self.key = key
        self.value = value
        self.expires_on = expires_on

    def run(self) -> Optional[Key]:
        try:
            return self.update()
        except SQLAlchemyError as ex:
            db.session.rollback()
            logger.exception("Error running update command")
            raise KeyValueUpdateFailedError() from ex

    def validate(self) -> None:
        pass

    def update(self) -> Optional[Key]:
        filter_ = get_filter(self.resource, self.key)
        entry: KeyValueEntry = (
            db.session.query(KeyValueEntry)
            .filter_by(**filter_)
            .autoflush(False)
            .first()
        )
        if entry:
            entry.value = pickle.dumps(self.value)
            entry.expires_on = self.expires_on
            entry.changed_on = datetime.now()
            entry.changed_by_fk = (
                None if self.actor is None or self.actor.is_anonymous else self.actor.id
            )
            db.session.merge(entry)
            db.session.commit()
            return Key(id=entry.id, uuid=entry.uuid)

        return None
