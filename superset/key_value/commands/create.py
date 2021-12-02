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
from abc import ABC, abstractmethod
from secrets import token_urlsafe
from typing import Optional

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.key_value.commands.exceptions import KeyValueCreateFailedError

logger = logging.getLogger(__name__)


class CreateKeyValueCommand(BaseCommand, ABC):
    def __init__(
        self, user: User, resource_id: int, value: str,
    ):
        self._actor = user
        self._resource_id = resource_id
        self._value = value

    def run(self) -> Model:
        try:
            key = token_urlsafe(48)
            self.create(self._resource_id, key, self._value)
            return key
        except SQLAlchemyError as ex:
            logger.exception("Error running create command")
            raise KeyValueCreateFailedError() from ex

    def validate(self) -> None:
        pass

    @abstractmethod
    def create(self, resource_id: int, key: str, value: str) -> Optional[bool]:
        ...
