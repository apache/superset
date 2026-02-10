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
from typing import Protocol, runtime_checkable

from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    OrderTuple,
    SemanticResult,
)


# TODO (betodealmeida): move to the extension JSON
class SemanticViewFeature(enum.Enum):
    """
    Custom features supported by semantic layers.
    """

    ADHOC_EXPRESSIONS_IN_ORDERBY = "ADHOC_EXPRESSIONS_IN_ORDERBY"
    GROUP_LIMIT = "GROUP_LIMIT"
    GROUP_OTHERS = "GROUP_OTHERS"


# TODO (betodealmeida): convert to ABC
@runtime_checkable
class SemanticView(Protocol):
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
        filters: set[Filter] | None = None,
    ) -> SemanticResult:
        """
        Return distinct values for a dimension.
        """

    def get_dataframe(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter] | None = None,
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
        filters: set[Filter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        *,
        group_limit: GroupLimit | None = None,
    ) -> SemanticResult:
        """
        Execute a query and return the number of rows the result would have.
        """
