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
from typing import Any, Optional

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.base import BaseCommand
from superset.key_value.exceptions import KeyValueCreateFailedError
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyType
from superset.key_value.utils import extract_key

logger = logging.getLogger(__name__)


class CreateKeyValueCommand(BaseCommand):
    actor: User
    resource: str
    value: Any
    key_type: KeyType
    expires_on: Optional[datetime]

    def __init__(
        self,
        actor: User,
        resource: str,
        value: Any,
        key_type: KeyType,
        expires_on: Optional[datetime] = None,
    ):
        """
        Create a new key-value pair

        :param resource: the resource (dashboard, chart etc)
        :param value: the value to persist in the key-value store
        :param key_type: the type of the key to return
        :param expires_on: entry expiration time
        :return: the key associated with the persisted value
        """
        self.resource = resource
        self.actor = actor
        self.value = value
        self.key_type = key_type
        self.expires_on = expires_on

    def run(self) -> str:
        try:
            return self.create()
        except SQLAlchemyError as ex:
            logger.exception("Error running create command")
            raise KeyValueCreateFailedError() from ex

    def validate(self) -> None:
        pass

    def create(self) -> str:
        entry = KeyValueEntry(
            resource=self.resource,
            value=pickle.dumps(self.value),
            created_on=datetime.now(),
            created_by_fk=None if self.actor.is_anonymous else self.actor.id,
            expires_on=self.expires_on,
        )
        db.session.add(entry)
        db.session.commit()
        return extract_key(entry, self.key_type)
