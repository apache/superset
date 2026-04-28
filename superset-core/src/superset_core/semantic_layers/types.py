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
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

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
    """Pre-defined common grains and factory for custom ones."""

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
    id: str
    name: str
    type: pa.DataType

    definition: str | None = None
    description: str | None = None
    grain: Grain | None = None


@dataclass(frozen=True)
class Metric:
    id: str
    name: str
    type: pa.DataType

    definition: str
    description: str | None = None


@dataclass(frozen=True)
class AdhocExpression:
    id: str
    definition: str


class Operator(str, enum.Enum):
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
    IS_NULL = "IS NULL"
    IS_NOT_NULL = "IS NOT NULL"
    ADHOC = "ADHOC"


FilterValues = str | int | float | bool | datetime | date | time | timedelta | None


class PredicateType(enum.Enum):
    WHERE = "WHERE"
    HAVING = "HAVING"


@dataclass(frozen=True, order=True)
class Filter:
    type: PredicateType
    column: Dimension | Metric | None
    operator: Operator
    value: FilterValues | tuple[FilterValues, ...] | frozenset[FilterValues]


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
    filters: set[Filter] | None = None


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
    """

    requests: list[SemanticRequest]
    results: pa.Table


@dataclass(frozen=True)
class SemanticQuery:
    """
    Represents a semantic query.
    """

    metrics: list[Metric]
    dimensions: list[Dimension]
    filters: set[Filter] | None = None
    order: list[OrderTuple] | None = None
    limit: int | None = None
    offset: int | None = None
    group_limit: GroupLimit | None = None
