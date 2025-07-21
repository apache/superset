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
from enum import Enum
from typing import Any, Dict, Generic, get_args, List, Optional, Tuple, TypeVar

from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.models.sqla.interface import SQLAInterface
from pydantic import BaseModel, Field
from sqlalchemy import asc, cast, desc, or_, Text
from sqlalchemy.exc import StatementError
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import ColumnProperty, joinedload, RelationshipProperty

from superset.extensions import db

T = TypeVar("T", bound=Model)


class ColumnOperatorEnum(str, Enum):
    eq = "eq"
    ne = "ne"
    sw = "sw"
    ew = "ew"
    in_ = "in"
    nin = "nin"
    gt = "gt"
    gte = "gte"
    lt = "lt"
    lte = "lte"
    like = "like"
    ilike = "ilike"
    is_null = "is_null"
    is_not_null = "is_not_null"

    @classmethod
    def operator_map(cls) -> Dict[ColumnOperatorEnum, Any]:
        return {
            cls.eq: lambda col, val: col == val,
            cls.ne: lambda col, val: col != val,
            cls.sw: lambda col, val: col.like(f"{val}%"),
            cls.ew: lambda col, val: col.like(f"%{val}"),
            cls.in_: lambda col, val: col.in_(
                val if isinstance(val, (list, tuple)) else [val]
            ),
            cls.nin: lambda col, val: ~col.in_(
                val if isinstance(val, (list, tuple)) else [val]
            ),
            cls.gt: lambda col, val: col > val,
            cls.gte: lambda col, val: col >= val,
            cls.lt: lambda col, val: col < val,
            cls.lte: lambda col, val: col <= val,
            cls.like: lambda col, val: col.like(val),
            cls.ilike: lambda col, val: col.ilike(val),
            cls.is_null: lambda col, _: col.is_(None),
            cls.is_not_null: lambda col, _: col.isnot(None),
        }

    def apply(self, column: Any, value: Any) -> Any:
        op_func = self.operator_map().get(self)
        if not op_func:
            raise ValueError(f"Unsupported operator: {self}")
        return op_func(column, value)


class ColumnOperator(BaseModel):
    col: str = Field(..., description="Column name to filter on")
    opr: ColumnOperatorEnum = Field(..., description="Operator")
    value: Any = Field(None, description="Value for the filter")


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
    def _apply_base_filter(
        cls, query: Any, skip_base_filter: bool = False, data_model: Any = None
    ) -> Any:
        """
        Apply the base_filter to the query if it exists and skip_base_filter is False.
        """
        if cls.base_filter and not skip_base_filter:
            if data_model is None:
                data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
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
    def apply_column_operators(
        cls, query: Any, column_operators: Optional[List[ColumnOperator]] = None
    ) -> Any:
        """
        Apply column operators (list of ColumnOperator) to the query using
        ColumnOperatorEnum logic. Raises ValueError if a filter references a
        non-existent column.
        """
        if not column_operators:
            return query
        for c in column_operators:
            if not isinstance(c, ColumnOperator):
                continue
            col = c.col
            opr = c.opr
            value = c.value
            if not col or not hasattr(cls.model_cls, col):
                model_name = cls.model_cls.__name__ if cls.model_cls else "Unknown"
                logging.error(
                    f"Invalid filter: column '{col}' does not exist on {model_name}"
                )
                raise ValueError(
                    f"Invalid filter: column '{col}' does not exist on {model_name}"
                )
            column = getattr(cls.model_cls, col)
            try:
                # Always use ColumnOperatorEnum's apply method
                operator_enum = ColumnOperatorEnum(opr)
                query = query.filter(operator_enum.apply(column, value))
            except Exception as e:
                logging.error(f"Error applying filter on column '{col}': {e}")
                raise
        return query

    @classmethod
    def get_filterable_columns_and_operators(cls) -> Dict[str, List[str]]:
        """
        Returns a dict mapping filterable columns (including hybrid/computed fields if
        present) to their supported operators. Used by MCP tools to dynamically expose
        filter options. Custom fields supported by the DAO but not present on the model
        should be documented here.
        """
        from sqlalchemy.ext.hybrid import hybrid_property

        mapper = inspect(cls.model_cls)
        columns = {c.key: c for c in mapper.columns}
        # Add hybrid properties
        hybrids = {
            name: attr
            for name, attr in vars(cls.model_cls).items()
            if isinstance(attr, hybrid_property)
        }
        # You may add custom fields here, e.g.:
        # custom_fields = {"tags": ["eq", "in_", "like"], ...}
        custom_fields: Dict[str, List[str]] = {}
        # Map SQLAlchemy types to supported operators
        type_operator_map = {
            "string": [
                "eq",
                "ne",
                "sw",
                "ew",
                "in_",
                "nin",
                "like",
                "ilike",
                "is_null",
                "is_not_null",
            ],
            "boolean": ["eq", "ne", "is_null", "is_not_null"],
            "number": [
                "eq",
                "ne",
                "gt",
                "gte",
                "lt",
                "lte",
                "in_",
                "nin",
                "is_null",
                "is_not_null",
            ],
            "datetime": [
                "eq",
                "ne",
                "gt",
                "gte",
                "lt",
                "lte",
                "in_",
                "nin",
                "is_null",
                "is_not_null",
            ],
        }
        import sqlalchemy as sa

        filterable = {}
        for name, col in columns.items():
            if isinstance(col.type, (sa.String, sa.Text)):
                filterable[name] = type_operator_map["string"]
            elif isinstance(col.type, (sa.Boolean,)):
                filterable[name] = type_operator_map["boolean"]
            elif isinstance(col.type, (sa.Integer, sa.Float, sa.Numeric)):
                filterable[name] = type_operator_map["number"]
            elif isinstance(col.type, (sa.DateTime, sa.Date, sa.Time)):
                filterable[name] = type_operator_map["datetime"]
            else:
                # Fallback to eq/ne/null
                filterable[name] = ["eq", "ne", "is_null", "is_not_null"]
        # Add hybrid properties as string fields by default
        for name in hybrids:
            filterable[name] = type_operator_map["string"]
        # Add custom fields
        filterable.update(custom_fields)
        return filterable

    @classmethod
    def _build_query(
        cls,
        column_operators: Optional[List[ColumnOperator]] = None,
        search: Optional[str] = None,
        search_columns: Optional[List[str]] = None,
        custom_filters: Optional[Dict[str, BaseFilter]] = None,
        skip_base_filter: bool = False,
        data_model: Optional[SQLAInterface] = None,
    ) -> Any:
        """
        Build a SQLAlchemy query with base filter, column operators, search, and
        custom filters.
        """
        if data_model is None:
            data_model = SQLAInterface(cls.model_cls, db.session)
        query = data_model.session.query(cls.model_cls)
        query = cls._apply_base_filter(
            query, skip_base_filter=skip_base_filter, data_model=data_model
        )
        if search and search_columns:
            search_filters = []
            for column_name in search_columns:
                if hasattr(cls.model_cls, column_name):
                    column = getattr(cls.model_cls, column_name)
                    search_filters.append(cast(column, Text).ilike(f"%{search}%"))
            if search_filters:
                query = query.filter(or_(*search_filters))
        if custom_filters:
            for filter_class in custom_filters.values():
                query = filter_class.apply(query, None)
        if column_operators:
            query = cls.apply_column_operators(query, column_operators)
        return query

    @classmethod
    def list(  # noqa: C901
        cls,
        column_operators: Optional[List[ColumnOperator]] = None,
        order_column: str = "changed_on",
        order_direction: str = "desc",
        page: int = 0,
        page_size: int = 100,
        search: Optional[str] = None,
        search_columns: Optional[List[str]] = None,
        custom_filters: Optional[Dict[str, BaseFilter]] = None,
        columns: Optional[List[str]] = None,
    ) -> Tuple[List[Any], int]:
        """
        Generic list method for filtered, sorted, and paginated results.
        If columns is specified, returns a list of tuples (one per row),
        otherwise returns model instances.
        """
        data_model = SQLAInterface(cls.model_cls, db.session)

        column_attrs = []
        relationship_loads = []
        if columns is None:
            columns = []
        for name in columns:
            attr = getattr(cls.model_cls, name, None)
            if attr is None:
                continue
            prop = getattr(attr, "property", None)
            if isinstance(prop, ColumnProperty):
                column_attrs.append(attr)
            elif isinstance(prop, RelationshipProperty):
                relationship_loads.append(joinedload(attr))
            # Ignore properties and other non-queryable attributes

        if relationship_loads:
            # If any relationships are requested, query the full model and joinedload
            # relationships
            query = data_model.session.query(cls.model_cls)
            for loader in relationship_loads:
                query = query.options(loader)
        elif column_attrs:
            # Only columns requested
            query = data_model.session.query(*column_attrs)
        else:
            # Fallback: query the full model
            query = data_model.session.query(cls.model_cls)
        query = cls._apply_base_filter(query, data_model=data_model)
        if search and search_columns:
            search_filters = []
            for column_name in search_columns:
                if hasattr(cls.model_cls, column_name):
                    column = getattr(cls.model_cls, column_name)
                    search_filters.append(cast(column, Text).ilike(f"%{search}%"))
            if search_filters:
                query = query.filter(or_(*search_filters))
        if custom_filters:
            for filter_class in custom_filters.values():
                query = filter_class.apply(query, None)
        if column_operators:
            query = cls.apply_column_operators(query, column_operators)
        total_count = query.count()
        if hasattr(cls.model_cls, order_column):
            column = getattr(cls.model_cls, order_column)
            if order_direction.lower() == "desc":
                query = query.order_by(desc(column))
            else:
                query = query.order_by(asc(column))
        page = page
        page_size = max(page_size, 1)
        query = query.offset(page * page_size).limit(page_size)
        items = query.all()
        # If columns are specified, SQLAlchemy returns Row objects (not tuples or
        # model instances)
        return items, total_count

    @classmethod
    def count(
        cls,
        column_operators: Optional[List[ColumnOperator]] = None,
        skip_base_filter: bool = False,
    ) -> int:
        """
        Count the number of records for the model, optionally filtered by column
        operators.
        """
        query = cls._build_query(
            column_operators=column_operators, skip_base_filter=skip_base_filter
        )
        return query.count()
