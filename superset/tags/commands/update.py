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
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model

from superset import db
from superset.commands.base import BaseCommand, UpdateMixin
from superset.daos.tag import TagDAO
from superset.tags.commands.exceptions import TagInvalidError, TagNotFoundError
from superset.tags.commands.utils import to_object_type
from superset.tags.models import Tag

logger = logging.getLogger(__name__)


class UpdateTagCommand(UpdateMixin, BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Tag] = None

    def run(self) -> Model:
        self.validate()
        if self._model:
            if self._properties.get("objects_to_tag"):
                # todo(hugh): can this manage duplication
                TagDAO.create_tag_relationship(
                    objects_to_tag=self._properties["objects_to_tag"],
                    tag=self._model,
                )
            if description := self._properties.get("description"):
                self._model.description = description
            if tag_name := self._properties.get("name"):
                self._model.name = tag_name

            db.session.add(self._model)
            db.session.commit()

        return self._model

    def validate(self) -> None:
        exceptions = []
        # Validate/populate model exists
        self._model = TagDAO.find_by_id(self._model_id)
        if not self._model:
            raise TagNotFoundError()

        # Validate object_id
        if objects_to_tag := self._properties.get("objects_to_tag"):
            if any(obj_id == 0 for obj_type, obj_id in objects_to_tag):
                exceptions.append(TagInvalidError(" invalid object_id"))

            # Validate object type
            for obj_type, obj_id in objects_to_tag:
                object_type = to_object_type(obj_type)
                if not object_type:
                    exceptions.append(
                        TagInvalidError(f"invalid object type {object_type}")
                    )

        if exceptions:
            raise TagInvalidError(exceptions=exceptions)
