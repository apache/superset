import enum
from dataclasses import dataclass
from datetime import timedelta
from functools import total_ordering
from typing import Protocol, runtime_checkable

from sqlalchemy.engine.base import Engine


class Type:
    """
    Base class for types.
    """


class INTEGER(Type):
    """
    Represents an integer type.
    """


class NUMBER(Type):
    """
    Represents a number type.
    """


class DECIMAL(Type):
    """
    Represents a decimal type.
    """


class STRING(Type):
    """
    Represents a string type.
    """


class BOOLEAN(Type):
    """
    Represents a boolean type.
    """


class DATE(Type):
    """
    Represents a date type.
    """


class TIME(Type):
    """
    Represents a time type.
    """


class DATETIME(DATE, TIME):
    """
    Represents a datetime type.
    """


class INTERVAL(Type):
    """
    Represents an interval type.
    """


class OBJECT(Type):
    """
    Represents an object type.
    """


class BINARY(Type):
    """
    Represents a binary type.
    """


@dataclass(frozen=True)
class SemanticView:
    name: str
    description: str | None = None


@dataclass(frozen=True)
class Relation:
    name: str
    schema: str | None = None
    catalog: str | None = None


@dataclass(frozen=True)
class Table:
    name: str
    schema: str | None = None
    catalog: str | None = None


@dataclass(frozen=True)
class View:
    name: str
    sql: str
    schema: str | None = None
    catalog: str | None = None


@dataclass(frozen=True)
class Virtual:
    name: str


@dataclass(frozen=True)
class Metric:
    name: str
    type: type[Type]
    sql: str
    tables: frozenset[Table]
    join_columns: frozenset[str]


@total_ordering
class ComparableEnum(enum.Enum):
    def __eq__(self, other: object) -> bool:
        if isinstance(other, enum.Enum):
            return self.value == other.value
        return NotImplemented

    def __lt__(self, other: object) -> bool:
        if isinstance(other, enum.Enum):
            return self.value < other.value
        return NotImplemented

    def __hash__(self):
        return hash((self.__class__, self.name))


class TimeGrain(ComparableEnum):
    second = timedelta(seconds=1)
    minute = timedelta(minutes=1)
    hour = timedelta(hours=1)


class DateGrain(ComparableEnum):
    day = timedelta(days=1)
    week = timedelta(weeks=1)
    month = timedelta(days=30)
    quarter = timedelta(days=90)
    year = timedelta(days=365)


@dataclass(frozen=True)
class Column:
    relation: Table | View | Virtual
    name: str


@dataclass(frozen=True)
class Dimension:
    column: Column
    name: str
    type: type[Type]
    grain: TimeGrain | DateGrain | None = None

    def __repr__(self) -> str:
        metadata = f"[{self.grain.name}]" if self.grain else ""
        return f"{self.type.__name__} {self.name} {metadata}".strip()


class FilterTypeEnum(enum.Enum):
    WHERE = enum.auto()
    HAVING = enum.auto()


@dataclass(frozen=True)
class Filter:
    type: FilterTypeEnum
    expression: str


class SortDirectionEnum(enum.Enum):
    ASC = enum.auto()
    DESC = enum.auto()


@dataclass(frozen=True)
class SortField:
    field: Metric | Dimension
    direction: SortDirectionEnum
    nulls_first: bool = True


@dataclass(frozen=True)
class Sort:
    items: list[SortField]


@dataclass(frozen=True)
class Query:
    sql: str


NoSort = Sort(items=[])


@runtime_checkable
class SemanticLayer(Protocol):
    """
    A generic protocol for semantic layers.
    """

    def __init__(self, engine: Engine) -> None: ...

    def get_semantic_views(self) -> set[SemanticView]:
        """
        Return a set of the semantic views.

        A semantic view is an organizational group of metrics and dimensions. It's not a
        logical grouping, since metrics and dimensions from a given semantic view might
        not be compatible. An implementation might expose a single semantic view for
        exploration of available metric and dimesnions, and smaller curated semantic
        views that are domain specific.
        """
        ...

    def get_metrics(self, semantic_view: SemanticView) -> set[Metric]:
        """
        Return a set of metrics from a given semantic views.
        """
        ...

    def get_dimensions(self, semantic_view: SemanticView) -> set[Dimension]:
        """
        Return a set of dimensions from a given semantic views.
        """
        ...

    def get_valid_metrics(
        self,
        semantic_view: SemanticView,
        metrics: set[Metric],
        dimensions: set[Dimension],
    ) -> set[Metric]:
        """
        Return compatible metrics for the given metrics and dimensions.

        For metrics to be valid they must be compatible with all the provided
        dimensions.
        """
        ...

    def get_valid_dimensions(
        self,
        semantic_view: SemanticView,
        metrics: set[Metric],
        dimensions: set[Dimension],
    ) -> set[Dimension]:
        """
        Return compatible dimensions for the given metrics.

        For dimensions to be valid they must be compatible with all the provided
        metrics.
        """
        ...

    def get_query(
        self,
        semantic_view: SemanticView,
        metrics: set[Metric],
        dimensions: set[Dimension],
        # populations: set[Population],
        filters: set[Filter],
        sort: Sort = NoSort,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Query:
        """
        Build a SQL query from the given metrics, dimensions, filters, and sort order.
        """
        ...

    def get_query_from_standard_sql(
        self,
        semantic_view: SemanticView,
        sql: str,
    ) -> Query:
        """
        Build a SQL query from a pseudo-query referencing metrics and dimensions.

        For example, given `metric1` having the expression `COUNT(*)`, this query:

            SELECT metric1, dim1
            FROM semantic_layer
            GROUP BY dim1

        Becomes:

            SELECT metric1, dim1
            FROM (
              SELECT COUNT(*) AS metric1, dim1
              FROM fact_table
              JOIN dim_table
                ON fact_table.dim_id = dim_table.id
              GROUP BY dim1
            ) AS semantic_view

        """
        ...
