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
from functools import partial
from typing import Any

from superset import security_manager
from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.tag.exceptions import TagCreateFailedError, TagInvalidError
from superset.commands.tag.utils import to_object_model, to_object_type
from superset.daos.tag import TagDAO
from superset.exceptions import SupersetSecurityException
from superset.tags.models import ObjectType, TagType
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateCustomTagCommand(CreateMixin, BaseCommand):
    def __init__(self, object_type: ObjectType, object_id: int, tags: list[str]):
        self._object_type = object_type
        self._object_id = object_id
        self._tags = tags

    @transaction(on_error=partial(on_error, reraise=TagCreateFailedError))
    def run(self) -> None:
        self.validate()
        object_type = to_object_type(self._object_type)
        if object_type is None:
            raise TagCreateFailedError(f"invalid object type {self._object_type}")

        TagDAO.create_custom_tagged_objects(
            object_type=object_type,
            object_id=self._object_id,
            tag_names=self._tags,
        )

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


class CreateCustomTagWithRelationshipsCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any], bulk_create: bool = False):
        self._properties = data.copy()
        self._bulk_create = bulk_create
        self._skipped_tagged_objects: set[tuple[str, int]] = set()

    @transaction(on_error=partial(on_error, reraise=TagCreateFailedError))
    def run(self) -> tuple[set[tuple[str, int]], set[tuple[str, int]]]:
        self.validate()

        tag_name = self._properties["name"]
        tag = TagDAO.get_by_name(tag_name.strip(), TagType.custom)
        TagDAO.create_tag_relationship(
            objects_to_tag=self._properties.get("objects_to_tag", []),
            tag=tag,
            bulk_create=self._bulk_create,
        )

        tag.description = self._properties.get("description", "")
        return set(self._properties["objects_to_tag"]), self._skipped_tagged_objects

    def validate(self) -> None:
        exceptions = []
        objects_to_tag = set(self._properties.get("objects_to_tag", []))
        for obj_type, obj_id in objects_to_tag:
            object_type = to_object_type(obj_type)

            # Validate object type
            for obj_type, obj_id in objects_to_tag:
                object_type = to_object_type(obj_type)

                if not object_type:
                    exceptions.append(
                        TagInvalidError(f"invalid object type {object_type}")
                    )
                try:
                    if model := to_object_model(object_type, obj_id):  # type: ignore
                        security_manager.raise_for_ownership(model)
                except SupersetSecurityException:
                    # skip the object if the user doesn't have access
                    self._skipped_tagged_objects.add((obj_type, obj_id))

            self._properties["objects_to_tag"] = (
                set(objects_to_tag) - self._skipped_tagged_objects
            )

        if exceptions:
            raise TagInvalidError(exceptions=exceptions)
