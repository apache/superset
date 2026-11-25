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

"""Optional host operation metadata, separate from authorization and execution."""

from dataclasses import dataclass
from enum import Enum
from typing import Any

from superset.utils.core import FilterOperator


class ExplorableOperation(Enum):
    """Host operations; declaring one never grants access to a source."""

    RAW_ROWS = "RAW_ROWS"
    ADHOC_METRICS = "ADHOC_METRICS"
    SAMPLES = "SAMPLES"
    DRILL_TO_DETAIL = "DRILL_TO_DETAIL"
    SQL_LAB = "SQL_LAB"


@dataclass(frozen=True)
class ExplorableCapabilities:
    """An optional facet, not a required member of the Explorable protocol.

    SQL Lab means executable SQL hand-off, not non-executing preview. Ad-hoc
    metrics do not imply saved metrics or metric compatibility discovery.
    Provider features retain their separate SDK vocabulary. An omitted operator
    or feature set preserves legacy projection; an empty set explicitly refuses it.
    """

    supported: frozenset[ExplorableOperation] = frozenset()
    supported_operators: frozenset[str] | None = None
    features: frozenset[str] | None = None

    @property
    def names(self) -> list[str]:
        """Serialize operations deterministically, without coercing raw strings."""
        return sorted(
            operation.value
            for operation in self.supported
            if isinstance(operation, ExplorableOperation)
        )


def declared_capabilities(source: object) -> ExplorableCapabilities | None:
    """Preserve absent legacy declarations; malformed declarations grant nothing.

    Callers must not turn absence into an empty declaration on the wire: legacy
    implementations need their existing behavior until explicitly adapted.
    """
    declaration: object = getattr(source, "explorable_capabilities", None)
    if declaration is None or isinstance(declaration, ExplorableCapabilities):
        return declaration
    return ExplorableCapabilities()


def project_operation_flags(
    payload: dict[str, Any], declaration: ExplorableCapabilities | None
) -> None:
    """Align existing legacy keys with a declaration without adding wire keys.

    Call only after source authorization: obtaining a declaration may bind a
    provider. Missing declarations retain the payload's legacy defaults.
    """
    if declaration is None:
        return
    operations: dict[str, ExplorableOperation] = {
        "supports_samples": ExplorableOperation.SAMPLES,
        "supports_drill_to_detail": ExplorableOperation.DRILL_TO_DETAIL,
        "supports_adhoc_metrics": ExplorableOperation.ADHOC_METRICS,
    }
    for key, operation in operations.items():
        if key in payload:
            payload[key] = operation in declaration.supported


def sql_capabilities(*, samples: bool, drill_to_detail: bool) -> ExplorableCapabilities:
    """Project SQL operations while honoring existing sample/detail overrides."""
    supported: set[ExplorableOperation] = {
        ExplorableOperation.RAW_ROWS,
        ExplorableOperation.ADHOC_METRICS,
        ExplorableOperation.SQL_LAB,
    }
    if samples:
        supported.add(ExplorableOperation.SAMPLES)
    if drill_to_detail:
        supported.add(ExplorableOperation.DRILL_TO_DETAIL)
    return ExplorableCapabilities(
        supported=frozenset(supported),
        supported_operators=frozenset(operator.value for operator in FilterOperator),
    )
