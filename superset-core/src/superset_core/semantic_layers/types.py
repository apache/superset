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

import enum
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any, TypeAlias

import isodate
import pyarrow as pa

from superset_core.semantic_layers.errors import (
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
)


@dataclass(frozen=True)
class Grain:
    """
    Represents a time grain (e.g., day, month, year).

    Attributes:
        name: Human-readable name of the grain (e.g., "Second")
        representation: ISO 8601 duration (e.g., "PT1S", "P1D", "P1M")
    """

    name: str
    representation: str

    def __post_init__(self) -> None:
        isodate.parse_duration(self.representation)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Grain):
            return self.representation == other.representation
        return NotImplemented

    def __hash__(self) -> int:
        return hash(self.representation)


class Grains:
    """Pre-defined common grains and a factory for provider-defined grains.

    Catalog support is declared on Dimension; query bucketing belongs to
    DimensionSelection. Neither display names nor duration ordering establish
    provider support or the default for an omitted request.
    """

    SECOND = Grain("Second", "PT1S")
    MINUTE = Grain("Minute", "PT1M")
    HOUR = Grain("Hour", "PT1H")
    DAY = Grain("Day", "P1D")
    WEEK = Grain("Week", "P1W")
    MONTH = Grain("Month", "P1M")
    QUARTER = Grain("Quarter", "P3M")
    YEAR = Grain("Year", "P1Y")

    _REGISTRY: dict[str, Grain] = {
        "PT1S": SECOND,
        "PT1M": MINUTE,
        "PT1H": HOUR,
        "P1D": DAY,
        "P1W": WEEK,
        "P1M": MONTH,
        "P3M": QUARTER,
        "P1Y": YEAR,
    }

    @classmethod
    def get(cls, representation: str, name: str | None = None) -> Grain:
        """Return a pre-defined grain or create a custom one."""
        if grain := cls._REGISTRY.get(representation):
            return grain
        return Grain(name or representation, representation)


class GrainDefault(enum.Enum):
    """A declared default that is not an explicit supported grain.

    NATIVE preserves provider-native behavior; it does not promise physical
    timestamp precision. REJECT requires the caller to make an explicit choice.
    """

    NATIVE = "native"
    REJECT = "reject"


@dataclass(frozen=True)
class Dimension:
    """A unique catalog member with declared query capabilities.

    ``name`` is the stable selection key; changing its meaning requires a new
    SemanticView.selection_identity_version. ``id`` is provider-private and
    ``verbose_name`` is display-only. Dimension and metric names must be unique
    and disjoint. A query returns one column per selected member name.

    ``grains`` contains supported explicit buckets; an empty set grants none.
    ``allows_default_grain`` independently permits a native, unbucketed operand.
    ``omitted_grain`` resolves omitted grouping; ``ungrained_filter`` resolves
    implicit filters and values. Each is NATIVE, REJECT or an allowed grain.
    Legacy curated catalogs can declare DAY defaults without granting native
    selection. Explicit raw predicates never inherit these omission defaults.

    Providers narrow capabilities for selected-metric context before execution.
    Metadata and display labels are excluded from equality; capabilities and
    defaults are included because they affect query meaning.
    """

    id: str
    name: str
    type: pa.DataType
    definition: str | None = None
    description: str | None = None
    grains: frozenset[Grain] = field(default_factory=frozenset)
    allows_default_grain: bool = True
    omitted_grain: Grain | GrainDefault = GrainDefault.NATIVE
    ungrained_filter: Grain | GrainDefault = GrainDefault.NATIVE
    verbose_name: str | None = field(default=None, compare=False)
    metadata: dict[str, Any] = field(default_factory=dict, compare=False)

    def __post_init__(self) -> None:
        """Reject mutable capabilities or defaults outside the declared envelope."""
        if not isinstance(self.grains, frozenset) or not all(
            isinstance(grain, Grain) for grain in self.grains
        ):
            raise ValueError("Dimension grains must be a frozenset of Grain values")
        default: Grain | GrainDefault
        for default in (self.omitted_grain, self.ungrained_filter):
            if default is GrainDefault.REJECT:
                continue
            if default is GrainDefault.NATIVE and self.allows_default_grain:
                continue
            if isinstance(default, Grain) and default in self.grains:
                continue
            raise ValueError("Dimension default is outside its declared support")


@dataclass(frozen=True)
class DimensionSelection:
    """A catalog reference and explicit query bucketing, separate from metadata.

    None requests native behavior, not an omitted host request. The host resolves
    omission from the declared defaults before constructing this value. Providers
    must still validate membership and current contextual support against their
    own catalog; a caller-supplied dimension is not authority to grant support.
    """

    dimension: Dimension
    grain: Grain | None = None

    def __post_init__(self) -> None:
        """Reject selections outside the supplied capability envelope."""
        if not isinstance(self.dimension, Dimension):
            raise TypeError("DimensionSelection requires a catalog Dimension")
        if (self.grain is None and not self.dimension.allows_default_grain) or (
            self.grain is not None and self.grain not in self.dimension.grains
        ):
            raise SemanticQueryRejectedError(SemanticQueryErrorCode.UNSUPPORTED_QUERY)

    @property
    def name(self) -> str:
        """Return the stable result and selection name, without a grain suffix."""
        return self.dimension.name

    @property
    def type(self) -> pa.DataType:
        """Return the declared value type for result assembly."""
        return self.dimension.type


class AggregationType(str, enum.Enum):
    """
    Aggregation function applied by a metric.

    Additivity (across an arbitrary set of grouping dimensions):
    * ``SUM``, ``COUNT``: fully additive — sub-group sums roll up via ``sum``.
    * ``MIN``, ``MAX``: roll up via ``min`` / ``max`` of sub-group values.
    * ``AVG``, ``COUNT_DISTINCT``, ``OTHER``: not safely roll-uppable from
      sub-aggregates without auxiliary data.
    """

    SUM = "SUM"
    COUNT = "COUNT"
    MIN = "MIN"
    MAX = "MAX"
    AVG = "AVG"
    COUNT_DISTINCT = "COUNT_DISTINCT"
    OTHER = "OTHER"


@dataclass(frozen=True)
class Metric:
    """
    An aggregated member of a semantic view.

    Member identity follows the same rule as :class:`Dimension`: ``name`` is the
    stable selection key, ``verbose_name`` is display only, and ``id`` is
    provider-private. Metric names must be unique within a view, and must not
    collide with dimension names, because the host resolves a selection against
    both member sets by ``name``.

    Attributes:
        id: Provider-private identifier; not part of the host contract.
        name: Stable selection key, unique within the view.
        type: Arrow type of the aggregated values.
        definition: Provider-specific expression, for display and debugging.
        description: Optional human-readable description.
        aggregation: Aggregation this metric applies, when the provider can
            declare it; ``None`` means "unspecified", not "none applied".
        verbose_name: Display label; ignored for equality.
        d3format: Optional display format hint; ignored for equality.
        metadata: Free-form provider metadata; ignored for equality.
    """

    id: str
    name: str
    type: pa.DataType

    definition: str
    description: str | None = None
    aggregation: AggregationType | None = None
    verbose_name: str | None = field(default=None, compare=False)
    d3format: str | None = field(default=None, compare=False)
    metadata: dict[str, Any] = field(default_factory=dict, compare=False)


@dataclass(frozen=True)
class AdhocExpression:
    id: str
    definition: str


class Operator(str, enum.Enum):
    """
    Comparison applied by a :class:`Filter`.

    **NULL semantics.** ``None`` is not a valid operand for a comparison
    operator. In SQL, ``= NULL``, ``!= NULL``, ``IN (NULL)`` and
    ``NOT IN (NULL)`` are never true, so a provider that renders or binds
    ``None`` through one of them silently drops every row the user asked for,
    with no error. Nullness is expressed with :attr:`IS_NULL` and
    :attr:`IS_NOT_NULL`, which take no operand.

    **Empty membership.** An empty collection follows SQL predicate semantics at
    the filter's position: :attr:`IN` with no values is FALSE and :attr:`NOT_IN`
    with no values is TRUE, for NULL values too. Filtering is applied before
    aggregation, so an ungrouped aggregate over no matching rows still returns one
    row (``COUNT`` is 0). Providers must not render an empty SQL list, which many
    dialects reject; render a constant or an equivalent native predicate instead.

    Splitting a ``None`` operand out into those predicates is the host's
    responsibility, so that every provider sees the same already-normalized
    filter set instead of reimplementing the rewrite. Mixed positive membership
    selections use :class:`OrFilter` to combine non-NULL membership with
    :attr:`IS_NULL`; providers must render both branches of the group.
    """

    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    LESS_THAN = "<"
    GREATER_THAN_OR_EQUAL = ">="
    LESS_THAN_OR_EQUAL = "<="
    IN = "IN"
    NOT_IN = "NOT IN"
    LIKE = "LIKE"
    NOT_LIKE = "NOT LIKE"
    ILIKE = "ILIKE"
    NOT_ILIKE = "NOT ILIKE"
    IS_NULL = "IS NULL"
    IS_NOT_NULL = "IS NOT NULL"
    ADHOC = "ADHOC"


FilterValues = str | int | float | bool | datetime | date | time | timedelta | None


class PredicateType(enum.Enum):
    """
    The stage a filter applies to.

    ``HAVING`` is reserved. The host does not send HAVING predicates for chart
    data, and a provider may reject one.
    """

    WHERE = "WHERE"
    HAVING = "HAVING"


@dataclass(frozen=True, order=True)
class Filter:
    type: PredicateType
    column: DimensionSelection | Metric | None
    operator: Operator
    value: FilterValues | tuple[FilterValues, ...] | frozenset[FilterValues]


@dataclass(frozen=True)
class OrFilter:
    """A parenthesized disjunction of at least two leaves in one predicate stage.

    Query filter collections combine their members with AND. A group is one member
    of that collection and combines its leaves with OR. Nested groups are unsupported.
    Providers must render these groups in query and group-limit filters. Sort leaves
    deterministically when rendering, keeping each bound value paired with its
    predicate; frozenset iteration order is not stable across processes.
    """

    filters: frozenset[Filter]

    def __post_init__(self) -> None:
        """Reject mutable, empty, nested, or mixed WHERE/HAVING groups."""
        if not isinstance(self.filters, frozenset) or len(self.filters) < 2:
            raise ValueError("OrFilter requires a frozenset of at least two leaves")
        if not all(isinstance(leaf, Filter) for leaf in self.filters):
            raise ValueError("OrFilter only accepts Filter leaves")
        if len({leaf.type for leaf in self.filters}) != 1:
            raise ValueError("OrFilter leaves must share one predicate stage")


FilterExpression: TypeAlias = Filter | OrFilter


class OrderDirection(enum.Enum):
    ASC = "ASC"
    DESC = "DESC"


OrderTuple: TypeAlias = tuple[
    Metric | DimensionSelection | AdhocExpression, OrderDirection
]


@dataclass(frozen=True)
class GroupLimit:
    """
    Limit query to top/bottom N combinations of specified dimensions.

    The `filters` parameter allows specifying separate filter constraints for the
    group limit subquery. This is useful when you want to determine the top N groups
    using different criteria (e.g., a different time range) than the main query.

    For example, you might want to find the top 10 products by sales over the last
    30 days, but then show daily sales for those products over the last 7 days.
    """

    dimensions: list[DimensionSelection]
    top: int
    metric: Metric | None
    direction: OrderDirection = OrderDirection.DESC
    group_others: bool = False
    filters: set[FilterExpression] | None = None


@dataclass(frozen=True)
class SemanticRequest:
    """
    Represents a request made to obtain semantic results.

    This could be a SQL query, an HTTP request, etc.
    """

    type: str
    definition: str


@dataclass(frozen=True)
class SemanticResult:
    """
    Represents the results of a semantic query.

    This includes any requests (SQL queries, HTTP requests) that were performed in order
    to obtain the results, in order to help troubleshooting.

    **Count results.** A row count is one row with one integer column named
    ``rowcount``, holding the size of the requested result window (see
    :class:`SemanticQuery`). The host preserves the provider's column name;
    Superset's table consumers read ``data[0].rowcount``, so a different name
    does not supply their pagination total. An empty window is the cell ``0``:
    not an empty table, ``None`` or a missing column. A count that cannot be
    established exactly is an error
    (``superset_core.semantic_layers.errors.SemanticResultCompletenessError``,
    as incomplete or unverified), never an estimate, the length of a fetched
    page or a zero standing in for "unknown".

    **Value lists.** A distinct-value result has one column, named after the
    dimension. ``SemanticView.get_values`` must return the complete matching
    distinct domain or raise ``SemanticResultCompletenessError``. Consumers
    may rely on that complete-or-raise contract when the call succeeds; this
    result type carries no separate completeness-evidence field. A provider
    must raise if its own page size, transport cap or other ceiling may have
    omitted matching values.

    ``get_values`` takes no limit. The host obtains the complete filtered set,
    sorts it and then applies its suggestion limit. For a positive limit, a
    successful host list shorter than it is the complete matching set; an empty
    one then means no value matches. A list exactly as long as the limit may
    have been cut and does not prove that more values exist. Providers must not silently
    return a bounded subset through ``get_values``; a bounded suggestion API
    with different completeness semantics is not defined by this signature.

    These guarantees belong to one observation. A count and a page fetched
    separately may see different source states; nothing here promises a snapshot
    across requests, and ordering is not isolation.
    """

    requests: list[SemanticRequest]
    results: pa.Table


@dataclass(frozen=True)
class SemanticQuery:
    """
    Represents a semantic query.

    **Ordering applies before limit and offset.** A provider must sort the full
    result set by ``order`` and only then apply ``offset`` and ``limit``.
    Truncating first and sorting the truncated page returns a different, and
    wrong, answer. ``order`` entries are ``(member, direction)`` pairs whose
    member must be defined by the view; an adhoc expression is only a valid
    order key for a view declaring ``ADHOC_EXPRESSIONS_IN_ORDERBY``. NULL placement
    and the order of rows tied on every order key are provider-defined.

    **Default chronological order.** When ``order`` is empty (``None`` or
    ``[]``) and ``dimensions`` includes a date, timestamp or time dimension, the
    host sorts ascending by the first such dimension in ``dimensions`` (by list
    position, not ``SemanticView.preferred_temporal_dimension``), before
    ``offset`` and ``limit``. The SDK does not specify NULL placement or tie
    order; a provider's placement is kept as returned, and a cache-served rollup
    keeps the provider's rows but may order NULL and tied rows differently.
    The host applies this default both to the ``get_table`` query it sends the
    provider and to results it serves from its cache. It is a default, never a
    prefix: a non-empty ``order`` is used exactly as given. A ``get_table`` call
    therefore receives an empty ``order`` only when no temporal dimension is
    selected, and may then return rows in any order. ``get_row_count`` gets no
    default, since order cannot change a count.

    **What a count counts.** The *matching result* of a query is its rows at
    the requested grain after ``filters``, grouping and ``group_limit``, before
    ``order``, ``offset`` and ``limit``. The *requested result window* is that
    result, ordered, with ``offset`` rows skipped and at most ``limit`` rows
    kept. A row count is the number of rows in the requested result window. For
    a matching result of 123 rows: no limit and no offset counts 123;
    ``limit=50`` counts 50; ``limit=50, offset=100`` counts 23; ``limit=50,
    offset=150`` counts 0. ``limit=None`` means no limit and an absent or ``0``
    ``offset`` means no offset, so a query with neither counts its whole
    matching result; that unrestricted total is the count of no other query.
    Rows are rows of the result, never underlying facts or metric values:
    10,000 facts that aggregate to 12 groups count 12. A count validates the
    same shape ``get_table`` would, the shape being members, ``filters``,
    ``group_limit``, ``limit`` and ``offset`` but not ``order``, so a query the
    table would reject, such as an offset on a view without ``ROW_OFFSET``, is
    rejected by the count as well, and a count is accepted whenever the table
    query would be; a count never widens what may be asked.

    ``group_limit`` is a separate ranking, with its own metric, direction and
    optional filters.

    Attributes:
        metrics: Selected metrics, resolved by ``name``.
        dimensions: Selected dimensions with explicit bucketing, one per name.
        filters: Predicate set; see :class:`Operator` for NULL handling.
        order: Sort keys applied before ``offset``/``limit``.
        limit: Maximum rows to return after ordering, or ``None`` for no limit.
        offset: Rows to skip after ordering, before ``limit``.
        group_limit: Optional top/bottom-N restriction over dimension groups.
        selection_identity_version: Identity format of the saved selection this
            query was built from, validated against the view.
    """

    metrics: list[Metric]
    dimensions: list[DimensionSelection]
    filters: set[FilterExpression] | None = None
    order: list[OrderTuple] | None = None
    limit: int | None = None
    offset: int | None = None
    group_limit: GroupLimit | None = None
    selection_identity_version: str | None = None
