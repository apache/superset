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

"""
SQL building blocks for the pivot-table non-additive totals optimization
(SIP.md, phase 3b). When a datasource engine reports
``supports_grouping_sets``, the N per-rollup-level queries can be collapsed into
a single ``GROUPING SETS`` query: the database computes every level in one scan,
and each returned row is attributed to its level via ``GROUPING()`` markers.

These are the engine-agnostic SQL primitives. Wiring them into the query context
(emitting one query and splitting the result back into per-level results) is the
remaining integration; see SIP.md.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Final

import pandas as pd
from sqlalchemy import func, tuple_
from sqlalchemy.sql.elements import ColumnElement

# Suffix for the per-column GROUPING() marker columns added to a GROUPING SETS
# query. Chosen to be unlikely to collide with a real metric/column label.
GROUPING_MARKER_SUFFIX: Final = "__superset_grouping"


def grouping_marker_label(column_label: str) -> str:
    """The output label of the GROUPING() marker for a groupby column."""
    return f"{column_label}{GROUPING_MARKER_SUFFIX}"


def grouping_sets_clause(
    groups: Sequence[Sequence[ColumnElement]],
) -> ColumnElement:
    """
    Build a ``GROUP BY GROUPING SETS (...)`` clause from rollup column groups.

    Each group is the set of columns grouped at one rollup level; the empty
    group ``()`` is the grand total. For example, groups ``[[a, b], [a], []]``
    produce ``GROUPING SETS ((a, b), (a), ())``.

    :param groups: one column list per rollup level
    :return: a clause element suitable for ``select(...).group_by(...)``
    """
    return func.grouping_sets(*[tuple_(*group) for group in groups])


def grouping_id_column(column: ColumnElement, label: str) -> ColumnElement:
    """
    Build a ``GROUPING(col) AS label`` marker column.

    In a ``GROUPING SETS`` result, ``GROUPING(col)`` is ``0`` when ``col`` is
    part of the row's grouping level and ``1`` when it has been rolled up
    (aggregated away). Selecting one marker per groupby column lets the caller
    attribute each returned row to its rollup level when splitting the single
    result back into per-level results.

    :param column: the groupby column to probe
    :param label: the output label for the marker (see ``grouping_marker_label``)
    :return: the labelled ``GROUPING(col)`` column
    """
    return func.grouping(column).label(label)


def split_grouping_sets_result(
    df: pd.DataFrame,
    levels: Sequence[Sequence[str]],
    groupby_columns: Sequence[str],
) -> list[pd.DataFrame]:
    """
    Split a combined ``GROUPING SETS`` result into one DataFrame per rollup
    level, the inverse of {@link grouping_sets_clause}.

    Each row of ``df`` carries a ``GROUPING()`` marker per groupby column (named
    by ``grouping_marker_label``): ``0`` if the column is grouped at that row's
    level, ``1`` if it was rolled up. A row belongs to a level iff its markers
    are ``0`` exactly for that level's columns. Marker columns are dropped from
    the returned frames so each looks like an ordinary per-level query result.

    :param df: the combined query result, including marker columns
    :param levels: the grouped-column list for each rollup level (same order as
        passed to ``grouping_sets_clause``)
    :param groupby_columns: every groupby column that has a marker
    :return: one DataFrame per level, in ``levels`` order
    """
    markers: list[str] = [grouping_marker_label(col) for col in groupby_columns]
    results: list[pd.DataFrame] = []
    for level in levels:
        grouped: set[str] = set(level)
        mask: pd.Series = pd.Series(True, index=df.index)
        for col in groupby_columns:
            expected = 0 if col in grouped else 1
            mask &= df[grouping_marker_label(col)] == expected
        level_df = (
            df[mask]
            .drop(columns=[m for m in markers if m in df.columns])
            .reset_index(drop=True)
        )
        results.append(level_df)
    return results
