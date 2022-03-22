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

from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.base import BaseCommand
from superset.key_value.exceptions import KeyValueGetFailedError
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyType
from superset.key_value.utils import get_filter

logger = logging.getLogger(__name__)


class GetKeyValueCommand(BaseCommand):
    key: str
    key_type: KeyType
    resource: str

    def __init__(self, resource: str, key: str, key_type: KeyType = "uuid"):
        """
        Retrieve a key value entry

        :param resource: the resource (dashboard, chart etc)
        :param key: the key to retrieve
        :param key_type: the type of the key to retrieve
        :return: the value associated with the key if present
        """
        self.resource = resource
        self.key = key
        self.key_type = key_type

    def run(self) -> Any:
        try:
            return self.get()
        except SQLAlchemyError as ex:
            logger.exception("Error running get command")
            raise KeyValueGetFailedError() from ex

    def validate(self) -> None:
        pass

    def get(self) -> Optional[Any]:
        filter_ = get_filter(self.resource, self.key, self.key_type)
        entry = (
            db.session.query(KeyValueEntry)
            .filter_by(**filter_)
            .autoflush(False)
            .first()
        )
        if entry and (entry.expires_on is None or entry.expires_on > datetime.now()):
            return pickle.loads(entry.value)
        return None
