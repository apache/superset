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
# pylint: disable=no-self-argument
from __future__ import annotations

from typing import List

from flask_appbuilder import Model
from flask_appbuilder.security.sqla.models import Role
from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.ext.associationproxy import association_proxy, AssociationProxy
from sqlalchemy.ext.declarative.base import declared_attr
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship, RelationshipProperty


class ObjectRoleAssociation(Model):  # pylint: disable=too-few-public-methods
    __tablename__ = "object_role_associations"
    id = Column("id", Integer, primary_key=True)
    object_id = Column(Integer)
    discriminator = Column("object_type", String(255))
    role_id = Column("role_id", Integer, ForeignKey("ab_role.id"))
    role = relationship(Role)


class HasRolesMixin:
    @declared_attr
    def _roles_associations(cls) -> RelationshipProperty:
        foreign_keys = [ObjectRoleAssociation.object_id]
        return relationship(
            ObjectRoleAssociation,
            foreign_keys=foreign_keys,
            primaryjoin=cls.get_primary_join(),
            cascade="all, delete",
        )

    @declared_attr
    def _roles(cls) -> AssociationProxy: # pylint: disable=method-hidden
        return association_proxy(
            "_roles_associations",
            "role",
            creator=lambda role: ObjectRoleAssociation(
                role=role, discriminator=cls.__name__  # type: ignore
            ),
        )

    @hybrid_property
    def roles(self) -> List[Role]:
        return self._roles

    @roles.setter  # type: ignore
    def roles(self, value: List[Role]):
        self._roles = value

    @classmethod
    def get_primary_join(cls) -> str:
        return (
            "and_(ObjectRoleAssociation.object_id=={class_name}.id, "
            "ObjectRoleAssociation.discriminator=='{"
            "class_name}')".format(class_name=cls.__name__)
        )
