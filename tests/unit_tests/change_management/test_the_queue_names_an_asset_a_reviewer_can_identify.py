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
"""A row in the reviewer's queue has to name a particular asset.

Found in a QA round: the queue offered an approval on a row labelled
"[ untitled dashboard ]", whose change proposed `published: false -> true`.
So a reviewer was asked to make a dashboard public, identified only by
Superset's own default title -- which every unnamed dashboard carries, and
there is usually more than one.

Nothing was fabricated: `_asset_title` returned the stored name verbatim and
that is genuinely what the dashboard is called. The defect is that a
decision was offered about an asset the decider cannot pick out.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from asset_approval.api import _asset_title, UNNAMED_DASHBOARD


def test_a_named_asset_is_called_what_it_is_called() -> None:
    assert _asset_title(SimpleNamespace(id=4, dashboard_title="Q4 Revenue")) == (
        "Q4 Revenue"
    )


def test_an_unnamed_dashboard_carries_its_id() -> None:
    """Enough to tell it from the other unnamed ones."""
    title = _asset_title(SimpleNamespace(id=139, dashboard_title=UNNAMED_DASHBOARD))

    assert title == f"{UNNAMED_DASHBOARD} #139"


def test_two_unnamed_dashboards_do_not_read_as_the_same_row() -> None:
    """The whole point. A queue of identical labels is a queue of decisions
    nobody can take."""
    first = _asset_title(SimpleNamespace(id=139, dashboard_title=UNNAMED_DASHBOARD))
    second = _asset_title(SimpleNamespace(id=152, dashboard_title=UNNAMED_DASHBOARD))

    assert first != second


@pytest.mark.parametrize("blank", ["", "   "])
def test_a_blank_name_is_treated_the_same_way(blank: str) -> None:
    """A chart or dataset saved with an empty name, which the legacy
    ``saveas`` route can create."""
    title = _asset_title(SimpleNamespace(id=308, slice_name=blank))

    assert "#308" in title


def test_an_unnamed_asset_with_no_id_still_says_something() -> None:
    assert _asset_title(
        SimpleNamespace(id=None, dashboard_title=UNNAMED_DASHBOARD)
    ) == UNNAMED_DASHBOARD


def test_an_asset_with_no_name_field_at_all_has_no_title() -> None:
    """Unchanged: the queue renders its own placeholder for this."""
    assert _asset_title(SimpleNamespace(id=1)) is None


def test_a_name_that_merely_contains_the_placeholder_is_left_alone() -> None:
    """Somebody's real title, which happens to mention it."""
    assert _asset_title(
        SimpleNamespace(id=7, dashboard_title=f"Audit of {UNNAMED_DASHBOARD}")
    ) == f"Audit of {UNNAMED_DASHBOARD}"
