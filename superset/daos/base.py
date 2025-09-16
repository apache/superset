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
import uuid as uuid_lib
from enum import Enum
from typing import (
    Any,
    Dict,
    Generic,
    get_args,
    List,
    Optional,
    Sequence,
    Tuple,
    TypeVar,
)

import sqlalchemy as sa
from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.models.sqla import Model
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_sqlalchemy import BaseQuery
from pydantic import BaseModel, Field
from sqlalchemy import asc, cast, desc, or_, Text
from sqlalchemy.exc import SQLAlchemyError, StatementError
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import ColumnProperty, joinedload, RelationshipProperty

from superset.daos.exceptions import (
    DAOFindFailedError,
)
from superset.extensions import db

logger = logging.getLogger(__name__)

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

    def apply(self, column: Any, value: Any) -> Any:
        op_func = operator_map.get(self)
        if not op_func:
            raise ValueError("Unsupported operator: %s" % self)
        return op_func(column, value)


# Define operator_map as a module-level dict after the enum is defined
operator_map: Dict[ColumnOperatorEnum, Any] = {
    ColumnOperatorEnum.eq: lambda col, val: col == val,
    ColumnOperatorEnum.ne: lambda col, val: col != val,
    ColumnOperatorEnum.sw: lambda col, val: col.like(f"{val}%"),
    ColumnOperatorEnum.ew: lambda col, val: col.like(f"%{val}"),
    ColumnOperatorEnum.in_: lambda col, val: col.in_(
        val if isinstance(val, (list, tuple)) else [val]
    ),
    ColumnOperatorEnum.nin: lambda col, val: ~col.in_(
        val if isinstance(val, (list, tuple)) else [val]
    ),
    ColumnOperatorEnum.gt: lambda col, val: col > val,
    ColumnOperatorEnum.gte: lambda col, val: col >= val,
    ColumnOperatorEnum.lt: lambda col, val: col < val,
    ColumnOperatorEnum.lte: lambda col, val: col <= val,
    ColumnOperatorEnum.like: lambda col, val: col.like(f"%{val}%"),
    ColumnOperatorEnum.ilike: lambda col, val: col.ilike(f"%{val}%"),
    ColumnOperatorEnum.is_null: lambda col, _: col.is_(None),
    ColumnOperatorEnum.is_not_null: lambda col, _: col.isnot(None),
}

# Map SQLAlchemy types to supported operators
TYPE_OPERATOR_MAP = {
    "string": [
        ColumnOperatorEnum.eq,
        ColumnOperatorEnum.ne,
        ColumnOperatorEnum.sw,
        ColumnOperatorEnum.ew,
        ColumnOperatorEnum.in_,
        ColumnOperatorEnum.nin,
        ColumnOperatorEnum.like,
        ColumnOperatorEnum.ilike,
        ColumnOperatorEnum.is_null,
        ColumnOperatorEnum.is_not_null,
    ],
    "boolean": [
        ColumnOperatorEnum.eq,
        ColumnOperatorEnum.ne,
        ColumnOperatorEnum.is_null,
        ColumnOperatorEnum.is_not_null,
    ],
    "number": [
        ColumnOperatorEnum.eq,
        ColumnOperatorEnum.ne,
        ColumnOperatorEnum.gt,
        ColumnOperatorEnum.gte,
        ColumnOperatorEnum.lt,
        ColumnOperatorEnum.lte,
        ColumnOperatorEnum.in_,
        ColumnOperatorEnum.nin,
        ColumnOperatorEnum.is_null,
        ColumnOperatorEnum.is_not_null,
    ],
    "datetime": [
        ColumnOperatorEnum.eq,
        ColumnOperatorEnum.ne,
        ColumnOperatorEnum.gt,
        ColumnOperatorEnum.gte,
        ColumnOperatorEnum.lt,
        ColumnOperatorEnum.lte,
        ColumnOperatorEnum.in_,
        ColumnOperatorEnum.nin,
        ColumnOperatorEnum.is_null,
        ColumnOperatorEnum.is_not_null,
    ],
}


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
    uuid_column_name = "uuid"

    def __init_subclass__(cls) -> None:
        cls.model_cls = get_args(
            cls.__orig_bases__[0]  # type: ignore  # pylint: disable=no-member
        )[0]

    @classmethod
    def find_by_id_or_uuid(
        cls,
        model_id_or_uuid: str,
        skip_base_filter: bool = False,
    ) -> T | None:
        """
        Find a model by id or uuid, if defined applies `base_filter`
        """
        query = db.session.query(cls.model_cls)
        if cls.base_filter and not skip_base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        id_column = getattr(cls.model_cls, cls.id_column_name)
        uuid_column = getattr(cls.model_cls, cls.uuid_column_name)

        if model_id_or_uuid.isdigit():
            filter = id_column == int(model_id_or_uuid)
        else:
            filter = uuid_column == model_id_or_uuid
        try:
            return query.filter(filter).one_or_none()
        except StatementError:
            # can happen if neither uuid nor int is passed
            return None

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
    def _convert_value_for_column(cls, column: Any, value: Any) -> Any:
        """
        Convert a value to the appropriate type for a given SQLAlchemy column.

        Args:
            column: SQLAlchemy column object
            value: Value to convert

        Returns:
            Converted value or None if conversion fails
        """
        if (
            hasattr(column.type, "python_type")
            and column.type.python_type == uuid_lib.UUID
        ):
            if isinstance(value, str):
                try:
                    return uuid_lib.UUID(value)
                except (ValueError, AttributeError):
                    return None
        return value

    @classmethod
    def _find_by_column(
        cls,
        column_name: str,
        value: str | int,
        skip_base_filter: bool = False,
    ) -> T | None:
        """
        Private method to find a model by any column value.

        Args:
            column_name: Name of the column to search by
            value: Value to search for
            skip_base_filter: Whether to skip base filtering

        Returns:
            Model instance or None if not found
        """
        query = db.session.query(cls.model_cls)
        query = cls._apply_base_filter(query, skip_base_filter)

        if not hasattr(cls.model_cls, column_name):
            return None

        column = getattr(cls.model_cls, column_name)
        converted_value = cls._convert_value_for_column(column, value)
        if converted_value is None:
            return None

        try:
            return query.filter(column == converted_value).one_or_none()
        except StatementError:
            # can happen if int is passed instead of a string or similar
            return None

    @classmethod
    def find_by_id(
        cls,
        model_id: str | int,
        skip_base_filter: bool = False,
        id_column: str | None = None,
    ) -> T | None:
        """
        Find a model by ID using specified or default ID column.

        Args:
            model_id: ID value to search for
            skip_base_filter: Whether to skip base filtering
            id_column: Column name to use (defaults to cls.id_column_name)

        Returns:
            Model instance or None if not found
        """
        column = id_column or cls.id_column_name
        return cls._find_by_column(column, model_id, skip_base_filter)

    @classmethod
    def find_by_ids(
        cls,
        model_ids: Sequence[str | int],
        skip_base_filter: bool = False,
        id_column: str | None = None,
    ) -> list[T]:
        """
        Find a List of models by a list of ids, if defined applies `base_filter`

        :param model_ids: List of IDs to find
        :param skip_base_filter: If true, skip applying the base filter
        :param id_column: Optional column name to use for ID lookup
                         (defaults to id_column_name)
        """
        column = id_column or cls.id_column_name
        id_col = getattr(cls.model_cls, column, None)
        if id_col is None or not model_ids:
            return []

        # Convert IDs to appropriate types based on column type
        converted_ids: list[str | int | uuid_lib.UUID] = []
        for id_val in model_ids:
            converted_value = cls._convert_value_for_column(id_col, id_val)
            if converted_value is None:
                # Preserve original value if conversion fails to avoid silent data loss
                converted_ids.append(id_val)
            else:
                converted_ids.append(converted_value)

        # Validate type consistency for better error handling
        if len(converted_ids) > 1:
            types_found = set(map(type, converted_ids))
            if len(types_found) > 1:
                logger.warning(
                    "Mixed ID types detected for %s: %s",
                    cls.model_cls.__name__ if cls.model_cls else "Unknown",
                    [t.__name__ for t in types_found],
                )

        query = db.session.query(cls.model_cls).filter(id_col.in_(converted_ids))
        query = cls._apply_base_filter(query, skip_base_filter)

        try:
            results = query.all()
        except SQLAlchemyError as ex:
            model_name = cls.model_cls.__name__ if cls.model_cls else "Unknown"
            raise DAOFindFailedError(
                "Failed to find %s with ids: %s" % (model_name, model_ids)
            ) from ex

        return results

    @classmethod
    def find_all(cls, skip_base_filter: bool = False) -> list[T]:
        """
        Get all that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        query = cls._apply_base_filter(query, skip_base_filter)
        return query.all()

    @classmethod
    def find_one_or_none(
        cls, skip_base_filter: bool = False, **filter_by: Any
    ) -> T | None:
        """
        Get the first that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        query = cls._apply_base_filter(query, skip_base_filter)
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
    def query(cls, query: BaseQuery) -> list[T]:
        """
        Get all that fit the `base_filter` based on a BaseQuery object
        """
        if cls.base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query.all()

    @classmethod
    def filter_by(cls, **filter_by: Any) -> list[T]:
        """
        Get all entries that fit the `base_filter`
        """
        query = db.session.query(cls.model_cls)
        if cls.base_filter:
            data_model = SQLAInterface(cls.model_cls, db.session)
            query = cls.base_filter(  # pylint: disable=not-callable
                cls.id_column_name, data_model
            ).apply(query, None)
        return query.filter_by(**filter_by).all()

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
            col, opr, value = c.col, c.opr, c.value
            if not col or not hasattr(cls.model_cls, col):
                model_name = cls.model_cls.__name__ if cls.model_cls else "Unknown"
                logging.error(
                    "Invalid filter: column '%s' does not exist on %s", col, model_name
                )
                raise ValueError(
                    "Invalid filter: column '%s' does not exist on %s"
                    % (col, model_name)
                )
            column = getattr(cls.model_cls, col)
            try:
                # Always use ColumnOperatorEnum's apply method
                operator_enum = ColumnOperatorEnum(opr)
                query = query.filter(operator_enum.apply(column, value))
            except Exception as e:
                logging.error("Error applying filter on column '%s': %s", col, e)
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

        filterable: Dict[str, Any] = {}
        for name, col in columns.items():
            if isinstance(col.type, (sa.String, sa.Text)):
                filterable[name] = TYPE_OPERATOR_MAP["string"]
            elif isinstance(col.type, (sa.Boolean,)):
                filterable[name] = TYPE_OPERATOR_MAP["boolean"]
            elif isinstance(col.type, (sa.Integer, sa.Float, sa.Numeric)):
                filterable[name] = TYPE_OPERATOR_MAP["number"]
            elif isinstance(col.type, (sa.DateTime, sa.Date, sa.Time)):
                filterable[name] = TYPE_OPERATOR_MAP["datetime"]
            else:
                # Fallback to eq/ne/null
                filterable[name] = [
                    ColumnOperatorEnum.eq,
                    ColumnOperatorEnum.ne,
                    ColumnOperatorEnum.is_null,
                    ColumnOperatorEnum.is_not_null,
                ]
        # Add hybrid properties as string fields by default
        for name in hybrids:
            filterable[name] = TYPE_OPERATOR_MAP["string"]
        # Add custom fields
        filterable.update(custom_fields)

        # Convert enum values to strings for the return type
        result: Dict[str, List[str]] = {}
        for key, operators in filterable.items():
            if isinstance(operators, list):
                # Convert enums to strings
                result[key] = [
                    op.value if isinstance(op, ColumnOperatorEnum) else op
                    for op in operators
                ]
            else:
                result[key] = operators

        return result

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
            # If any relationships are requested, query the full model
            # but don't add the joins yet - we'll add them after counting
            query = data_model.session.query(cls.model_cls)
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

        # Count before adding relationship joins to avoid inflated counts
        # with one-to-many or many-to-many relationships
        total_count = query.count()

        # Add relationship joins after counting
        if relationship_loads:
            for loader in relationship_loads:
                query = query.options(loader)

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
