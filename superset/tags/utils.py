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
from typing import List, Optional

from sqlalchemy import Enum

from superset import db
from superset.tags.exceptions import CustomTagNameValidationError
from superset.tags.models import get_tag, ObjectTypes, Tag, TaggedObject, TagTypes


def validate_custom_tags(
    tags: List[str],
) -> bool:
    """
    Validates custom tags.
    It is important that custom tags do not have ":" in them because
    this character is used specifically for the other types of tags
    tags:
        list of names of tags to validate
    """
    for tag in tags:
        if ":" in tag:
            return False
    return True


def add_custom_object_tags(
    tags: List[str],
    object_type: Enum[ObjectTypes],
    object_id: int,
    commit: bool = True,
) -> List[TaggedObject]:
    """
    Add new tags to the dataset. Duplicates are ignored
    tags:
        list of names of tags to apply to object
        if a tag does not exist then it is created
    object_type:
        type of object that the tags are applied to
    object_id:
        id of object of type object_type that the tags are applied to
    """
    if not validate_custom_tags(tags):
        raise CustomTagNameValidationError
    tagged_objects = []
    for tag_str in tags:
        session = db.session
        tag = get_tag(tag_str, session, TagTypes.custom)
        tagged_objects.append(
            TaggedObject(object_id=object_id, object_type=object_type, tag=tag)
        )

    session.add_all(tagged_objects)
    if commit:
        session.commit()
    return tagged_objects


def delete_custom_object_tags(
    object_type: Enum[ObjectTypes],
    object_id: int,
    commit: bool = True,
    tags: Optional[List[str]] = None,
) -> None:
    """
    delete all tagged_objects with custom tags from an object, or only specified "tags"
    object_type:
        type of object that the tags to delete tagged_objects from
    object_id:
        id of object of type object_type to delete tagged_objects from
    tags:
        list of names of tags to be deleted. Default is empty list
    """
    tags_to_delete = db.session.query(Tag).filter(
        Tag.name.in_(tags if tags else []), Tag.type == TagTypes.custom
    )
    # get all current custom tags tagged to this object
    tagged_objects = (
        db.session.query(TaggedObject)
        .join(Tag, Tag.id == TaggedObject.tag_id)
        .filter(
            TaggedObject.object_type == object_type,
            TaggedObject.object_id == object_id,
            Tag.type == TagTypes.custom,
        )
    )
    if tags_to_delete.count() > 0:
        tagged_objects_to_delete = db.session.query(TaggedObject).filter(
            TaggedObject.tag_id.in_([tag.id for tag in tags_to_delete])
        )
    else:
        tagged_objects_to_delete = db.session.query(TaggedObject).filter(
            TaggedObject.tag_id.in_([to.tag_id for to in tagged_objects])
        )
    tagged_objects_to_delete.delete()
    # cleanup tags that have no tagged_objects
    for tag in tags_to_delete:
        tag_objs = db.session.query(TaggedObject).filter(TaggedObject.tag_id == tag.id)
        if tag_objs.count() == 0:
            db.session.query(Tag).filter(Tag.id == tag.id).delete()
    if commit:
        db.session.commit()


def update_custom_object_tags(
    tags: List[str],
    object_type: Enum[ObjectTypes],
    object_id: int,
    commit: bool = True,
    overwrite: bool = False,
) -> List[TaggedObject]:
    """
    Update tags applied to an object
    tags:
        list of names of the tags to apply to the object
        if they do not exist they will be created
    object_type:
        type of object that the tags are applied to
    object_id:
        id of object of type object_type that the tags are applied to
    overwrite:
        if True, delete all current tags applied to the object before
        adding the new ones, otherwise just add the new tags.
        Default is False
    """
    if not validate_custom_tags(tags):
        raise CustomTagNameValidationError
    if overwrite:
        delete_custom_object_tags(object_type, object_id, commit=commit)
    return add_custom_object_tags(tags, object_type, object_id, commit=commit)
