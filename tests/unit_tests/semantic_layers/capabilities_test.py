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

"""Contract tests for the host's strict feature projection."""

from enum import Enum

import pytest
from superset_core.semantic_layers.view import SemanticViewFeature

from superset.semantic_layers.capabilities import supported_view_features


class LookalikeFeature(Enum):
    """A provider enum is not the SDK enum even with the same value."""

    GROUP_LIMIT = "GROUP_LIMIT"


@pytest.mark.parametrize(
    "declarations", [None, 7, "GROUP_LIMIT", {SemanticViewFeature.GROUP_LIMIT: True}]
)
def test_malformed_containers_grant_nothing(declarations: object) -> None:
    """Only concrete declaration lists/sets are tolerated."""
    assert supported_view_features(declarations) == frozenset()


def test_only_supported_sdk_members_survive() -> None:
    """Reserved, unknown, raw, lookalike and unhashable entries cannot grant."""
    declarations: list[object] = [
        *SemanticViewFeature,
        "GROUP_LIMIT",
        "FUTURE",
        7,
        None,
        LookalikeFeature.GROUP_LIMIT,
        {},
        [],
    ]
    assert supported_view_features(declarations) == frozenset(
        {
            SemanticViewFeature.GROUP_LIMIT,
            SemanticViewFeature.GROUP_OTHERS,
            SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY,
            SemanticViewFeature.ROW_OFFSET,
        }
    )
    assert (
        SemanticViewFeature.ADHOC_COLUMN_EXPRESSIONS.value == "ADHOC_COLUMN_EXPRESSIONS"
    )
