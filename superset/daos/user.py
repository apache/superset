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
from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

from flask_appbuilder import Model
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import Column, delete, ForeignKey, Table, update

from superset.daos.base import BaseDAO
from superset.extensions import db, security_manager
from superset.models.user_attributes import UserAttribute

logger = logging.getLogger(__name__)

# What happens to a row that references a user when that user is deleted.
#
# * personal state: the user's own rows (favorites, SQL Lab tabs, ...) are
#   deleted along with the user.
# * audit: "who did this" references (``created_by``, ``changed_by``, logs,
#   query history) are cleared. The row itself is kept.
# * undecided: left to the existing behavior until the policy is agreed
#   (``saved_query.user_id``: the ORM cascade on ``User.saved_queries``
#   deletes a user's saved queries along with them).
#
# Classified references are always handled in the application. A foreign key
# that is not classified must declare ``ON DELETE CASCADE`` / ``SET NULL`` and
# is then left to the database; ``test_every_user_reference_is_classified``
# fails when a new foreign key to the user table has neither.
PERSONAL_STATE = "personal_state"
AUDIT = "audit"
UNDECIDED = "undecided"

_AUDIT_COLUMN_NAMES = frozenset({"created_by_fk", "changed_by_fk", "last_saved_by_fk"})
_AUDIT_TABLE_COLUMNS = frozenset({("logs", "user_id"), ("query", "user_id")})
_PERSONAL_STATE_TABLE_COLUMNS = frozenset(
    {
        ("favstar", "user_id"),
        ("tab_state", "user_id"),
        ("user_attribute", "user_id"),
        ("user_favorite_tag", "user_id"),
    }
)
_UNDECIDED_TABLE_COLUMNS = frozenset({("saved_query", "user_id")})
_SELF_REFERENCE_COLUMNS = ("created_by_fk", "changed_by_fk")


def classify_user_reference(table_name: str, column_name: str) -> str | None:
    """Return how a foreign key to the user table is treated on user delete."""
    if column_name in _AUDIT_COLUMN_NAMES or (
        (table_name, column_name) in _AUDIT_TABLE_COLUMNS
    ):
        return AUDIT
    if (table_name, column_name) in _PERSONAL_STATE_TABLE_COLUMNS:
        return PERSONAL_STATE
    if (table_name, column_name) in _UNDECIDED_TABLE_COLUMNS:
        return UNDECIDED
    return None


def user_foreign_keys(user_table: Table) -> Iterator[ForeignKey]:
    """Yield every foreign key in the metadata that points at ``user_table``."""
    for table in Model.metadata.tables.values():
        for foreign_key in table.foreign_keys:
            if foreign_key.column.table is user_table:
                yield foreign_key


class UserDAO(BaseDAO[User]):
    @staticmethod
    def get_by_id(user_id: int) -> User:
        return db.session.query(security_manager.user_model).filter_by(id=user_id).one()

    @staticmethod
    def set_avatar_url(user: User, url: str) -> None:
        if user.extra_attributes:
            user.extra_attributes[0].avatar_url = url
        else:
            attrs = UserAttribute(avatar_url=url, user_id=user.id)
            user.extra_attributes = [attrs]
            db.session.add(attrs)

    @classmethod
    def create(
        cls,
        item: User | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> User:
        user = super().create(item=item, attributes=attributes)
        db.session.flush()
        cls._sync_subject(user)
        return user

    @classmethod
    def update(
        cls,
        item: User | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> User:
        user = super().update(item=item, attributes=attributes)
        cls._sync_subject(user)
        return user

    @classmethod
    def delete(cls, items: list[User]) -> None:
        for item in items:
            cls.release_references(item)
            cls._delete_subject(item.id)
        super().delete(items)

    @classmethod
    def release_references(cls, user: User) -> None:
        """
        Apply the user deletion policy to every row that references ``user``.

        See the comment above ``PERSONAL_STATE`` for the policy. Must run before
        the user row is deleted.
        """
        # A user whose audit column points at itself cannot be ordered for
        # DELETE (``CircularDependencyError``); clear those in the loaded object.
        for column_name in _SELF_REFERENCE_COLUMNS:
            if getattr(user, column_name, None) == user.id:
                setattr(user, column_name, None)
        for foreign_key in user_foreign_keys(user.__table__):
            column = foreign_key.parent
            kind = classify_user_reference(column.table.name, column.name)
            # A classified reference is always handled here, even if the model
            # declares an ``ondelete`` rule: the rule is only what the model
            # says, and a database created by older migrations may not have it.
            if kind == PERSONAL_STATE:
                cls._delete_user_rows(column, user.id)
            elif kind == AUDIT:
                cls._clear_user_reference(column, user.id)
        db.session.flush()

    @staticmethod
    def _delete_user_rows(column: Column[Any], user_id: int) -> None:
        # Go through the ORM where the table is mapped, so that relationship
        # cascades (e.g. ``TabState.table_schemas``) and any mapper-level
        # ``after_delete`` listener registered later still run.
        table = column.table
        mapped_class = next(
            (m.class_ for m in Model.registry.mappers if m.local_table is table),
            None,
        )
        if mapped_class is None:
            db.session.execute(delete(table).where(column == user_id))
            return
        for row in db.session.query(mapped_class).filter(column == user_id).all():
            db.session.delete(row)

    @staticmethod
    def _clear_user_reference(column: Column[Any], user_id: int) -> None:
        # A plain UPDATE would fire the ``onupdate`` default of the other audit
        # columns (``changed_on``, ``changed_by_fk``), making every touched row
        # look as if the current user had just edited it. Set those columns to
        # themselves to keep their values.
        table = column.table
        values: dict[str, Any] = {
            c.name: c
            for c in table.columns
            if c is not column and c.onupdate is not None
        }
        values[column.name] = None
        db.session.execute(update(table).where(column == user_id).values(values))

    @staticmethod
    def _sync_subject(user: User) -> None:
        from superset.subjects.sync import sync_user_subject

        sync_user_subject(user)

    @staticmethod
    def _delete_subject(user_id: int) -> None:
        from superset.subjects.sync import delete_user_subject

        delete_user_subject(user_id)
