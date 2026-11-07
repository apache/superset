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
"""The sentences a refusal hands back, held to the standard the suite already
applies to some of them.

A test leak, found by a sweep of this suite. Several of these strings had no
assertion anywhere: the alternative offered when a write is refused outside
the editor, the one offered when an annotation layer is in use, the note a
deferred first publish carries, and the whole sentence of a stale-baseline
refusal. They could be blanked, or rewritten to send the reader somewhere
they cannot go, and nothing failed.

The standard is the suite's own, set by ``test_no_approver_says_so_and_says
_what_to_do`` ("Add another editor" has to be in the message) and by
``test_import_refusal`` (the message must not tell them to ask an
administrator to turn review off -- the flag is global and needs a restart,
so that is an instruction nobody in the room can follow, the S-06 class).
Those negatives existed on one refusal and were never extended to the rest.
"""

from __future__ import annotations

import pytest
from asset_approval import gate
from asset_approval.exceptions import StaleBaselineError

#: Every alternative the write guard offers, with what makes each usable.
ALTERNATIVES = {
    "_EDITOR": ("in the editor", "update call"),
    "_IN_USE_ANNOTATION": ("Create a new layer", "chart editor"),
    "_PLACE_CHART": ("Save the chart",),
}


@pytest.mark.parametrize("name,required", sorted(ALTERNATIVES.items()))
def test_an_alternative_names_a_surface_the_reader_can_reach(
    name: str, required: tuple[str, ...]
) -> None:
    """Each one has to say where to go, not just that the way is barred."""
    message = getattr(gate, name)

    assert message.strip(), f"{name} is empty"
    for phrase in required:
        assert phrase in message, f"{name} no longer says {phrase!r}"


@pytest.mark.parametrize("name", sorted(ALTERNATIVES))
def test_and_never_sends_them_to_an_administrator(name: str) -> None:
    """The S-06 class. ``CHANGE_MANAGEMENT`` is a global flag that needs a
    restart, so "ask an administrator to turn review off" is an instruction
    the reader cannot act on and the operator would refuse.

    ``ImportOverwriteRefusedError`` carries exactly these two negatives
    (``test_import_refusal``). They were never extended to the alternatives
    the guard hands to every raw write it refuses.
    """
    message = getattr(gate, name)

    assert "administrator" not in message
    assert "turn review off" not in message


def test_the_note_on_a_deferred_first_publish_says_why_it_is_a_draft() -> None:
    """The author submitted a published dashboard and got a draft. This note
    is the only thing that explains it, and nothing asserted it."""
    assert "Created as a draft" in gate.FIRST_PUBLISH_NOTE
    assert "through review" in gate.FIRST_PUBLISH_NOTE
    assert "administrator" not in gate.FIRST_PUBLISH_NOTE


class TestTheStaleBaselineRefusal:
    """Its detection is covered; its sentence was asserted nowhere.

    The sentence is the whole value of the refusal: a reviewer stopped
    without being told which fields moved cannot tell a real conflict from a
    bug, and has nothing to do next.
    """

    def test_it_names_the_fields_that_moved(self) -> None:
        message = str(StaleBaselineError(["description", "dashboard_title"]))

        assert "description" in message
        assert "dashboard_title" in message

    def test_it_says_what_approving_would_do(self) -> None:
        message = str(StaleBaselineError(["sql"]))

        assert "publish the older version over it" in message

    def test_it_offers_both_ways_out(self) -> None:
        message = str(StaleBaselineError(["sql"]))

        assert "save" in message
        assert "discard" in message

    def test_one_field_reads_as_one_field(self) -> None:
        """Said in the singular, or the refusal reads as a wider conflict
        than it is."""
        assert "This field has changed" in str(StaleBaselineError(["sql"]))

    def test_several_fields_read_as_the_asset(self) -> None:
        assert "This asset has changed" in str(
            StaleBaselineError(["sql", "description"])
        )

    def test_it_is_a_conflict_not_a_bad_request(self) -> None:
        """409. The call was well formed; the asset moved under it."""
        assert StaleBaselineError(["sql"]).status == 409
