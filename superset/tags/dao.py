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
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import SQLAlchemyError

from superset.dao.base import BaseDAO
from superset.dao.exceptions import DAOCreateFailedError, DAODeleteFailedError
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import SavedQuery
from superset.tags.models import get_tag, ObjectTypes, Tag, TaggedObject, TagTypes

logger = logging.getLogger(__name__)


class TagDAO(BaseDAO):
    model_cls = Tag
    # base_filter = TagAccessFilter

    @staticmethod
    def validate_tag_name(tag_name: str) -> bool:
        invalid_characters = [":", ","]
        for invalid_character in invalid_characters:
            if invalid_character in tag_name:
                return False
        return True

    @staticmethod
    def create_custom_tagged_objects(
        object_type: ObjectTypes, object_id: int, tag_names: List[str]
    ) -> None:
        tagged_objects = []
        for name in tag_names:
            if not TagDAO.validate_tag_name(name):
                raise DAOCreateFailedError(
                    message="Invalid Tag Name (cannot contain ':' or ',')"
                )
            type_ = TagTypes.custom
            tag_name = name.strip()
            tag = TagDAO.get_by_name(tag_name, type_)
            tagged_objects.append(
                TaggedObject(object_id=object_id, object_type=object_type, tag=tag)
            )

        db.session.add_all(tagged_objects)
        db.session.commit()

    @staticmethod
    def delete_tagged_object(
        object_type: ObjectTypes, object_id: int, tag_name: str
    ) -> None:
        """
        deletes a tagged object by the object_id, object_type, and tag_name
        """
        tag = TagDAO.find_by_name(tag_name.strip())
        if not tag:
            raise DAODeleteFailedError(
                message=f"Tag with name {tag_name} does not exist."
            )

        tagged_object = db.session.query(TaggedObject).filter(
            TaggedObject.tag_id == tag.id,
            TaggedObject.object_type == object_type,
            TaggedObject.object_id == object_id,
        )
        if not tagged_object:
            raise DAODeleteFailedError(
                message=f'Tagged object with object_id: {object_id} \
                    object_type: {object_type} \
                    and tag name: "{tag_name}" could not be found'
            )
        try:
            db.session.delete(tagged_object.one())
            db.session.commit()
        except SQLAlchemyError as ex:  # pragma: no cover
            db.session.rollback()
            raise DAODeleteFailedError(exception=ex) from ex

    @staticmethod
    def delete_tags(tag_names: List[str]) -> None:
        """
        deletes tags from a list of tag names
        """
        tags_to_delete = []
        for name in tag_names:
            tag_name = name.strip()
            if not TagDAO.find_by_name(tag_name):
                raise DAODeleteFailedError(
                    message=f"Tag with name {tag_name} does not exist."
                )
            tags_to_delete.append(tag_name)
        tag_objects = db.session.query(Tag).filter(Tag.name.in_(tags_to_delete))
        for tag in tag_objects:
            try:
                db.session.delete(tag)
                db.session.commit()
            except SQLAlchemyError as ex:  # pragma: no cover
                db.session.rollback()
                raise DAODeleteFailedError(exception=ex) from ex

    @staticmethod
    def get_by_name(name: str, type_: TagTypes = TagTypes.custom) -> Tag:
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
        object_type: ObjectTypes, object_id: int, tag_id: int
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
    def get_tagged_objects_for_tags(
        tags: Optional[List[str]] = None, obj_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        returns a list of tagged objects filtered by tag names and object types
        if no filters applied returns all tagged objects
        """
        # id = fields.Int()
        # type = fields.String()
        # name = fields.String()
        # url = fields.String()
        # changed_on = fields.DateTime()
        # created_by = fields.Nested(UserSchema)
        # creator = fields.String(

        # filter types

        results: List[Dict[str, Any]] = []

        # dashboards
        if (not obj_types) or ("dashboard" in obj_types):
            dashboards = (
                db.session.query(Dashboard)
                .join(
                    TaggedObject,
                    and_(
                        TaggedObject.object_id == Dashboard.id,
                        TaggedObject.object_type == ObjectTypes.dashboard,
                    ),
                )
                .join(Tag, TaggedObject.tag_id == Tag.id)
                .filter(not tags or Tag.name.in_(tags))
            )

            results.extend(
                {
                    "id": obj.id,
                    "type": ObjectTypes.dashboard.name,
                    "name": obj.dashboard_title,
                    "url": obj.url,
                    "changed_on": obj.changed_on,
                    "created_by": obj.created_by_fk,
                    "creator": obj.creator(),
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
                        TaggedObject.object_type == ObjectTypes.chart,
                    ),
                )
                .join(Tag, TaggedObject.tag_id == Tag.id)
                .filter(not tags or Tag.name.in_(tags))
            )
            results.extend(
                {
                    "id": obj.id,
                    "type": ObjectTypes.chart.name,
                    "name": obj.slice_name,
                    "url": obj.url,
                    "changed_on": obj.changed_on,
                    "created_by": obj.created_by_fk,
                    "creator": obj.creator(),
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
                        TaggedObject.object_type == ObjectTypes.query,
                    ),
                )
                .join(Tag, TaggedObject.tag_id == Tag.id)
                .filter(not tags or Tag.name.in_(tags))
            )
            results.extend(
                {
                    "id": obj.id,
                    "type": ObjectTypes.query.name,
                    "name": obj.label,
                    "url": obj.url(),
                    "changed_on": obj.changed_on,
                    "created_by": obj.created_by_fk,
                    "creator": obj.creator(),
                }
                for obj in saved_queries
            )
        return results
