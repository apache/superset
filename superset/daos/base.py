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

from typing import Any, Generic, get_args, TypeVar

from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.exc import StatementError

from superset.extensions import db

T = TypeVar("T", bound=Model)


class BaseDAO(Generic[T]):
    """
    Base DAO, implement base CRUD sqlalchemy operations
    """

    model_cls: type[Model] | None = None
    """
    Child classes need to state the Model class so they don't need to implement basic
    create, update and delete methods
    """
    base_filter: BaseFilter | None = None
    """
    Child classes can register base filtering to be applied to all filter methods
    """
    id_column_name = "id"

    def __init_subclass__(cls) -> None:
        cls.model_cls = get_args(
            cls.__orig_bases__[0]  # type: ignore  # pylint: disable=no-member
        )[0]

    @classmethod
    def find_by_id(
        cls,
        model_id: str | int,
        skip_base_filter: bool = False,
    ) -> T | None:
        """
        Find a model by id, if defined applies `base_filter`
        """
        query = db.session.query(cls.model_cls)
        if cls.base_filter and not skip_base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        id_column = getattr(cls.model_cls, cls.id_column_name)
        try:
            return query.filter(id_column == model_id).one_or_none()
        except StatementError:
            # can happen if int is passed instead of a string or similar
            return None

    @classmethod
    def find_by_ids(
        cls,
        model_ids: list[str] | list[int],
        skip_base_filter: bool = False,
    ) -> list[T]:
        """
        Find a List of models by a list of ids, if defined applies `base_filter`
        """
        id_col = getattr(cls.model_cls, cls.id_column_name, None)
        if id_col is None:
            return []
        query = db.session.query(cls.model_cls).filter(id_col.in_(model_ids))
        if cls.base_filter and not skip_base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query.all()

    @classmethod
    def find_all(cls) -> list[T]:
        """
        Get all that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        if cls.base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query.all()

    @classmethod
    def find_one_or_none(cls, **filter_by: Any) -> T | None:
        """
        Get the first that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        if cls.base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query.filter_by(**filter_by).one_or_none()

    @classmethod
    def create(
        cls,
        item: T | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> T:
        """
        Create an object from the specified item and/or attributes.

        :param item: The object to create
        :param attributes: The attributes associated with the object to create
        """

        if not item:
            item = cls.model_cls()  # type: ignore  # pylint: disable=not-callable

        if attributes:
            for key, value in attributes.items():
                setattr(item, key, value)

        db.session.add(item)
        return item  # type: ignore

    @classmethod
    def update(
        cls,
        item: T | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> T:
        """
        Update an object from the specified item and/or attributes.

        :param item: The object to update
        :param attributes: The attributes associated with the object to update
        """

        if not item:
            item = cls.model_cls()  # type: ignore  # pylint: disable=not-callable

        if attributes:
            for key, value in attributes.items():
                setattr(item, key, value)

        if item not in db.session:
            return db.session.merge(item)

        return item  # type: ignore

    @classmethod
    def delete(cls, items: list[T]) -> None:
        """
        Delete the specified items including their associated relationships.

        Note that bulk deletion via `delete` is not invoked in the base class as this
        does not dispatch the ORM `after_delete` event which may be required to augment
        additional records loosely defined via implicit relationships. Instead ORM
        objects are deleted one-by-one via `Session.delete`.

        Subclasses may invoke bulk deletion but are responsible for instrumenting any
        post-deletion logic.

        :param items: The items to delete
        :see: https://docs.sqlalchemy.org/en/latest/orm/queryguide/dml.html
        """

        for item in items:
            db.session.delete(item)
