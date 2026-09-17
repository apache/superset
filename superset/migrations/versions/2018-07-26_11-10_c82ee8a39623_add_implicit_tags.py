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
revision = "c82ee8a39623"
down_revision = "c617da68de7d"

from datetime import datetime  # noqa: E402

from alembic import op  # noqa: E402
from flask_appbuilder.models.mixins import AuditMixin  # noqa: E402
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base, declared_attr  # noqa: E402

from superset.tags.models import ObjectType, TagType  # noqa: E402
from superset.utils.core import get_user_id  # noqa: E402

Base = declarative_base()


class AuditMixinNullable(AuditMixin):
    """Altering the AuditMixin to use nullable fields

    Allows creating objects programmatically outside of CRUD
    """

    created_on = Column(DateTime, default=datetime.now, nullable=True)
    changed_on = Column(
        DateTime, default=datetime.now, onupdate=datetime.now, nullable=True
    )

    @declared_attr
    def created_by_fk(self) -> Column:
        return Column(
            Integer,
            ForeignKey("ab_user.id"),
            default=get_user_id,
            nullable=True,
        )

    @declared_attr
    def changed_by_fk(self) -> Column:
        return Column(
            Integer,
            ForeignKey("ab_user.id"),
            default=get_user_id,
            onupdate=get_user_id,
            nullable=True,
        )


class Tag(Base, AuditMixinNullable):
    """A tag attached to an object (query, chart or dashboard)."""

    __tablename__ = "tag"

    id = Column(Integer, primary_key=True)
    name = Column(String(250), unique=True)
    type = Column(Enum(TagType))


class TaggedObject(AuditMixinNullable, Base):
    __tablename__ = "tagged_object"

    id = Column(Integer, primary_key=True)
    tag_id = Column(Integer, ForeignKey("tag.id"))
    object_id = Column(Integer)
    object_type = Column(Enum(ObjectType))


class User(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "ab_user"
    id = Column(Integer, primary_key=True)


def upgrade():
    bind = op.get_bind()
    Tag.__table__.create(bind)
    TaggedObject.__table__.create(bind)


def downgrade():
    op.drop_table("tagged_object")
    op.drop_table("tag")
