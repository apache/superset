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
"""Every row this epic has ever been judged on has a home, or a reason.

Nine months of QA left a corpus scattered across four documents and an
external tracker: the 45 rows of SC-124561, twelve defects found by walking
and never filed, nine adversarial attacks, eleven product-acceptance
tickets, a retest run and four bugs found while recording the demo. The
only way anyone knew what was covered was to read all of it and remember.

So this is the index, and it is executable. A row is covered when a test
somewhere names it -- pytest here, jest under
``superset-frontend/src/features/changeManagement``, the extension's own
jest, or Playwright. A row that no test names has to be listed below with
the reason, and a row listed below that a test *has* started naming fails
this too, so the list shrinks as coverage lands instead of going stale.

Naming a row is not the same as covering it, and this cannot check that.
What it can stop is the thing that actually happened here repeatedly: a row
quietly having no owner at all.
"""

from __future__ import annotations

import os
import re

import pytest

#: Where a test may claim a row, and which layer it speaks for. Relative to
#: the repository root.
#:
#: The layer matters because a row can be named at the wrong one. A backend
#: test asserting the server refuses with 422 is not coverage of a row about
#: a button being unavailable, and for QA-20 and QA-93 exactly that stood in
#: for the frontend tests that were deleted with the screens they tested.
TEST_TREES: dict[str, str] = {
    "tests/unit_tests/change_management": "backend",
    "superset-frontend/src/features/changeManagement": "frontend",
    "local_extensions/asset-approval/frontend/src": "frontend",
    "superset-frontend/playwright/tests": "e2e",
}

#: A tree that is allowed to be absent, and why.
#:
#: Anything else missing is a failure. A tree listed here as holding
#: assertions and then not existing is the event most worth a red build --
#: it is how three renderers went missing while this file reported the same
#: 74 rows named as before. It used to `continue` past any absent tree under
#: a comment about Playwright, so a whole frontend tree vanishing was
#: indistinguishable from an uninstalled browser suite.
MAY_BE_ABSENT: dict[str, str] = {
    "superset-frontend/src/features/changeManagement": (
        "these screens moved into local_extensions/asset-approval; the "
        "directory is gone wherever that migration has landed"
    ),
    "superset-frontend/playwright/tests": (
        "the browser suite is not installed in every checkout"
    ),
}

#: Rows whose defect is something a person reads on screen, so a backend
#: test naming them is not coverage. Grow this: a row belongs here the
#: moment someone could see it go wrong.
NEEDS_A_FRONTEND_TEST: frozenset[str] = frozenset(
    {
        # QA-93 is deliberately not here: it is quoted in test docstrings
        # but is not a row of SC-124561, so the corpus does not carry it.
        "QA-20",  # Request review offered when nobody can approve
        "QA-22",  # the live-asset link under a subdirectory deployment
        "129075",  # what a first save lists, and under which names
    }
)

#: ``R\d+`` rather than ``R[2-5]``: the pattern stopped at round 5 while the
#: tracker kept going, so a test that *did* name an R7 or R8 row was not
#: counted as naming it and the row read as uncovered. Both halves of this
#: file were wrong about rounds 6 to 8 -- the corpus did not list them and
#: the scanner could not see them.
ROW = re.compile(
    r"\b(QA-\d+[ab]?|S-\d+|R\d+-\d+|NEW-\d+|1290\d\d|sc-13\d\d\d\d)\b"
)

#: Every row, by where it came from.
CORPUS: tuple[str, ...] = (
    # SC-124561, the tracker QA kept
    tuple(f"QA-{n:02d}" for n in range(1, 27))
    + ("QA-18a", "QA-18b")
    + tuple(f"S-{n:02d}" for n in range(1, 10))
    + ("R2-01", "R3-01")
    + tuple(f"R4-{n:02d}" for n in range(1, 9))
    + tuple(f"R5-{n:02d}" for n in range(1, 6))
    # Found by walking the product, never filed
    + tuple(f"NEW-{n}" for n in range(1, 13))
    # Elizabeth's product acceptance set
    + tuple(str(n) for n in range(129068, 129079))
    # Found while recording the demo
    + tuple(f"sc-1310{n}" for n in range(31, 35))
    # Diego's rounds 6 to 8. The corpus stopped at R5 while the tracker kept
    # going, so these rows could regress with nothing here going red -- and
    # the regression sheet has about eight more rows than this file knows
    # ids for, which is exactly round 7.
    + ("R6-01",)
    + tuple(f"R7-{n:02d}" for n in range(1, 9))
    # R8 has four rows, not one. 02 to 04 were missing here while the sheet
    # carried them, which is the R7-07 failure again one round later.
    + tuple(f"R8-{n:02d}" for n in range(1, 5))
    + ("sc-132028",)
    # Run 9 (de5d730, 2026-11-06) raised no row of its own. It was a retest
    # column on SC-124561 -- 19 fixed, 2 partly, 1 not, 46 not retested --
    # and every result landed on a row already listed above. There is no
    # R9-nn to add, and the jump from R8 to R10 here is that, not an
    # oversight: read against the sheet on 2026-11-11.
    #
    # Round 10, from the full-run message of the same day. R10-02 is the
    # 500-instead-of-409 on a decided change, fixed in this branch; the
    # other three are the Lows product chose to defer, so they are open
    # defects with no test rather than covered behaviour.
    + tuple(f"R10-{n:02d}" for n in range(1, 5))
)

#: Rows with no test naming them, and why. Shrink this; do not grow it.
NO_TEST_NAMES_IT: dict[str, str] = {
    # Rounds 6 and 7, added to the corpus above so they are at least
    # enumerated. These are a traceability gap rather than a coverage gap:
    # the behaviour each describes is exercised somewhere in this suite --
    # that was checked row by row -- but no test quotes the row id, so
    # nothing ties the two together and a reader cannot get from the
    # tracker to the test. Closing one means adding its id to the test that
    # already covers it, which needs the tracker's own wording for the row;
    # inventing a mapping from the id alone would be worse than the gap.
    # R7-03 and R7-05 are already named by tests and are deliberately not
    # listed here.
    "R6-01": "behaviour covered; the row id is quoted by no test yet",
    "R7-01": "behaviour covered; the row id is quoted by no test yet",
    "R7-02": "behaviour covered; the row id is quoted by no test yet",
    "R7-04": "behaviour covered; the row id is quoted by no test yet",
    "R7-06": "behaviour covered; the row id is quoted by no test yet",
    "R7-07": "behaviour covered; the row id is quoted by no test yet",
    # Round 8's other three, all recorded Fixed on the sheet and none of
    # them quoted by a test. Two are about the deny-by-default guard's
    # blast radius and one is the container's own test run, so they are
    # traceability gaps of the R6/R7 kind rather than untested behaviour --
    # written out so the next reader does not have to open the sheet.
    "R8-02": (
        "fixed: an extension that fails to load left viewers unable to "
        "render any chart and refused SQL Lab with 503; no test quotes it"
    ),
    "R8-03": (
        "fixed: 'Request changes' was always refused as stale (409), so "
        "reviewers could not send a change back; no test quotes it"
    ),
    "R8-04": (
        "fixed: 17 of the extension's own unit tests failed in QA's "
        "container (deny-by-default guard tests); no test quotes it"
    ),
    # Round 10's three Lows. Open defects, deferred by product on
    # 2026-11-11 ("let's skip all the low priorities unless the customer
    # brings them up"), so there is nothing passing to pin yet -- each one
    # is written out here so the row cannot go missing the way R7-07 did,
    # and so whoever picks one up knows what it claims.
    "R10-01": (
        "open Low: restoring a version of a dashboard that was never "
        "published still says 'Viewers still see the live version'"
    ),
    "R10-03": (
        "open Low: editors changed alongside other properties do go "
        "through review, but the UI says they need no approval"
    ),
    "R10-04": (
        "open Low: a refused save-as in Explore surfaces only "
        "'Failed to save slice', not the refusal's own sentence"
    ),
    # Nobody can write a test for a claim nobody can state. The text is not
    # in any document, source file or test here, and the tracker story was
    # read end to end -- description, every comment, the whole activity log
    # -- without a single QA-nn row on it. They need pasting in from the
    # sheet those ids belong to before they mean anything.
    "QA-01": "text exists only in the external tracker",
    "QA-06": "text exists only in the external tracker",
    "QA-08": "text exists only in the external tracker",
    # Decisions and open questions, not behaviour. A test would be asserting
    # that somebody had made up their mind.
    "S-09": "a branch-target decision, recorded in BUILD-TARGET.md",
    "R5-05": "an open spec question for Visa, not a defect",
    "129072": "imports are a scope decision for Visa (SOW 5.1, Q12)",
    "QA-18b": (
        "a first publish shows the approver only published:false -> true; "
        "what was built while unpublished is not enumerated anywhere, so "
        "there is no behaviour to assert until the signal exists"
    ),
    # Need the browser, and are not yet in the Playwright suite.
    "QA-02": "a refused legacy save must not have already mutated the dataset",
    "QA-04": "a filter refused with 409 must be visible, not a vanished filter",
    "R4-07": "banner and Request review appear on first save with no reload",
    "129077": "the Published toggle is held and its copy does not contradict it",
    "S-03": "an exempt change made during review survives the approval",
}


def _rows_by_layer(repo_root: str) -> dict[str, set[str]]:
    """Every row each layer's tests name, keyed by layer.

    Absent trees are not skipped here -- ``test_every_tree_is_present_or_
    accounted_for`` decides whether an absence is allowed, so this only has
    to walk what exists.
    """
    found: dict[str, set[str]] = {layer: set() for layer in TEST_TREES.values()}
    for tree, layer in TEST_TREES.items():
        root = os.path.join(repo_root, tree)
        if not os.path.isdir(root):
            continue
        for directory, _, filenames in os.walk(root):
            if "node_modules" in directory:
                continue
            for filename in filenames:
                if not filename.endswith((".py", ".ts", ".tsx")):
                    continue
                if "test" not in filename and "spec" not in filename:
                    continue
                if filename == os.path.basename(__file__):
                    # This file names every row it exempts, so counting it
                    # would report the whole corpus as covered by the index
                    # of what is not covered.
                    continue
                with open(
                    os.path.join(directory, filename), encoding="utf8", errors="replace"
                ) as handle:
                    found[layer] |= set(ROW.findall(handle.read()))
    return found


def _rows_named_by_tests(repo_root: str) -> set[str]:
    return set().union(*_rows_by_layer(repo_root).values())


@pytest.fixture(scope="module")
def named(repo_root: str) -> set[str]:
    return _rows_named_by_tests(repo_root)


@pytest.fixture(scope="module")
def repo_root() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", ".."))


def test_the_corpus_has_no_duplicates() -> None:
    assert len(CORPUS) == len(set(CORPUS))


def test_every_row_is_covered_or_accounted_for(named: set[str]) -> None:
    orphans = sorted(
        row for row in CORPUS if row not in named and row not in NO_TEST_NAMES_IT
    )

    assert not orphans, (
        "These rows have no test naming them and no reason recorded: "
        f"{', '.join(orphans)}. Either cover one, or add it to "
        "NO_TEST_NAMES_IT with the reason."
    )


def test_the_exemption_list_does_not_go_stale(named: set[str]) -> None:
    """A row that has picked up a test must leave the list."""
    covered_after_all = sorted(row for row in NO_TEST_NAMES_IT if row in named)

    assert not covered_after_all, (
        "These rows are listed as having no test, but a test names them now: "
        f"{', '.join(covered_after_all)}. Remove them from NO_TEST_NAMES_IT."
    )


def test_the_exemption_list_only_holds_real_rows() -> None:
    strays = sorted(set(NO_TEST_NAMES_IT) - set(CORPUS))

    assert not strays, f"Not rows of this corpus: {', '.join(strays)}"


def test_every_exemption_gives_a_reason() -> None:
    assert all(reason.strip() for reason in NO_TEST_NAMES_IT.values())


def test_most_of_the_corpus_is_actually_covered(named: set[str]) -> None:
    """A floor, so coverage cannot quietly be traded away for exemptions.

    Not a target to game: the point of the number is that it only moves in
    one direction without somebody noticing.
    """
    covered = [row for row in CORPUS if row in named]

    assert len(covered) >= 60, (
        f"only {len(covered)} of {len(CORPUS)} rows are named by a test"
    )


def test_every_tree_is_present_or_accounted_for(repo_root: str) -> None:
    """A tree that was supposed to hold assertions cannot just disappear.

    This file used to walk past any missing directory under a comment about
    Playwright. `superset-frontend/src/features/changeManagement` then went
    away with the migration into the extension, taking the frontend tests
    for `pending_dependency`, `first_time`, QA-20 and QA-93 with it -- and
    the count of rows named did not move, because the extension's own tests
    named enough ids to replace it. Same number, three fewer renderers.
    """
    vanished = sorted(
        tree
        for tree in TEST_TREES
        if not os.path.isdir(os.path.join(repo_root, tree))
        and tree not in MAY_BE_ABSENT
    )

    assert not vanished, (
        f"These trees are listed as holding assertions and do not exist: "
        f"{', '.join(vanished)}. Either the tests moved -- point TEST_TREES "
        "at where they went -- or they were deleted, in which case the rows "
        "they covered are uncovered now. Add it to MAY_BE_ABSENT only when "
        "the absence is the intended state and you can say why."
    )


def test_a_screen_row_is_not_held_up_by_a_backend_test(repo_root: str) -> None:
    """Rows about what a person sees need a test that renders it.

    The shape both defects took: the server went on sending the field, the
    backend test asserting it kept passing, and nothing drew it. The row
    read as covered off the backend namer alone.
    """
    layers = _rows_by_layer(repo_root)
    on_screen = layers["frontend"] | layers["e2e"]
    unseen = sorted(
        row
        for row in NEEDS_A_FRONTEND_TEST
        if row in CORPUS and row not in NO_TEST_NAMES_IT and row not in on_screen
    )

    assert not unseen, (
        f"These rows are about something on screen and only a backend test "
        f"names them: {', '.join(unseen)}. A backend test proves the server "
        "answers; it cannot prove anything was drawn. Name the row in the "
        "test that renders it."
    )


def test_the_screen_row_list_only_holds_real_rows() -> None:
    strays = sorted(NEEDS_A_FRONTEND_TEST - set(CORPUS))

    assert not strays, f"Not rows of this corpus: {', '.join(strays)}"
