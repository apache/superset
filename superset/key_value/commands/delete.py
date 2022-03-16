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

from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.base import BaseCommand
from superset.key_value.exceptions import KeyValueDeleteFailedError
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyType
from superset.key_value.utils import get_filter

logger = logging.getLogger(__name__)


class DeleteKeyValueCommand(BaseCommand):
    actor: User
    key: str
    key_type: KeyType
    resource: str

    def __init__(
        self, actor: User, resource: str, key: str, key_type: KeyType = "uuid"
    ):
        """
        Delete a key-value pair

        :param resource: the resource (dashboard, chart etc)
        :param key: the key to delete
        :param key_type: the type of key
        :return: was the entry deleted or not
        """
        self.resource = resource
        self.actor = actor
        self.key = key
        self.key_type = key_type

    def run(self) -> bool:
        try:
            return self.delete()
        except SQLAlchemyError as ex:
            logger.exception("Error running delete command")
            raise KeyValueDeleteFailedError() from ex

    def validate(self) -> None:
        pass

    def delete(self) -> bool:
        filter_ = get_filter(self.resource, self.key, self.key_type)
        entry = (
            db.session.query(KeyValueEntry)
            .filter_by(**filter_)
            .autoflush(False)
            .first()
        )
        if entry:
            db.session.delete(entry)
            db.session.commit()
            return True
        return False
