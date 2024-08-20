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
from operator import and_
from typing import Any, Optional

from flask import g
from sqlalchemy.exc import NoResultFound

from superset.commands.tag.exceptions import TagNotFoundError
from superset.commands.tag.utils import to_object_type
from superset.daos.base import BaseDAO
from superset.exceptions import MissingUserContextException
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import SavedQuery
from superset.tags.models import (
    get_tag,
    ObjectType,
    Tag,
    TaggedObject,
    TagType,
    user_favorite_tag_table,
)
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class TagDAO(BaseDAO[Tag]):
    # base_filter = TagAccessFilter

    @staticmethod
    def create_custom_tagged_objects(
        object_type: ObjectType, object_id: int, tag_names: list[str]
    ) -> None:
        tagged_objects = []

        # striping and de-dupping
        clean_tag_names: set[str] = {tag.strip() for tag in tag_names}

        for name in clean_tag_names:
            type_ = TagType.custom
            tag = TagDAO.get_by_name(name, type_)
            tagged_objects.append(
                TaggedObject(object_id=object_id, object_type=object_type, tag=tag)
            )

            # Check if the association already exists
            existing_tagged_object = (
                db.session.query(TaggedObject)
                .filter_by(object_id=object_id, object_type=object_type, tag=tag)
                .first()
            )

            if not existing_tagged_object:
                tagged_objects.append(
                    TaggedObject(object_id=object_id, object_type=object_type, tag=tag)
                )

        db.session.add_all(tagged_objects)

    @staticmethod
    def delete_tagged_object(
        object_type: ObjectType, object_id: int, tag_name: str
    ) -> None:
        """
        deletes a tagged object by the object_id, object_type, and tag_name
        """
        tag = TagDAO.find_by_name(tag_name.strip())
        if not tag:
            raise NoResultFound(message=f"Tag with name {tag_name} does not exist.")

        tagged_object = db.session.query(TaggedObject).filter(
            TaggedObject.tag_id == tag.id,
            TaggedObject.object_type == object_type,
            TaggedObject.object_id == object_id,
        )
        if not tagged_object:
            raise NoResultFound(
                message=f'Tagged object with object_id: {object_id} \
                    object_type: {object_type} \
                    and tag name: "{tag_name}" could not be found'
            )

        db.session.delete(tagged_object.one())

    @staticmethod
    def delete_tags(tag_names: list[str]) -> None:
        """
        deletes tags from a list of tag names
        """
        tags_to_delete = []
        for name in tag_names:
            tag_name = name.strip()
            if not TagDAO.find_by_name(tag_name):
                raise NoResultFound(message=f"Tag with name {tag_name} does not exist.")
            tags_to_delete.append(tag_name)
        tag_objects = db.session.query(Tag).filter(Tag.name.in_(tags_to_delete))

        for tag in tag_objects:
            db.session.delete(tag)

    @staticmethod
    def get_by_name(name: str, type_: TagType = TagType.custom) -> Tag:
        """
        returns a tag if one exists by that name, none otherwise.
        important!: Creates a tag by that name if the tag is not found.
        """
        tag = (
            db.session.query(Tag)
            .filter(Tag.name == name, Tag.type == type_.name)
            .first()
        )
        if not tag:
            tag = get_tag(name, db.session, type_)
        return tag

    @staticmethod
    def find_by_name(name: str) -> Tag:
        """
        returns a tag if one exists by that name, none otherwise.
        Does NOT create a tag if the tag is not found.
        """
        return db.session.query(Tag).filter(Tag.name == name).first()

    @staticmethod
    def find_tagged_object(
        object_type: ObjectType, object_id: int, tag_id: int
    ) -> TaggedObject:
        """
        returns a tagged object if one exists by that name, none otherwise.
        """
        return (
            db.session.query(TaggedObject)
            .filter(
                TaggedObject.tag_id == tag_id,
                TaggedObject.object_id == object_id,
                TaggedObject.object_type == object_type,
            )
            .first()
        )

    @staticmethod
    def get_tagged_objects_by_tag_id(
        tag_ids: Optional[list[int]], obj_types: Optional[list[str]] = None
    ) -> list[dict[str, Any]]:
        tags = db.session.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        tag_names = [tag.name for tag in tags]
        return TagDAO.get_tagged_objects_for_tags(tag_names, obj_types)

    @staticmethod
    def get_tagged_objects_for_tags(
        tags: Optional[list[str]] = None, obj_types: Optional[list[str]] = None
    ) -> list[dict[str, Any]]:
        """
        returns a list of tagged objects filtered by tag names and object types
        if no filters applied returns all tagged objects
        """
        results: list[dict[str, Any]] = []

        # dashboards
        if (not obj_types) or ("dashboard" in obj_types):
            dashboards = (
                db.session.query(Dashboard)
                .join(
                    TaggedObject,
                    and_(
                        TaggedObject.object_id == Dashboard.id,
                        TaggedObject.object_type == ObjectType.dashboard,
                    ),
                )
                .join(Tag, TaggedObject.tag_id == Tag.id)
                .filter(not tags or Tag.name.in_(tags))
            )

            results.extend(
                {
                    "id": obj.id,
                    "type": ObjectType.dashboard.name,
                    "name": obj.dashboard_title,
                    "url": obj.url,
                    "changed_on": obj.changed_on,
                    "created_by": obj.created_by_fk,
                    "creator": obj.creator(),
                    "tags": obj.tags,
                    "owners": obj.owners,
                }
                for obj in dashboards
            )

        # charts
        if (not obj_types) or ("chart" in obj_types):
            charts = (
                db.session.query(Slice)
                .join(
                    TaggedObject,
                    and_(
                        TaggedObject.object_id == Slice.id,
                        TaggedObject.object_type == ObjectType.chart,
                    ),
                )
                .join(Tag, TaggedObject.tag_id == Tag.id)
                .filter(not tags or Tag.name.in_(tags))
            )
            results.extend(
                {
                    "id": obj.id,
                    "type": ObjectType.chart.name,
                    "name": obj.slice_name,
                    "url": obj.url,
                    "changed_on": obj.changed_on,
                    "created_by": obj.created_by_fk,
                    "creator": obj.creator(),
                    "tags": obj.tags,
                    "owners": obj.owners,
                }
                for obj in charts
            )

        # saved queries
        if (not obj_types) or ("query" in obj_types):
            saved_queries = (
                db.session.query(SavedQuery)
                .join(
                    TaggedObject,
                    and_(
                        TaggedObject.object_id == SavedQuery.id,
                        TaggedObject.object_type == ObjectType.query,
                    ),
                )
                .join(Tag, TaggedObject.tag_id == Tag.id)
                .filter(not tags or Tag.name.in_(tags))
            )
            results.extend(
                {
                    "id": obj.id,
                    "type": ObjectType.query.name,
                    "name": obj.label,
                    "url": obj.url(),
                    "changed_on": obj.changed_on,
                    "created_by": obj.created_by_fk,
                    "creator": obj.creator(),
                    "tags": obj.tags,
                    "owners": [obj.creator()],
                }
                for obj in saved_queries
            )
        return results

    @staticmethod
    def favorite_tag_by_id_for_current_user(  # pylint: disable=invalid-name
        tag_id: int,
    ) -> None:
        """
        Marks a specific tag as a favorite for the current user.

        :param tag_id: The id of the tag that is to be marked as favorite
        """

        tag = TagDAO.find_by_id(tag_id)
        user = g.user

        if not user:
            raise MissingUserContextException(message="User doesn't exist")
        if not tag:
            raise TagNotFoundError()

        tag.users_favorited.append(user)

    @staticmethod
    def remove_user_favorite_tag(tag_id: int) -> None:
        """
        Removes a tag from the current user's favorite tags.

        :param tag_id: The id of the tag that is to be removed from the favorite tags
        """
        tag = TagDAO.find_by_id(tag_id)
        user = g.user

        if not user:
            raise MissingUserContextException(message="User doesn't exist")
        if not tag:
            raise TagNotFoundError()

        tag.users_favorited.remove(user)

    @staticmethod
    def favorited_ids(tags: list[Tag]) -> list[int]:
        """
        Returns the IDs of tags that the current user has favorited.

        This function takes in a list of Tag objects, extracts their IDs, and checks
        which of these IDs exist in the user_favorite_tag_table for the current user.
        The function returns a list of these favorited tag IDs.

        Args:
            tags (list[Tag]): A list of Tag objects.

        Returns:
            list[Any]: A list of IDs corresponding to the tags that are favorited by
            the current user.

        Example:
            favorited_ids([tag1, tag2, tag3])
            Output: [tag_id1, tag_id3]   # if the current user has favorited tag1 and tag3
        """
        ids = [tag.id for tag in tags]
        return [
            star.tag_id
            for star in db.session.query(user_favorite_tag_table.c.tag_id)
            .filter(
                user_favorite_tag_table.c.tag_id.in_(ids),
                user_favorite_tag_table.c.user_id == get_user_id(),
            )
            .all()
        ]

    @staticmethod
    def create_tag_relationship(
        objects_to_tag: list[tuple[ObjectType, int]],
        tag: Tag,
        bulk_create: bool = False,
    ) -> None:
        """
        Creates a tag relationship between the given objects and the specified tag.
        This function iterates over a list of objects, each specified by a type
        and an id, and creates a TaggedObject for each one, associating it with
        the provided tag. All created TaggedObjects are collected in a list.
        Args:
            objects_to_tag (List[Tuple[ObjectType, int]]): A list of tuples, each
            containing an ObjectType and an id, representing the objects to be tagged.

            tag (Tag): The tag to be associated with the specified objects.
        Returns:
            None.
        """
        tagged_objects = []
        if not tag:
            raise TagNotFoundError()

        current_tagged_objects = {
            (obj.object_type, obj.object_id) for obj in tag.objects
        }
        updated_tagged_objects = {
            (to_object_type(obj[0]), obj[1]) for obj in objects_to_tag
        }

        tagged_objects_to_delete = (
            current_tagged_objects
            if not objects_to_tag
            else current_tagged_objects - updated_tagged_objects
        )

        for object_type, object_id in updated_tagged_objects:
            # create rows for new objects, and skip tags that already exist
            if (object_type, object_id) not in current_tagged_objects:
                tagged_objects.append(
                    TaggedObject(object_id=object_id, object_type=object_type, tag=tag)
                )

        if not bulk_create:
            # delete relationships that aren't retained from single tag create
            for object_type, object_id in tagged_objects_to_delete:
                # delete objects that were removed
                TagDAO.delete_tagged_object(
                    object_type,  # type: ignore
                    object_id,
                    tag.name,
                )
        db.session.add_all(tagged_objects)
