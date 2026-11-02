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
"""No two lifecycle transitions may commit on the same request.

Each transition reads the status and asks whether it permits the move.
Unlocked, two of them both read the old status, both pass their own guard,
and both write, so the guards decide nothing.

129071 was the approve case and the row lock answered it -- but only
``approve`` was given the lock. Found by firing Submit and Discard together
on one draft: both returned 200, and the row came back ``status='pending'``
with ``decided_at``, a ``reviewer_fk`` and ``active_slot=None``. Pending by
status, decided by its columns, and the asset unlocked. The author was told
"Changes discarded."; the request stayed in the approver's queue, was
approved, and published to the live dashboard.

That is the control failing in the direction it exists to prevent, so the
lock belongs to the lifecycle rather than to the one transition whose bug
report happened to name it. A race is awkward to drive from a unit test --
it needs two sessions and real contention -- and a behavioural test would
pass against the broken code whenever the timing missed. The defect was
structural: four transitions did not take the lock. So is this.
"""

from __future__ import annotations

import inspect

import pytest
from asset_approval import lifecycle

# Everything that moves a request from one status to another.
TRANSITIONS = ["submit", "approve", "request_changes", "withdraw", "discard"]


@pytest.mark.parametrize("name", TRANSITIONS)
def test_the_transition_loads_its_request_under_the_lock(name: str) -> None:
    source = inspect.getsource(getattr(lifecycle, name))

    assert "_locked(change_request_id)" in source, (
        f"{name} reads the request without the row lock, so its status "
        "guard can be raced"
    )
    assert "find(change_request_id)" not in source


def test_every_transition_is_covered_by_this_file() -> None:
    """A sixth transition added later must be listed above.

    The bug was one transition holding the lock while its siblings did not,
    which is exactly what a hand-maintained list drifts into.
    """
    declared = {
        name
        for name, value in vars(lifecycle).items()
        if not name.startswith("_")
        and inspect.isfunction(value)
        and "set_status(" in inspect.getsource(value)
    }

    assert declared == set(TRANSITIONS)


def test_the_lock_reads_committed_state() -> None:
    """The lock has to refresh the row it locks.

    SQLAlchemy hands back a row already in the identity map with its
    attributes as they were first loaded. Without ``populate_existing`` the
    guard would read a stale ``status`` while holding the lock, which looks
    exactly like the bug it was added to fix.
    """
    source = inspect.getsource(lifecycle._locked)

    assert "with_for_update()" in source
    assert "populate_existing()" in source
