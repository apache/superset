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

from superset.commands.base import BaseCommand, CreateMixin
from superset.daos.exceptions import DAOCreateFailedError
from superset.daos.tag import TagDAO
from superset.tags.commands.exceptions import TagCreateFailedError, TagInvalidError
from superset.tags.commands.utils import to_object_type
from superset.tags.models import ObjectTypes

logger = logging.getLogger(__name__)


class CreateCustomTagCommand(CreateMixin, BaseCommand):
    def __init__(self, object_type: ObjectTypes, object_id: int, tags: list[str]):
        self._object_type = object_type
        self._object_id = object_id
        self._tags = tags

    def run(self) -> None:
        self.validate()
        try:
            object_type = to_object_type(self._object_type)
            if object_type is None:
                raise TagCreateFailedError(f"invalid object type {self._object_type}")
            TagDAO.create_custom_tagged_objects(
                object_type=object_type,
                object_id=self._object_id,
                tag_names=self._tags,
            )
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise TagCreateFailedError() from ex

    def validate(self) -> None:
        exceptions = []
        # Validate object_id
        if self._object_id == 0:
            exceptions.append(TagCreateFailedError())
        # Validate object type
        object_type = to_object_type(self._object_type)
        if not object_type:
            exceptions.append(
                TagCreateFailedError(f"invalid object type {self._object_type}")
            )
        if exceptions:
            raise TagInvalidError(exceptions=exceptions)
