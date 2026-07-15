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
"""Regression test for #40501.

Time comparisons using a relative offset (e.g. ``'365 days ago'``) on
coarse time grains (``month`` / ``quarter`` / ``year``) previously
snapped the compared bucket to the full grain boundary when the current
period was not fully aligned to the grain. On ``2026-05-01 :
2026-05-28`` with ``month`` grain, the ``365 days ago`` comparison
covered all of May 2025 instead of only the first 28 days.

Root cause: ``ExploreMixin.processing_time_offsets`` set
``inner_from_dttm`` / ``inner_to_dttm`` to the shifted range in the
relative-offset branch, while the sibling date-range branch left them
unset. The fix aligns the two branches — both leave inner bounds
``None`` so the downstream subquery uses one WHERE clause on the
shifted outer range instead of layering a second, semantically-different
filter that widened the bucket via the semantic-layer subquery-bounds
path.

Pinned at the source level because ``processing_time_offsets`` executes
real datasource queries end-to-end — mocking the full call chain just to
inspect a local variable inside a ~250-line method would be far more
fragile than reading the committed source.
"""

from __future__ import annotations

import inspect
import re

from superset.models.helpers import ExploreMixin

_SOURCE = inspect.getsource(ExploreMixin.processing_time_offsets)


def test_relative_offset_leaves_inner_dttm_none() -> None:
    """The relative-offset branch must not assign the shifted range to
    ``inner_from_dttm`` / ``inner_to_dttm`` — doing so re-introduces
    #40501 (partial-period comparisons snap to the full grain bucket on
    coarse time grains).
    """
    forbidden_from = re.compile(r"inner_from_dttm\s*=\s*query_object_clone\.from_dttm")
    forbidden_to = re.compile(r"inner_to_dttm\s*=\s*query_object_clone\.to_dttm")
    assert not forbidden_from.search(_SOURCE), (
        "processing_time_offsets assigns inner_from_dttm to the shifted "
        "range — re-introduces #40501. Set to ``None`` instead."
    )
    assert not forbidden_to.search(_SOURCE), (
        "processing_time_offsets assigns inner_to_dttm to the shifted "
        "range — re-introduces #40501. Set to ``None`` instead."
    )


def test_relative_offset_branch_has_none_assignment() -> None:
    """Positive check: both branches (relative + date-range) must
    contain explicit ``inner_from_dttm = None`` / ``inner_to_dttm =
    None`` assignments so the shifted outer range is used as the sole
    time filter. See #40501.
    """
    from_none_count = len(re.findall(r"inner_from_dttm\s*=\s*None", _SOURCE))
    to_none_count = len(re.findall(r"inner_to_dttm\s*=\s*None", _SOURCE))
    assert from_none_count >= 2, (
        f"Expected inner_from_dttm=None in both offset branches; found "
        f"{from_none_count}. See #40501."
    )
    assert to_none_count >= 2, (
        f"Expected inner_to_dttm=None in both offset branches; found "
        f"{to_none_count}. See #40501."
    )
