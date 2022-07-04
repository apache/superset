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

from superset.commands.base import BaseCommand, CreateMixin
from superset.dao.exceptions import DAOCreateFailedError
from superset.models.tags import ObjectTypes
from superset.tags.commands.exceptions import (
    TagCreateFailedError,
    TagInvalidError,
)
from superset.tags.dao import TagDAO

logger = logging.getLogger(__name__)


class CreateTagCommand(CreateMixin, BaseCommand):
    def __init__(self, object_type: ObjectTypes, object_id: int, data: Dict[str, Any]):
        self._object_type = object_type
        self._object_id = object_id
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        try:
            tag = TagDAO.create_tagged_objects(self._object_type, self._object_id, self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise TagCreateFailedError() from ex
        return tag

    def validate(self) -> None:
        exceptions = []

        # Validate object_id
        if self._object_id == 0:
            exceptions.append(TagCreateFailedError())

        if exceptions:
            exception = TagInvalidError()
            exception.add_list(exceptions)
            raise exception
