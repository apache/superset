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
    """
    Pre-defined common grains and factory for custom ones.

    **Grain-variant selection.** A view may expose several :class:`Dimension`
    variants that share one ``name``, one per supported grain, optionally
    alongside a raw variant whose ``grain`` is ``None``. When a selection does
    not name an explicit, supported grouping grain, one variant has to be
    chosen, and the rule is a single default preference:

    1. the raw variant (``grain is None``);
    2. then, finest known grain first: second, minute, hour, day, week, month,
       quarter, year;
    3. then any remaining grain representation, in lexical order.

    The preference governs column metadata, filters and the
    grouping fallback. An explicit supported grouping grain is always honored.
    Filters and time bounds use the default preference **independently of
    grouping**: grouping by month with a lower bound of January 15 will still
    filter the raw time dimension from January 15 rather than testing month
    buckets against that bound. Sorting and series limits use the selected
    grouping grain.

    Do not order grains by ``Grain.name``: alphabetically "Day" precedes "Hour"
    and "Quarter" precedes "Week", which is the opposite of grain fineness. Use
    the preference above, keyed on ``representation``.

    Providers must expose at most one dimension ID per ``(name, grain)``.
    Conflicting IDs, types, definitions or descriptions for the same name and
    grain make the catalog ambiguous; that is a provider defect to fix rather
    than a tie for the host to break by picking a variant.
    The host rejects conflicting variants rather than choosing an arbitrary ID.
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


@dataclass(frozen=True)
class Dimension:
    """
    A groupable or filterable member of a semantic view.

    Member identity (the same rule applies to :class:`Metric`):

    - ``name`` is the **stable selection key**. Saved charts, API payloads and
      compatibility selections reference a member by ``name``, so it must stay
      stable across catalog reloads and provider upgrades. A provider that
      changes what ``name`` means must declare a new
      ``SemanticView.selection_identity_version`` so the host can ask the user
      to reselect instead of failing with a generic "must be defined" error.
    - ``verbose_name`` is **display only**, and is excluded from equality.
    - ``id`` is **provider-private**. The host does not read it; do not expect a
      selection, filter or order entry to round-trip through it.

    A view may expose several variants sharing one ``name``, one per supported
    ``grain`` (see :class:`Grains` for how the host chooses between them), but
    at most one per ``(name, grain)`` pair: two dimensions sharing a name and
    grain are a provider defect, not a tie for the host to break silently.
    Metric names are unique on their own, and must not collide with a dimension
    name. Both rules are provider obligations: the host rejects conflicting
    ``(name, grain)`` variants, but does not detect a metric name that collides
    with a dimension name.
    A query selects at most one
    variant per name, so a result carries one column per selected member name.

    Attributes:
        id: Provider-private identifier; not part of the host contract.
        name: Stable selection key, unique per ``(name, grain)``.
        type: Arrow type of the values this dimension yields.
        definition: Provider-specific expression, for display and debugging.
        description: Optional human-readable description.
        grain: Time grain of this variant, or ``None`` for the raw variant.
        verbose_name: Display label; ignored for equality.
        metadata: Free-form provider metadata; ignored for equality.
    """

    id: str
    name: str
    type: pa.DataType

    definition: str | None = None
    description: str | None = None
    grain: Grain | None = None
    verbose_name: str | None = field(default=None, compare=False)
    metadata: dict[str, Any] = field(default_factory=dict, compare=False)


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
    :attr:`IS_NOT_NULL`, which take no operand. An empty collection for
    :attr:`IN` or :attr:`NOT_IN` has no well-defined rendering either.

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
    column: Dimension | Metric | None
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


OrderTuple = tuple[Metric | Dimension | AdhocExpression, OrderDirection]


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

    dimensions: list[Dimension]
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

    **Count results.** A row count is one row with one integer column holding
    the size of the requested result window (see :class:`SemanticQuery`). The
    column's name is not part of the contract (providers conventionally use
    ``COUNT``): a consumer reads the count from that single cell and does not
    look it up by name. An empty window is the cell ``0``: not an empty table,
    not ``None`` and not a missing column. A count that cannot be established
    exactly is an error
    (``superset_core.semantic_layers.errors.SemanticResultCompletenessError``,
    as incomplete or unverified), never an estimate, the length of a fetched
    page or a zero standing in for "unknown".

    **Value lists.** A distinct-value result has one column, named after the
    dimension. What such a list proves is its *completeness evidence*, one of
    three states:

    - *complete*: every distinct value matching the request was obtained, with
      evidence that the request was fulfilled and no cap, visible or hidden, cut
      it short;
    - *known more*: at least one further distinct matching value exists outside
      the returned values, proven in the same observation (a distinct value seen
      beyond the bound, or a value removed by a cut), never by a later query;
    - *unknown*: neither is proven. Unknown is a valid suggestion result, not a
      defect.

    This type carries no evidence field. The provider's obligation comes from
    the entry point: ``SemanticView.get_values`` must return the whole domain
    or raise. A consumer, though, may treat a list as complete only on explicit
    evidence, never because of the entry point it came from; where evidence is
    carried explicitly and is absent, the reading is unknown, and absence is
    never read as complete. Whether the values are an *ordered prefix*, the
    first values under a deterministic documented provider order whose NULL
    placement and tie handling are stated, is a separate claim with its own
    proof: the order must have been applied before every cut, and sorting an
    already-cut subset afterwards cannot make it a prefix. No evidence may be
    inferred from the list itself. A list exactly as long as a cap proves
    nothing; a list shorter than the cap proves completeness only with evidence
    that nothing was cut; an empty list of unknown completeness is not proof
    that no value matches. A consumer whose own ceiling removes a value from a
    proven-complete list turns it into known more, and may call the result an
    ordered prefix only under an order it applied to the complete list before
    cutting; a ceiling that removes nothing changes nothing.

    Evidence belongs to one observation. A count and a page fetched separately
    may see different source states; nothing here promises a snapshot across
    requests, and ordering is not isolation.
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
    order key for a view declaring ``ADHOC_EXPRESSIONS_IN_ORDERBY``.

    **Default chronological order.** When ``order`` is empty (``None`` or
    ``[]``) and ``dimensions`` includes a date, timestamp or time dimension, the
    host sorts ascending by the first such dimension in ``dimensions`` (by list
    position, not ``SemanticView.preferred_temporal_dimension``), before
    ``offset`` and ``limit``. Rows that tie on it come back in no particular
    order, and where its NULL values sort is not specified. The host applies
    this both to the ``get_table`` query it sends the provider and to results it
    serves from its cache. It is a default, never a prefix: a non-empty
    ``order`` is used exactly as given. A ``get_table`` call therefore receives
    an empty ``order`` only when no temporal dimension is selected, and may then
    return rows in any order. ``get_row_count`` gets no default, since order
    cannot change a count.

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
        dimensions: Selected dimensions, one variant per name.
        filters: Predicate set; see :class:`Operator` for NULL handling.
        order: Sort keys applied before ``offset``/``limit``.
        limit: Maximum rows to return after ordering, or ``None`` for no limit.
        offset: Rows to skip after ordering, before ``limit``.
        group_limit: Optional top/bottom-N restriction over dimension groups.
        selection_identity_version: Identity format of the saved selection this
            query was built from, validated against the view.
    """

    metrics: list[Metric]
    dimensions: list[Dimension]
    filters: set[FilterExpression] | None = None
    order: list[OrderTuple] | None = None
    limit: int | None = None
    offset: int | None = None
    group_limit: GroupLimit | None = None
    selection_identity_version: str | None = None
