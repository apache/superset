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
from functools import total_ordering
from typing import Any, Protocol, runtime_checkable, TypeVar

from pandas import DataFrame
from pydantic import BaseModel

__all__ = [
    "BINARY",
    "BOOLEAN",
    "DATE",
    "DATETIME",
    "DECIMAL",
    "Day",
    "Dimension",
    "Hour",
    "INTEGER",
    "INTERVAL",
    "Minute",
    "Month",
    "NUMBER",
    "OBJECT",
    "Quarter",
    "Second",
    "STRING",
    "TIME",
    "Week",
    "Year",
]


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
@total_ordering
class Grain:
    """
    Base class for time and date grains with comparison support.

    Attributes:
        name: Human-readable name of the grain (e.g., "Second")
        representation: ISO 8601 representation (e.g., "PT1S")
        value: Time period as a timedelta
    """

    name: str
    representation: str
    value: timedelta

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Grain):
            return self.value == other.value
        return NotImplemented

    def __lt__(self, other: object) -> bool:
        if isinstance(other, Grain):
            return self.value < other.value
        return NotImplemented

    def __hash__(self) -> int:
        return hash((self.name, self.representation, self.value))


class Second(Grain):
    name = "Second"
    representation = "PT1S"
    value = timedelta(seconds=1)


class Minute(Grain):
    name = "Minute"
    representation = "PT1M"
    value = timedelta(minutes=1)


class Hour(Grain):
    name = "Hour"
    representation = "PT1H"
    value = timedelta(hours=1)


class Day(Grain):
    name = "Day"
    representation = "P1D"
    value = timedelta(days=1)


class Week(Grain):
    name = "Week"
    representation = "P1W"
    value = timedelta(weeks=1)


class Month(Grain):
    name = "Month"
    representation = "P1M"
    value = timedelta(days=30)


class Quarter(Grain):
    name = "Quarter"
    representation = "P3M"
    value = timedelta(days=90)


class Year(Grain):
    name = "Year"
    representation = "P1Y"
    value = timedelta(days=365)


@dataclass(frozen=True)
class Dimension:
    id: str
    name: str
    type: type[Type]

    definition: str | None = None
    description: str | None = None
    grain: Grain | None = None


@dataclass(frozen=True)
class Metric:
    id: str
    name: str
    type: type[Type]

    definition: str | None
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


FilterValues = str | int | float | bool | datetime | date | time | timedelta | None


class PredicateType(enum.Enum):
    WHERE = "WHERE"
    HAVING = "HAVING"


@dataclass(frozen=True, order=True)
class Filter:
    type: PredicateType
    column: Dimension | Metric
    operator: Operator
    value: FilterValues | set[FilterValues]


@dataclass(frozen=True, order=True)
class AdhocFilter:
    type: PredicateType
    definition: str


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
    filters: set[Filter | AdhocFilter] | None = None


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
    results: DataFrame


@dataclass(frozen=True)
class SemanticQuery:
    """
    Represents a semantic query.
    """

    metrics: list[Metric]
    dimensions: list[Dimension]
    filters: set[Filter | AdhocFilter] | None = None
    order: list[OrderTuple] | None = None
    limit: int | None = None
    offset: int | None = None
    group_limit: GroupLimit | None = None


class SemanticViewFeature(enum.Enum):
    """
    Custom features supported by semantic layers.
    """

    ADHOC_EXPRESSIONS_IN_ORDERBY = "ADHOC_EXPRESSIONS_IN_ORDERBY"
    GROUP_LIMIT = "GROUP_LIMIT"
    GROUP_OTHERS = "GROUP_OTHERS"


ConfigT = TypeVar("ConfigT", bound=BaseModel, contravariant=True)
SemanticViewT = TypeVar("SemanticViewT", bound="SemanticViewImplementation")


@runtime_checkable
class SemanticLayerImplementation(Protocol[ConfigT, SemanticViewT]):
    """
    A protocol for semantic layers.
    """

    @classmethod
    def from_configuration(
        cls,
        configuration: dict[str, Any],
    ) -> SemanticLayerImplementation[ConfigT, SemanticViewT]:
        """
        Create a semantic layer from its configuration.
        """

    @classmethod
    def get_configuration_schema(
        cls,
        configuration: ConfigT | None = None,
    ) -> dict[str, Any]:
        """
        Get the JSON schema for the configuration needed to add the semantic layer.

        A partial configuration `configuration` can be sent to improve the schema,
        allowing for progressive validation and better UX. For example, a semantic
        layer might require:

            - auth information
            - a database

        If the user provides the auth information, a client can send the partial
        configuration to this method, and the resulting JSON schema would include
        the list of databases the user has access to, allowing a dropdown to be
        populated.

        The Snowflake semantic layer has an example implementation of this method, where
        database and schema names are populated based on the provided connection info.
        """

    @classmethod
    def get_runtime_schema(
        cls,
        configuration: ConfigT,
        runtime_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Get the JSON schema for the runtime parameters needed to load semantic views.

        This returns the schema needed to connect to a semantic view given the
        configuration for the semantic layer. For example, a semantic layer might
        be configured by:

            - auth information
            - an optional database

        If the user does not provide a database when creating the semantic layer, the
        runtime schema would require the database name to be provided before loading any
        semantic views. This allows users to create semantic layers that connect to a
        specific database (or project, account, etc.), or that allow users to select it
        at query time.

        The Snowflake semantic layer has an example implementation of this method, where
        database and schema names are required if they were not provided in the initial
        configuration.
        """

    def get_semantic_views(
        self,
        runtime_configuration: dict[str, Any],
    ) -> set[SemanticViewT]:
        """
        Get the semantic views available in the semantic layer.

        The runtime configuration can provide information like a given project or
        schema, used to restrict the semantic views returned.
        """

    def get_semantic_view(
        self,
        name: str,
        additional_configuration: dict[str, Any],
    ) -> SemanticViewT:
        """
        Get a specific semantic view by its name and additional configuration.
        """


@runtime_checkable
class SemanticViewImplementation(Protocol):
    """
    A protocol for semantic views.
    """

    features: frozenset[SemanticViewFeature]

    def uid(self) -> str:
        """
        Returns a unique identifier for the semantic view.
        """

    def get_dimensions(self) -> set[Dimension]:
        """
        Get the dimensions defined in the semantic view.
        """

    def get_metrics(self) -> set[Metric]:
        """
        Get the metrics defined in the semantic view.
        """

    def get_values(
        self,
        dimension: Dimension,
        filters: set[Filter | AdhocFilter] | None = None,
    ) -> SemanticResult:
        """
        Return distinct values for a dimension.
        """

    def get_dataframe(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter | AdhocFilter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        *,
        group_limit: GroupLimit | None = None,
    ) -> SemanticResult:
        """
        Execute a semantic query and return the results as a DataFrame.
        """

    def get_row_count(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter | AdhocFilter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        *,
        group_limit: GroupLimit | None = None,
    ) -> SemanticResult:
        """
        Execute a query and return the number of rows the result would have.
        """
