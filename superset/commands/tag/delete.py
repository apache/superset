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
from superset.commands.base import BaseCommand
from superset.commands.tag.exceptions import (
    TagDeleteFailedError,
    TaggedObjectDeleteFailedError,
    TaggedObjectNotFoundError,
    TagInvalidError,
    TagNotFoundError,
)
from superset.commands.tag.utils import to_object_model, to_object_type
from superset.daos.tag import TagDAO
from superset.exceptions import SupersetSecurityException
from superset.tags.models import ObjectType
from superset.utils.decorators import on_error, transaction
from superset.views.base import DeleteMixin

logger = logging.getLogger(__name__)


class DeleteTaggedObjectCommand(DeleteMixin, BaseCommand):
    def __init__(self, object_type: ObjectType, object_id: int, tag: str):
        self._object_type = object_type
        self._object_id = object_id
        self._tag = tag

    @transaction(on_error=partial(on_error, reraise=TaggedObjectDeleteFailedError))
    def run(self) -> None:
        self.validate()
        object_type = to_object_type(self._object_type)
        if object_type is None:
            raise TaggedObjectDeleteFailedError(
                f"invalid object type {self._object_type}"
            )
        TagDAO.delete_tagged_object(object_type, self._object_id, self._tag)

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
                # Validate user has access to the target object
                self._validate_object_access(object_type, self._object_id, exceptions)

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

    def _validate_object_access(
        self, object_type: ObjectType, object_id: int, exceptions: list[Any]
    ) -> None:
        """Validate that the current user has access to the target object."""
        # Skip base filter so we can distinguish "not found" from "no access"
        target_object = to_object_model(object_type, object_id, skip_base_filter=True)
        if not target_object:
            # Allow operation on stale references; no object to authorize against
            return

        try:
            if object_type == ObjectType.dashboard:
                security_manager.raise_for_access(dashboard=target_object)
            elif object_type == ObjectType.chart:
                security_manager.raise_for_access(chart=target_object)
            elif object_type == ObjectType.query:
                security_manager.raise_for_access(query=target_object)
            elif object_type == ObjectType.dataset:
                security_manager.raise_for_access(datasource=target_object)
            else:
                exceptions.append(
                    TaggedObjectDeleteFailedError(
                        f"Access validation not supported for {object_type}"
                    )
                )
        except SupersetSecurityException:
            exceptions.append(
                TaggedObjectDeleteFailedError(
                    f"Access denied for {object_type} {object_id}"
                )
            )


class DeleteTagsCommand(DeleteMixin, BaseCommand):
    def __init__(self, tags: list[str]):
        self._tags = tags

    @transaction(on_error=partial(on_error, reraise=TagDeleteFailedError))
    def run(self) -> None:
        self.validate()
        TagDAO.delete_tags(self._tags)

    def validate(self) -> None:
        exceptions = []
        # Validate tag exists
        for tag in self._tags:
            if not TagDAO.find_by_name(tag):
                exceptions.append(TagNotFoundError(tag))
        if exceptions:
            raise TagInvalidError(exceptions=exceptions)
