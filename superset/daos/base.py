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

from typing import Any, Dict, Generic, get_args, List, Optional, Tuple, TypeVar

from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy import asc, desc, or_
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
    def _apply_base_filter(cls, query, skip_base_filter: bool = False, data_model=None):
        """
        Apply the base_filter to the query if it exists and skip_base_filter is False.
        """
        if cls.base_filter and not skip_base_filter:
            if data_model is None:
                data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter( # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query

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
        query = cls._apply_base_filter(query, skip_base_filter)
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
        query = cls._apply_base_filter(query, skip_base_filter)
        return query.all()

    @classmethod
    def find_all(cls) -> list[T]:
        """
        Get all that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        query = cls._apply_base_filter(query)
        return query.all()

    @classmethod
    def find_one_or_none(cls, **filter_by: Any) -> T | None:
        """
        Get the first that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        query = cls._apply_base_filter(query)
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

    @classmethod
    def list(
        cls,
        filters: Optional[Dict[str, Any]] = None,
        order_column: str = "id",
        order_direction: str = "desc",
        page: int = 0,
        page_size: int = 100,
        search: Optional[str] = None,
        search_columns: Optional[List[str]] = None,
        custom_filters: Optional[Dict[str, BaseFilter]] = None,
    ) -> Tuple[List[T], int]:
        """
        Generic list method for filtered, sorted, and paginated results.

        This method provides FAB-compatible query generation using SQLAInterface
        and can be used by any DAO that extends BaseDAO.

        :param filters: Dictionary of simple filters to apply (column_name: value)
        :param order_column: Column to order by (default: 'id')
        :param order_direction: Order direction ('asc' or 'desc')
        :param page: Page number (0-based)
        :param page_size: Number of items per page
        :param search: Search term for text search across search_columns
        :param search_columns: List of columns to search in (if None, uses model's
        searchable columns)
        :param custom_filters: Dictionary of custom FAB filter classes to apply
        :return: Tuple of (items, total_count)
        """

        # Create SQLAInterface instance for FAB-compatible query generation
        data_model = SQLAInterface(cls.model_cls, db.session)

        # Start with base query
        query = data_model.session.query(cls.model_cls)

        # Apply base filter if defined
        query = cls._apply_base_filter(query, data_model=data_model)

        # Apply search filter
        if search and search_columns:
            search_filters = []
            for column_name in search_columns:
                if hasattr(cls.model_cls, column_name):
                    column = getattr(cls.model_cls, column_name)
                    search_filters.append(column.ilike(f"%{search}%"))
            if search_filters:
                query = query.filter(or_(*search_filters))

        # Apply custom FAB filters
        if custom_filters:
            for filter_name, filter_class in custom_filters.items():
                custom_filter = filter_class  # Already an instance
                query = custom_filter.apply(
                    query, filters.get(filter_name) if filters else None)

        # Apply simple filters
        if filters:
            for column_name, value in filters.items():
                # Skip if it's a custom filter (already handled above)
                if custom_filters and column_name in custom_filters:
                    continue

                if hasattr(cls.model_cls, column_name):
                    column = getattr(cls.model_cls, column_name)

                    # Handle different value types
                    if isinstance(value, str) and value.lower() in ('true', 'false'):
                        # Boolean conversion
                        bool_value = value.lower() == 'true'
                        query = query.filter(column == bool_value)
                    elif isinstance(value, (list, tuple)):
                        query = query.filter(column.in_(value))
                    elif value is not None:
                        query = query.filter(column == value)

        # Get total count before pagination
        total_count = query.count()

        # Apply ordering
        if hasattr(cls.model_cls, order_column):
            column = getattr(cls.model_cls, order_column)
            if order_direction.lower() == "desc":
                query = query.order_by(desc(column))
            else:
                query = query.order_by(asc(column))

        # Apply pagination
        query = query.offset(page * page_size).limit(page_size)

        # Execute query
        items = query.all()

        return items, total_count

    @classmethod
    def count(
        cls, filters: Optional[dict] = None, skip_base_filter: bool = False) -> int:
        """
        Count the number of records for the model, optionally filtered by column values.

        :param filters: Dictionary of column_name: value to filter by
        :return: Number of records matching the filter
        """
        data_model = SQLAInterface(cls.model_cls, db.session)
        query = db.session.query(cls.model_cls)
        query = cls._apply_base_filter(query, skip_base_filter=skip_base_filter, data_model=data_model)

        if filters:
            for column_name, value in filters.items():
                if hasattr(cls.model_cls, column_name):
                    column = getattr(cls.model_cls, column_name)
                    if isinstance(value, (list, tuple)):
                        query = query.filter(column.in_(value))
                    else:
                        query = query.filter(column == value)
        return query.count()
