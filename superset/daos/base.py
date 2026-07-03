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
    ClassVar,
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
from flask import current_app
from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.models.sqla.interface import SQLAInterface
from pydantic import BaseModel, Field
from sqlalchemy import asc, cast, desc, false, or_, Text
from sqlalchemy.exc import SQLAlchemyError, StatementError
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import ColumnProperty, joinedload, Query, RelationshipProperty
from superset_core.common.daos import BaseDAO as CoreBaseDAO
from superset_core.common.models import CoreModel

from superset import is_feature_enabled
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.daos.exceptions import (
    DAOFindFailedError,
)
from superset.extensions import db

T = TypeVar("T", bound=CoreModel)


logger = logging.getLogger(__name__)


class ColumnOperatorEnum(str, Enum):
    eq = "eq"
    ne = "ne"
    sw = "sw"
    ew = "ew"
    ct = "ct"
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


def _escape_like(value: Any) -> str:
    """Escape LIKE/ILIKE wildcards to prevent wildcard injection.

    The filter payload is typed ``Any``, so non-string scalars (e.g. numeric
    JSON values) can reach LIKE-family operators; coerce them to ``str`` so
    they degrade to a literal match instead of raising ``AttributeError``.
    ``None`` never reaches this function — ``_like_op`` short-circuits it
    first, because coercing ``None`` to ``""`` would build a wildcard-only
    pattern (``%%``) that matches every row.
    """
    return str(value).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _like_op(template: str, case_insensitive: bool = False) -> Any:
    """Build a LIKE-family operator with SQL-faithful NULL semantics.

    ``template`` places the escaped value inside the pattern (e.g. ``"%{}%"``
    for contains). A ``None`` value matches no rows — mirroring SQL's
    three-valued logic, where ``x LIKE NULL`` evaluates to NULL — rather
    than raising or degenerating into a match-everything pattern.
    """

    def op(col: Any, val: Any) -> Any:
        if val is None:
            return false()
        pattern = template.format(_escape_like(val))
        if case_insensitive:
            return col.ilike(pattern, escape="\\")
        return col.like(pattern, escape="\\")

    return op


# Define operator_map as a module-level dict after the enum is defined
operator_map: Dict[ColumnOperatorEnum, Any] = {
    ColumnOperatorEnum.eq: lambda col, val: col == val,
    ColumnOperatorEnum.ne: lambda col, val: col != val,
    ColumnOperatorEnum.sw: _like_op("{}%"),
    ColumnOperatorEnum.ew: _like_op("%{}"),
    ColumnOperatorEnum.ct: _like_op("%{}%", case_insensitive=True),
    ColumnOperatorEnum.in_: lambda col, val: col.in_(
        val if isinstance(val, (list, tuple)) else [val]
    ),
    ColumnOperatorEnum.nin: lambda col, val: (
        ~col.in_(val if isinstance(val, (list, tuple)) else [val])
    ),
    ColumnOperatorEnum.gt: lambda col, val: col > val,
    ColumnOperatorEnum.gte: lambda col, val: col >= val,
    ColumnOperatorEnum.lt: lambda col, val: col < val,
    ColumnOperatorEnum.lte: lambda col, val: col <= val,
    ColumnOperatorEnum.like: _like_op("%{}%"),
    ColumnOperatorEnum.ilike: _like_op("%{}%", case_insensitive=True),
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
        ColumnOperatorEnum.ct,
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


class BaseDAO(CoreBaseDAO[T], Generic[T]):
    """
    Base DAO, implement base CRUD sqlalchemy operations
    """

    # Due to mypy limitations, we can't have `type[T]` here
    model_cls: ClassVar[type[Any] | None] = None
    """
    Child classes need to state the Model class so they don't need to implement basic
    create, update and delete methods
    """
    base_filter: ClassVar[BaseFilter | None] = None
    """
    Child classes can register base filtering to be applied to all filter methods
    """
    id_column_name: ClassVar[str] = "id"
    uuid_column_name: ClassVar[str] = "uuid"

    filterable_relationships: ClassVar[frozenset[str]] = frozenset()
    """
    Names of collection relationships (m2m / one-to-many) this DAO advertises
    as filterable via ``get_filterable_columns_and_operators``. Empty means
    no relationships are advertised — important because consumer tools
    constrain filter columns via Pydantic ``Literal`` and would silently
    reject anything advertised here that isn't in their allowlist.
    Child DAOs override with the relationship names they wish to expose.
    """

    def __init_subclass__(cls) -> None:
        cls.model_cls = get_args(
            cls.__orig_bases__[0]  # type: ignore[attr-defined]  # pylint: disable=no-member
        )[0]

    @classmethod
    def find_by_id_or_uuid(
        cls,
        model_id_or_uuid: str,
        skip_base_filter: bool = False,
        *,
        skip_visibility_filter: bool = False,
    ) -> T | None:
        """
        Find a model by id or uuid, if defined applies `base_filter`
        """
        query = db.session.query(cls.model_cls)
        if skip_visibility_filter:
            query = query.execution_options(
                **{SKIP_VISIBILITY_FILTER_CLASSES: {cls.model_cls}}
            )
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
        query_options: list[Any] | None = None,
        *,
        skip_visibility_filter: bool = False,
    ) -> T | None:
        """
        Private method to find a model by any column value.

        Args:
            column_name: Name of the column to search by
            value: Value to search for
            skip_base_filter: Whether to skip base filtering
            skip_visibility_filter: Whether to skip the soft-delete visibility filter
            query_options: SQLAlchemy query options (e.g., joinedload,
                subqueryload) to apply to the query for eager loading

        Returns:
            Model instance or None if not found
        """
        query = db.session.query(cls.model_cls)
        if skip_visibility_filter:
            query = query.execution_options(
                **{SKIP_VISIBILITY_FILTER_CLASSES: {cls.model_cls}}
            )
        query = cls._apply_base_filter(query, skip_base_filter)

        if query_options:
            query = query.options(*query_options)

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
        query_options: list[Any] | None = None,
        *,
        skip_visibility_filter: bool = False,
    ) -> T | None:
        """
        Find a model by ID using specified or default ID column.

        Args:
            model_id: ID value to search for
            skip_base_filter: Whether to skip base filtering
            id_column: Column name to use (defaults to cls.id_column_name)
            query_options: SQLAlchemy query options (e.g., joinedload,
                subqueryload) to apply to the query for eager loading
            skip_visibility_filter: Keyword-only. Whether to skip the
                soft-delete visibility filter

        Returns:
            Model instance or None if not found
        """
        column = id_column or cls.id_column_name
        return cls._find_by_column(
            column,
            model_id,
            skip_base_filter,
            query_options,
            skip_visibility_filter=skip_visibility_filter,
        )

    @classmethod
    def find_by_ids(
        cls,
        model_ids: Sequence[str | int],
        skip_base_filter: bool = False,
        id_column: str | None = None,
        *,
        skip_visibility_filter: bool = False,
    ) -> list[T]:
        """
        Find a List of models by a list of ids, if defined applies `base_filter`

        :param model_ids: List of IDs to find
        :param skip_base_filter: If true, skip applying the base filter
        :param id_column: Optional column name to use for ID lookup
                         (defaults to id_column_name)
        :param skip_visibility_filter: Keyword-only. If true, skip the
            soft-delete visibility filter so soft-deleted rows are returned
        """
        column = id_column or cls.id_column_name
        id_col = getattr(cls.model_cls, column, None)
        if id_col is None or not model_ids:
            return []

        # Convert IDs to appropriate types based on column type
        converted_ids: list[str | int | uuid_lib.UUID] = []
        for id_val in model_ids:
            converted_value = cls._convert_value_for_column(id_col, id_val)
            if converted_value is not None:
                # Only add successfully converted values
                converted_ids.append(converted_value)
            else:
                # Log warning for failed conversions
                logger.warning(
                    "Failed to convert ID '%s' for column %s.%s",
                    id_val,
                    cls.model_cls.__name__ if cls.model_cls else "Unknown",
                    column,
                )

        # If no valid IDs after conversion, return empty list
        if not converted_ids:
            return []

        query = db.session.query(cls.model_cls)
        if skip_visibility_filter:
            query = query.execution_options(
                **{SKIP_VISIBILITY_FILTER_CLASSES: {cls.model_cls}}
            )
        query = query.filter(id_col.in_(converted_ids))
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
    def soft_delete(cls, items: list[T]) -> None:
        """Mark items as soft-deleted by setting ``deleted_at``.

        Only valid for models that include ``SoftDeleteMixin``.

        :param items: The items to soft-delete
        """
        for item in items:
            item.soft_delete()

    @classmethod
    def hard_delete(cls, items: list[T]) -> None:
        """Permanently remove rows from the database.

        Note that bulk deletion via ``delete`` is not invoked in the base
        class as this does not dispatch the ORM ``after_delete`` event which
        may be required to augment additional records loosely defined via
        implicit relationships. Instead ORM objects are deleted one-by-one
        via ``Session.delete``.

        Subclasses may invoke bulk deletion but are responsible for
        instrumenting any post-deletion logic.

        :param items: The items to delete
        :see: https://docs.sqlalchemy.org/en/latest/orm/queryguide/dml.html
        """
        for item in items:
            db.session.delete(item)

    @classmethod
    def delete(cls, items: list[T]) -> None:
        """Route to soft or hard delete based on whether the model supports
        soft delete.

        For models that include ``SoftDeleteMixin``, this calls
        ``soft_delete()`` — but only while the temporary ``SOFT_DELETE`` rollout
        gate is enabled. When the gate is off, every model
        hard-deletes (the original behaviour), so the substrate can ship dark.
        For all other models, this always calls ``hard_delete()``.

        :param items: The items to delete
        """
        from superset.models.helpers import (
            SoftDeleteMixin,  # avoid circular import: models.helpers <-> daos
        )

        if (
            cls.model_cls is not None
            and issubclass(cls.model_cls, SoftDeleteMixin)
            and is_feature_enabled("SOFT_DELETE")
        ):
            cls.soft_delete(items)
        else:
            cls.hard_delete(items)

    @classmethod
    def query(cls, query: Query) -> list[T]:
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
                operator_enum = ColumnOperatorEnum(opr)
                # Relationship attributes (many-to-many or one-to-many)
                # can't be compared directly with scalar operators —
                # SQLAlchemy needs `.any(...)`. Detect the collection
                # case and dispatch to the related model's primary key
                # column. This lets callers use the natural shapes
                # `{col: "<relationship>", opr: "eq", value: <id>}` or
                # `{opr: "in", value: [<id>, ...]}` etc. to find rows
                # whose related collection contains those id(s).
                is_collection_relationship = (
                    hasattr(column, "property")
                    and isinstance(column.property, RelationshipProperty)
                    and column.property.uselist
                )
                if is_collection_relationship:
                    query = cls._apply_relationship_filter(
                        query, column, col, operator_enum, value
                    )
                else:
                    query = query.filter(operator_enum.apply(column, value))
            except Exception as e:
                logging.error("Error applying filter on column '%s': %s", col, e)
                raise
        return query

    @classmethod
    def _apply_relationship_filter(
        cls,
        query: Any,
        column: Any,
        col_name: str,
        operator_enum: "ColumnOperatorEnum",
        value: Any,
    ) -> Any:
        """Apply a filter on a many-to-many or one-to-many relationship column.

        Translates the caller's operator into a SQLAlchemy ``.any()``
        expression against the related model's primary key. Supports
        eq / ne / in / nin / is_null / is_not_null. Other operators
        (sw, like, gt, etc.) don't make sense on a collection of related
        rows and raise a clear ValueError instead of producing a
        cryptic SQLAlchemy error at query time.
        """
        pk_cols = inspect(column.property.mapper).primary_key
        if len(pk_cols) != 1:
            # Composite PKs would need a tuple `.in_()` and per-operator
            # tuple handling; no Superset model uses one today, so we
            # fail loudly rather than silently drop the trailing columns.
            raise ValueError(
                f"Relationship filter on '{col_name}' requires a "
                f"single-column primary key on the related model; "
                f"found {len(pk_cols)} columns."
            )
        related_pk = pk_cols[0]
        if operator_enum == ColumnOperatorEnum.eq:
            return query.filter(column.any(related_pk == value))
        if operator_enum == ColumnOperatorEnum.ne:
            # "no related row has id == value"
            return query.filter(~column.any(related_pk == value))
        if operator_enum == ColumnOperatorEnum.in_:
            values = value if isinstance(value, (list, tuple)) else [value]
            return query.filter(column.any(related_pk.in_(values)))
        if operator_enum == ColumnOperatorEnum.nin:
            values = value if isinstance(value, (list, tuple)) else [value]
            return query.filter(~column.any(related_pk.in_(values)))
        if operator_enum == ColumnOperatorEnum.is_null:
            # "has no related rows at all"
            return query.filter(~column.any())
        if operator_enum == ColumnOperatorEnum.is_not_null:
            # "has at least one related row"
            return query.filter(column.any())
        raise ValueError(
            f"Operator '{operator_enum.value}' is not supported on "
            f"relationship column '{col_name}'. Use one of: eq, ne, in, "
            f"nin, is_null, is_not_null."
        )

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
        # Collection relationships (m2m / one-to-many) are filterable via
        # `.any()` against the related model's primary key. Only advertise
        # the relationships the DAO has opted into via
        # ``filterable_relationships`` so schema discovery stays in sync
        # with the consumer tool's input ``Literal`` allowlist (otherwise
        # the LLM sees fields it cannot actually pass).
        relationship_columns = {
            rel.key: rel
            for rel in mapper.relationships
            if rel.uselist and rel.key in cls.filterable_relationships
        }
        # Add hybrid properties
        hybrids = {
            name: attr
            for name, attr in vars(cls.model_cls).items()
            if isinstance(attr, hybrid_property)
        }
        # You may add custom fields here, e.g.:
        # custom_fields = {"tags": ["eq", "in_", "like"], ...}
        custom_fields: Dict[str, List[str]] = {}

        # Operators apply_relationship_filter supports for collection
        # relationships. Keep in sync with that method.
        relationship_operators = [
            ColumnOperatorEnum.eq,
            ColumnOperatorEnum.ne,
            ColumnOperatorEnum.in_,
            ColumnOperatorEnum.nin,
            ColumnOperatorEnum.is_null,
            ColumnOperatorEnum.is_not_null,
        ]

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
        # Add collection relationships
        for name in relationship_columns:
            filterable[name] = relationship_operators
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
                    search_filters.append(
                        cast(column, Text).ilike(
                            f"%{_escape_like(search)}%", escape="\\"
                        )
                    )
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
        needs_full_model = False
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
            else:
                # Python @property or other descriptor — requires a full
                # model instance (Row objects don't support descriptors)
                needs_full_model = True

        if relationship_loads or needs_full_model:
            # Need full model for relationships or Python @property access.
            # Do NOT apply load_only() here — @property descriptors and
            # serializers may access columns beyond the explicitly requested
            # set (e.g., Slice.datasource_type accessed during serialization).
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
                    search_filters.append(
                        cast(column, Text).ilike(
                            f"%{_escape_like(search)}%", escape="\\"
                        )
                    )
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
        # Clamp the page size to a sane range: at least 1, and no larger than
        # the configured upper bound, to keep result sets bounded.
        # Normalize the configured maximum to a positive integer so that a
        # misconfigured value (non-int or <= 0) cannot produce a non-positive
        # page size, which would break pagination or yield unbounded queries.
        try:
            max_page_size = int(
                current_app.config.get("SQLALCHEMY_DAO_MAX_PAGE_SIZE", 1000)
            )
        except (TypeError, ValueError):
            max_page_size = 1000
        max_page_size = max(max_page_size, 1)
        page_size = min(max(page_size, 1), max_page_size)
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
