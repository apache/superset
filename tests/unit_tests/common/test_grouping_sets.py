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

import pandas as pd
from sqlalchemy import column, select
from sqlalchemy.dialects import postgresql

from superset.common.grouping_sets import (
    grouping_id_column,
    grouping_marker_label,
    grouping_sets_clause,
    split_grouping_sets_result,
)


def _compile(stmt) -> str:
    return str(
        stmt.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    ).replace("\n", " ")


def test_grouping_sets_clause_emits_rollup_levels() -> None:
    a, b = column("a"), column("b")
    # rollup hierarchy: leaf (a, b), row subtotal (a), grand total ()
    stmt = select(a, b).group_by(grouping_sets_clause([[a, b], [a], []]))
    sql = _compile(stmt)
    assert "GROUPING SETS((a, b), (a), ())" in sql


def test_grouping_sets_single_level() -> None:
    a = column("a")
    stmt = select(a).group_by(grouping_sets_clause([[a]]))
    assert "GROUPING SETS((a))" in _compile(stmt)


def test_grouping_id_marker_column() -> None:
    a = column("a")
    stmt = select(a, grouping_id_column(a, "a__grouping"))
    sql = _compile(stmt).lower()
    assert "grouping(a) as a__grouping" in sql


def _gm(col: str) -> str:
    return grouping_marker_label(col)


def test_split_grouping_sets_result_by_level() -> None:
    # Combined GROUPING SETS result for groupby [region, topic] with levels
    # leaf [region, topic], row subtotal [region], grand total [].
    df = pd.DataFrame(
        [
            {
                "region": "US",
                "topic": "a",
                "value": 10,
                _gm("region"): 0,
                _gm("topic"): 0,
            },
            {
                "region": "US",
                "topic": "b",
                "value": 20,
                _gm("region"): 0,
                _gm("topic"): 0,
            },
            {
                "region": "US",
                "topic": None,
                "value": 30,
                _gm("region"): 0,
                _gm("topic"): 1,
            },
            {
                "region": None,
                "topic": None,
                "value": 60,
                _gm("region"): 1,
                _gm("topic"): 1,
            },
        ]
    )
    leaf, subtotal, grand = split_grouping_sets_result(
        df,
        [["region", "topic"], ["region"], []],
        ["region", "topic"],
    )

    # Marker columns are stripped from every level.
    for frame in (leaf, subtotal, grand):
        assert not any(col.endswith("__superset_grouping") for col in frame.columns)

    assert leaf["value"].tolist() == [10, 20]
    assert subtotal["value"].tolist() == [30]
    assert subtotal["region"].tolist() == ["US"]
    assert grand["value"].tolist() == [60]
