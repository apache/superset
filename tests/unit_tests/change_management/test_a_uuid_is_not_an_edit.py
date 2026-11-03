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
"""A column's identity is not its content.

Found by submitting a change that moved exactly one field -- a dataset's
SQL -- and reading what the reviewer was handed back:

    changed_fields: ['columns', 'description', 'metrics', 'sql']
    dataset_detail.columns: {added: [], changed: [], removed: []}
    dataset_detail.metrics: {added: [], changed: [], removed: []}

The same payload contradicted itself. Every dataset change reported its
columns and metrics as edited, whatever the author had really touched, so
the one list a checker reads first was noise on every single review.

The cause is a type, not a value. A stored payload is JSON, so its ``uuid``
comes back a ``str``; the live ORM row holds a ``uuid.UUID``. The two never
compare equal, and ``uuid`` was not among the fields the comparison skips
although ``id`` -- the same kind of thing -- always has been.

Capture was never wrong, which is why nothing caught this: the gate
compares the in-memory command body, where both sides are still ``UUID``.
Only the read-back re-parses the stored JSON. So the author saw the truth
and the reviewer saw the noise.
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

from asset_approval.changes import (
    IDENTITY_FIELDS,
    _named_list_differs,
    _parsed,
)

COLUMN_UUID = uuid4()


def _stored_column(**overrides: object) -> dict[str, object]:
    """A column as it comes back out of the stored payload: JSON, so ``str``."""
    return {
        "column_name": "count",
        "uuid": str(COLUMN_UUID),
        "verbose_name": "Station name",
        **overrides,
    }


def _live_column(**overrides: object) -> SimpleNamespace:
    """The same column as the ORM holds it: a real ``UUID`` object."""
    return SimpleNamespace(
        column_name="count",
        uuid=COLUMN_UUID,
        verbose_name="Station name",
        **overrides,
    )


def test_the_same_column_written_two_ways_is_not_a_change() -> None:
    """The defect itself, at the smallest size it can be reproduced."""
    assert (
        _named_list_differs([_live_column()], [_stored_column()], "column_name")
        is False
    )


def test_a_column_that_really_moved_is_still_a_change() -> None:
    """The fix must not buy its silence by going blind."""
    assert (
        _named_list_differs(
            [_live_column()],
            [_stored_column(verbose_name="Station")],
            "column_name",
        )
        is True
    )


def test_uuid_is_skipped_for_the_same_reason_id_is() -> None:
    """Structural, so the pair cannot drift apart again.

    ``id`` was skipped from the start and ``uuid`` was not, although both
    say which row this is rather than what it holds.
    """
    assert "id" in IDENTITY_FIELDS
    assert "uuid" in IDENTITY_FIELDS


def test_a_uuid_compares_equal_to_its_own_string() -> None:
    """The type-level half, so a *different* field cannot repeat this."""
    assert _parsed(COLUMN_UUID) == _parsed(str(COLUMN_UUID))
    assert _parsed(UUID(int=0)) != _parsed(str(uuid4()))
