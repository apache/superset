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
# pylint: disable=consider-using-transaction
from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from flask_appbuilder import Model
from sqlalchemy import Column, Enum, ForeignKey, Integer, orm, String, Table, Text
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.orm.mapper import Mapper
from sqlalchemy.schema import UniqueConstraint
from superset_core.common.models import Tag as CoreTag

from superset import security_manager
from superset.models.helpers import AuditMixinNullable

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query

Session = sessionmaker()

user_favorite_tag_table = Table(
    "user_favorite_tag",
    Model.metadata,  # pylint: disable=no-member
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("tag_id", Integer, ForeignKey("tag.id")),
)


class TagType(enum.Enum):
    """
    Types for tags.

    ``type``, ``editor``, and ``favorited_by`` are no longer generated: Superset
    used to auto-tag every query, chart, dashboard, and dataset with implicit
    tags based on metadata (object type, editors, and who favorited them), but
    nothing ever surfaced them to the user, so the generation was removed. The
    values are kept, and rows of these types are still recognized (e.g. exempt
    from bulk deletion) and filterable via the API, so upgraded deployments that
    already have such tags, or MCP tooling that queries by tag type, keep
    working.
    """

    # pylint: disable=invalid-name
    # explicit tags, added manually by the owner
    custom = 1

    # legacy implicit tag types; no longer generated (see docstring above)
    type = 2
    editor = 3
    favorited_by = 4


class ObjectType(enum.Enum):
    """Object types."""

    # pylint: disable=invalid-name
    query = 1
    chart = 2
    dashboard = 3
    dataset = 4


class Tag(CoreTag, AuditMixinNullable):
    """A tag attached to an object (query, chart, dashboard, or dataset)."""

    __tablename__ = "tag"
    id = Column(Integer, primary_key=True)
    name = Column(String(250), unique=True)
    type = Column(Enum(TagType))
    description = Column(Text)

    objects = relationship(
        "TaggedObject",
        back_populates="tag",
        cascade_backrefs=False,
        overlaps="objects,tags",
    )

    users_favorited = relationship(
        security_manager.user_model, secondary=user_favorite_tag_table
    )


class TaggedObject(Model, AuditMixinNullable):
    """An association between an object and a tag."""

    __tablename__ = "tagged_object"
    id = Column(Integer, primary_key=True)
    tag_id = Column(Integer, ForeignKey("tag.id"))
    # ``object_id`` is a polymorphic reference disambiguated by ``object_type``;
    # the same value can point at a dashboard, chart or saved query. It must not
    # carry a foreign key to any single table: declaring FKs to dashboards,
    # slices and saved_query at once is unsatisfiable (a row would have to exist
    # in all three) and breaks tagging, e.g. tagging a dashboard fails the
    # slices FK. The original migration (c82ee8a39623) defined no FK here. See
    # issue #35941.
    object_id = Column(Integer)
    object_type = Column(Enum(ObjectType))

    tag = relationship(
        "Tag",
        back_populates="objects",
        cascade_backrefs=False,
        overlaps="tags",
    )
    __table_args__ = (
        UniqueConstraint(
            "tag_id", "object_id", "object_type", name="uix_tagged_object"
        ),
    )

    def __str__(self) -> str:
        return f"<TaggedObject: {self.object_type}:{self.object_id} TAG:{self.tag_id}>"


def get_tag(
    name: str,
    session: orm.Session,  # pylint: disable=disallowed-name
    type_: TagType,
) -> Tag:
    tag_name = name.strip()
    tag = session.query(Tag).filter_by(name=tag_name, type=type_).one_or_none()
    if tag is None:
        tag = Tag(name=tag_name, type=type_)
        session.add(tag)
        session.commit()
    return tag


class ObjectUpdater:
    """Cleans up ``tagged_object`` rows when a tagged object is deleted.

    ``TaggedObject.object_id`` is a polymorphic reference with no foreign key
    (see the comment on that column), so nothing at the database level removes
    a tag association when the dashboard/chart/query/dataset it points at is
    deleted. This listener does that cleanup for every tag on the object
    (custom tags included), independent of how the tag was created.
    """

    object_type: str = "default"

    @classmethod
    def after_delete(
        cls,
        _mapper: Mapper,
        connection: Connection,
        target: Dashboard | Slice | Query | SqlaTable,
    ) -> None:
        with Session(bind=connection) as session:  # pylint: disable=disallowed-name
            session.query(TaggedObject).filter(
                TaggedObject.object_type == cls.object_type,
                TaggedObject.object_id == target.id,
            ).delete()

            session.commit()


class ChartUpdater(ObjectUpdater):
    object_type = "chart"


class DashboardUpdater(ObjectUpdater):
    object_type = "dashboard"


class QueryUpdater(ObjectUpdater):
    object_type = "query"


class DatasetUpdater(ObjectUpdater):
    object_type = "dataset"
