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
from typing import Any, Dict

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User

from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOException
from superset.key_value.commands.exceptions import KeyValueUpdateFailedError

logger = logging.getLogger(__name__)


class UpdateKeyValueCommand(BaseCommand):
    def __init__(
        self,
        user: User,
        get_dao: Any,
        resource_id: int,
        key: str,
        data: Dict[str, Any],
    ):
        self._actor = user
        self._get_dao = get_dao
        self._resource_id = resource_id
        self._key = key
        self._properties = data.copy()

    def run(self) -> Model:
        try:
            return self._get_dao.update(
                self._resource_id, self._key, self._properties.get("value")
            )
        except DAOException as ex:
            logger.exception(ex.exception)
            raise KeyValueUpdateFailedError() from ex

    def validate(self) -> None:
        pass
