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

#: Where a test may claim a row. Relative to the repository root.
TEST_TREES = (
    "tests/unit_tests/change_management",
    "superset-frontend/src/features/changeManagement",
    "local_extensions/asset-approval/frontend/src",
    "superset-frontend/playwright/tests",
)

ROW = re.compile(r"\b(QA-\d+[ab]?|S-\d+|R[2-5]-\d+|NEW-\d+|1290\d\d|sc-13\d\d\d\d)\b")

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
)

#: Rows with no test naming them, and why. Shrink this; do not grow it.
NO_TEST_NAMES_IT: dict[str, str] = {
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


def _rows_named_by_tests(repo_root: str) -> set[str]:
    named: set[str] = set()
    for tree in TEST_TREES:
        root = os.path.join(repo_root, tree)
        if not os.path.isdir(root):
            # Playwright coverage may not be installed in every checkout.
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
                    named |= set(ROW.findall(handle.read()))
    return named


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
