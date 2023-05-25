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
from typing import List

from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAODeleteFailedError
from superset.tags.commands.exceptions import (
    TagDeleteFailedError,
    TaggedObjectDeleteFailedError,
    TaggedObjectNotFoundError,
    TagInvalidError,
    TagNotFoundError,
)
from superset.tags.commands.utils import to_object_type
from superset.tags.dao import TagDAO
from superset.tags.models import ObjectTypes
from superset.views.base import DeleteMixin

logger = logging.getLogger(__name__)


class DeleteTaggedObjectCommand(DeleteMixin, BaseCommand):
    def __init__(self, object_type: ObjectTypes, object_id: int, tag: str):
        self._object_type = object_type
        self._object_id = object_id
        self._tag = tag

    def run(self) -> None:
        self.validate()
        try:
            object_type = to_object_type(self._object_type)
            if object_type is None:
                raise TaggedObjectDeleteFailedError(
                    f"invalid object type {self._object_type}"
                )
            TagDAO.delete_tagged_object(object_type, self._object_id, self._tag)
        except DAODeleteFailedError as ex:
            logger.exception(ex.exception)
            raise TaggedObjectDeleteFailedError() from ex

    def validate(self) -> None:
        exceptions = []
        # Validate required arguments provided
        if not (self._object_id and self._object_type):
            exceptions.append(TaggedObjectDeleteFailedError())
        # Validate tagged object exists
        tag = TagDAO.find_by_name(self._tag)
        if not tag:
            exceptions.append(
                TaggedObjectDeleteFailedError(f"could not find tag: {self._tag}")
            )
        else:
            # Validate object type
            object_type = to_object_type(self._object_type)
            if object_type is None:
                exceptions.append(
                    TaggedObjectDeleteFailedError(
                        f"invalid object type {self._object_type}"
                    )
                )
            else:
                tagged_object = TagDAO.find_tagged_object(
                    object_type=object_type, object_id=self._object_id, tag_id=tag.id
                )
                if tagged_object is None:
                    exceptions.append(
                        TaggedObjectNotFoundError(
                            object_id=self._object_id,
                            object_type=object_type.name,
                            tag_name=self._tag,
                        )
                    )
        if exceptions:
            raise TagInvalidError(exceptions=exceptions)


class DeleteTagsCommand(DeleteMixin, BaseCommand):
    def __init__(self, tags: List[str]):
        self._tags = tags

    def run(self) -> None:
        self.validate()
        try:
            TagDAO.delete_tags(self._tags)
        except DAODeleteFailedError as ex:
            logger.exception(ex.exception)
            raise TagDeleteFailedError() from ex

    def validate(self) -> None:
        exceptions = []
        # Validate tag exists
        for tag in self._tags:
            if not TagDAO.find_by_name(tag):
                exceptions.append(TagNotFoundError(tag))
        if exceptions:
            raise TagInvalidError(exceptions=exceptions)
