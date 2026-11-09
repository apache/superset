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
"""Identity boundaries must not become content-validity membership changes."""

from datetime import datetime

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from superset.versioning.changes.identity import attachment_uuid_at_tx, attachment_uuids

BEFORE = datetime(2026, 1, 1)
ATTACHED = datetime(2026, 1, 2)
AFTER = datetime(2026, 1, 3)


def resolve(rows, start=2, tx=2, **kwargs):
    return attachment_uuid_at_tx(rows, start, tx, **kwargs)


@pytest.mark.parametrize("tx", [2, 3])
def test_first_content_after_attachment_has_same_identity_on_both_sides(tx):
    assert (
        resolve(
            [("old", 3, None, 1)],
            tx=tx,
            live_uuid="old",
            live_created_on=BEFORE,
            attached_at=ATTACHED,
        )
        == "old"
    )


@pytest.mark.parametrize("created", [ATTACHED, AFTER, None])
def test_pruned_old_chain_does_not_assign_new_chart_to_old_window(created):
    assert (
        resolve(
            [("new", 3, None, 1)],
            live_uuid="new",
            live_created_on=created,
            attached_at=ATTACHED,
        )
        is None
    )


@pytest.mark.parametrize(
    "kwargs",
    [
        {},
        {"live_uuid": "old", "live_created_on": BEFORE},
        {"live_uuid": "different", "live_created_on": BEFORE, "attached_at": ATTACHED},
    ],
)
def test_missing_or_conflicting_witness_does_not_extrapolate(kwargs):
    assert resolve([("old", 3, None, 1)], **kwargs) is None


@pytest.mark.parametrize("tx", [2, 3, 4])
def test_content_validity_gap_does_not_change_membership(tx):
    assert resolve([("old", 1, 3, 0), ("old", 4, None, 1)], tx=tx) == "old"


@pytest.mark.parametrize("boundary", [("old", 4, 5, 2), ("new", 4, None, 0)])
def test_an_open_window_cannot_cross_a_delete_or_new_uuid(boundary):
    rows = [("old", 1, 4, 0), boundary, ("new", 5, None, 1)]
    assert resolve(rows, tx=3) == "old"
    assert resolve(rows, tx=5) is None
    assert resolve(rows, start=5, tx=6) == "new"


def test_reattachment_of_same_chart_keeps_identity():
    assert resolve([("old", 1, None, 0)], start=8, tx=10) == "old"


def test_null_uuid_is_not_an_identity():
    assert resolve([(None, 1, None, 0)]) is None


def test_future_delete_is_not_a_late_content_anchor():
    assert (
        resolve(
            [("old", 3, None, 2)],
            live_uuid="old",
            live_created_on=BEFORE,
            attached_at=ATTACHED,
        )
        is None
    )


def test_late_content_uses_live_identity_on_the_committing_connection() -> None:
    metadata = sa.MetaData()
    versions = sa.Table(
        "slices_version",
        metadata,
        sa.Column("id", sa.Integer),
        sa.Column("uuid", sa.String),
        sa.Column("transaction_id", sa.Integer),
        sa.Column("end_transaction_id", sa.Integer),
        sa.Column("operation_type", sa.Integer),
    )
    live = sa.Table(
        "slices",
        metadata,
        sa.Column("id", sa.Integer),
        sa.Column("uuid", sa.String),
        sa.Column("created_on", sa.DateTime),
    )
    transactions = sa.Table(
        "version_transaction",
        metadata,
        sa.Column("id", sa.Integer),
        sa.Column("issued_at", sa.DateTime),
    )
    engine = sa.create_engine("sqlite://")
    metadata.create_all(engine)
    with Session(engine) as session:
        session.execute(
            transactions.insert(),
            [
                {"id": 2, "issued_at": datetime(2026, 1, 2)},
                {"id": 3, "issued_at": datetime(2026, 1, 3)},
            ],
        )
        session.execute(
            live.insert(),
            {
                "id": 101,
                "uuid": "old",
                "created_on": datetime(2026, 1, 1),
            },
        )
        session.execute(
            versions.insert(),
            {
                "id": 101,
                "uuid": "old",
                "transaction_id": 3,
                "end_transaction_id": None,
                "operation_type": 1,
            },
        )

        def read(tx):
            return attachment_uuids(
                session.connection(),
                [(101, 2)],
                tx,
                versions_table=versions,
                live_table=live,
                transactions_table=transactions,
                chunk_size=500,
            )

        assert read(2) == ["old"]
        assert read(3) == ["old"]
        # Simulate a fully pruned old chain followed by integer-id reuse.
        session.execute(versions.update().values(uuid="new"))
        session.execute(
            live.update().values(
                uuid="new",
                created_on=datetime(2026, 1, 3),
            )
        )
        assert read(2) == []
        assert read(3) == []
    engine.dispose()
