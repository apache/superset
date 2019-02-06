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
"""Add implicit tags

Revision ID: c82ee8a39623
Revises: c18bd4186f15
Create Date: 2018-07-26 11:10:23.653524

"""

# revision identifiers, used by Alembic.
revision = 'c82ee8a39623'
down_revision = 'c617da68de7d'

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Column, Enum, Integer, ForeignKey, String, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from superset import db
from superset.models.helpers import AuditMixinNullable
from superset.models.tags import (
    get_object_type,
    get_tag,
    ObjectTypes,
    TagTypes,
)


Base = declarative_base()


class Tag(Base, AuditMixinNullable):
    """A tag attached to an object (query, chart or dashboard)."""
    __tablename__ = 'tag'

    id = Column(Integer, primary_key=True)
    name = Column(String(250), unique=True)
    type = Column(Enum(TagTypes))


class TaggedObject(Base, AuditMixinNullable):
    __tablename__ = 'tagged_object'

    id = Column(Integer, primary_key=True)
    tag_id = Column(Integer, ForeignKey('tag.id'))
    object_id = Column(Integer)
    object_type = Column(Enum(ObjectTypes))


class User(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'ab_user'
    id = Column(Integer, primary_key=True)


slice_user = Table(
    'slice_user',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('slice_id', Integer, ForeignKey('slices.id'))
)


dashboard_user = Table(
    'dashboard_user',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('ab_user.id')),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id'))
)


class Slice(Base, AuditMixinNullable):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'slices'

    id = Column(Integer, primary_key=True)
    owners = relationship("User", secondary=slice_user)


class Dashboard(Base, AuditMixinNullable):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    owners = relationship("User", secondary=dashboard_user)


class SavedQuery(Base):
    __tablename__ = 'saved_query'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('ab_user.id'))


class Favstar(Base):
    __tablename__ = 'favstar'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('ab_user.id'))
    class_name = Column(String(50))
    obj_id = Column(Integer)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    Tag.__table__.create(bind)
    TaggedObject.__table__.create(bind)

    # add type tags (eg, `type:dashboard` for dashboards)
    for type in ObjectTypes.__members__:
        session.add(Tag(name='type:{0}'.format(type), type=TagTypes.type))

    # add owner tags (eg, `owner:1` for things owned by the admin)
    for chart in session.query(Slice):
        for owner in chart.owners:
            name = 'owner:{0}'.format(owner.id)
            tag = get_tag(name, session, TagTypes.owner)
            tagged_object = TaggedObject(
                tag_id=tag.id,
                object_id=chart.id,
                object_type=ObjectTypes.chart,
            )
            session.add(tagged_object)

        tag = get_tag('type:chart', session, TagTypes.type)
        tagged_object = TaggedObject(
            tag_id=tag.id,
            object_id=chart.id,
            object_type=ObjectTypes.chart,
        )
        session.add(tagged_object)

    for dashboard in session.query(Dashboard):
        for owner in dashboard.owners:
            name = 'owner:{0}'.format(owner.id)
            tag = get_tag(name, session, TagTypes.owner)
            tagged_object = TaggedObject(
                tag_id=tag.id,
                object_id=dashboard.id,
                object_type=ObjectTypes.dashboard,
            )
            session.add(tagged_object)

        tag = get_tag('type:dashboard', session, TagTypes.type)
        tagged_object = TaggedObject(
            tag_id=tag.id,
            object_id=dashboard.id,
            object_type=ObjectTypes.dashboard,
        )
        session.add(tagged_object)

    for query in session.query(SavedQuery):
        name = 'owner:{0}'.format(query.user_id)
        tag = get_tag(name, session, TagTypes.owner)
        tagged_object = TaggedObject(
            tag_id=tag.id,
            object_id=query.id,
            object_type=ObjectTypes.query,
        )
        session.add(tagged_object)

        tag = get_tag('type:query', session, TagTypes.type)
        tagged_object = TaggedObject(
            tag_id=tag.id,
            object_id=query.id,
            object_type=ObjectTypes.query,
        )
        session.add(tagged_object)

    # add favorited_by tags
    for star in session.query(Favstar):
        name = 'favorited_by:{0}'.format(star.user_id)
        tag = get_tag(name, session, TagTypes.favorited_by)
        tagged_object = TaggedObject(
            tag_id=tag.id,
            object_id=star.obj_id,
            object_type=get_object_type(star.class_name),
        )
        session.add(tagged_object)

    session.commit()


def downgrade():
    op.drop_table('tag')
    op.drop_table('tagged_object')
