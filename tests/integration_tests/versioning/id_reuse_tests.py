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
"""Version reads and restore must not resolve a *predecessor's* shadow rows.

A hard delete frees the entity's integer id and the database may hand it to
the next row inserted — guaranteed on SQLite ROWID tables, and reachable
elsewhere whenever a sequence is reset. Matching shadow rows on the id alone
therefore lets a successor entity inherit the deleted predecessor's version
history, and lets a restore write the predecessor's content over it.

These tests recreate an entity under a recycled id and assert the successor
has no history and cannot be restored to its predecessor's version. The same
defect was found and fixed twice on the soft-delete side (``_purge_one``'s
identity guard, and ``_identity_predicates`` on the purge cascade's locked
claim); this pins the equivalent guarantee for the versioning read/restore
paths.
"""

from __future__ import annotations

import uuid as uuid_module
from collections.abc import Iterator
from contextlib import contextmanager
from typing import TypeAlias

import pytest
import sqlalchemy as sa
from sqlalchemy_continuum import version_class, versioning_manager

from superset import db
from superset.daos.version import VersionDAO
from superset.models.slice import Slice
from superset.versioning.queries import get_version, list_versions
from superset.versioning.restore import restore_version
from tests.integration_tests.test_app import app

RecycledIdCharts: TypeAlias = tuple[int, uuid_module.UUID, Slice]


def _make_chart(name: str, chart_uuid: uuid_module.UUID) -> Slice:
    chart = Slice(
        slice_name=name,
        datasource_type="table",
        datasource_id=1,
        viz_type="table",
        uuid=chart_uuid,
    )
    db.session.add(chart)
    db.session.commit()
    return chart


@contextmanager
def _capture_disabled() -> Iterator[None]:
    """Temporarily disable Continuum writes without reordering listeners."""
    previous = versioning_manager.options["versioning"]
    versioning_manager.options["versioning"] = False
    try:
        yield
    finally:
        versioning_manager.options["versioning"] = previous


@pytest.fixture
def recycled_id_charts() -> Iterator[RecycledIdCharts]:
    """Create two charts whose durable identities share a recycled integer id.

    Yields ``(entity_id, predecessor_uuid, successor)`` or skips when the
    backend did not actually recycle the id — the assertions are only
    meaningful when it did, and forcing reuse portably is not possible.
    """
    with app.app_context():
        predecessor_uuid = uuid_module.uuid4()
        predecessor = _make_chart("id_reuse_predecessor", predecessor_uuid)
        entity_id = predecessor.id

        # Give the predecessor a second version so history is non-trivial.
        predecessor.slice_name = "id_reuse_predecessor_v2"
        db.session.commit()

        # Hard delete — frees the id. The shadow rows deliberately survive:
        # that persistence is the whole point of the version tables, and it
        # is what makes the successor's inheritance possible.
        db.session.delete(predecessor)
        db.session.commit()

        successor_uuid = uuid_module.uuid4()
        successor = _make_chart("id_reuse_successor", successor_uuid)
        if successor.id != entity_id:
            db.session.delete(successor)
            db.session.commit()
            pytest.skip(
                f"backend did not recycle the id ({entity_id} -> "
                f"{successor.id}); reuse is deterministic on SQLite ROWID "
                "tables only"
            )

        try:
            yield entity_id, predecessor_uuid, successor
        finally:
            db.session.rollback()
            db.session.delete(successor)
            db.session.commit()


def test_successor_under_recycled_id_has_no_inherited_history(
    recycled_id_charts: RecycledIdCharts,
) -> None:
    """The successor's version count must reflect its own writes only.

    Before the ``(id, uuid)`` fix, ``current_version_number`` counted every
    shadow row carrying the integer id — including the predecessor's — so a
    freshly created chart reported the deleted chart's history as its own.
    """
    entity_id, _predecessor_uuid, successor = recycled_id_charts
    assert successor.uuid is not None
    ver_cls = version_class(Slice)

    version = VersionDAO.current_version_number(Slice, entity_id, successor.uuid)
    id_only_count = db.session.query(ver_cls).filter(ver_cls.id == entity_id).count()
    id_only_version = id_only_count - 1 if id_only_count else None

    # The successor has exactly one version of its own (its INSERT).
    assert version == 0, (
        f"successor should report only its own single version; got {version}"
    )
    # Control: the id-only lookup still sees the predecessor's rows, which is
    # precisely the inheritance the uuid pin removes. If this ever equals the
    # uuid-pinned result the fixture stopped exercising id reuse.
    assert id_only_version is not None
    assert id_only_version > version, (
        "expected the id-only lookup to over-count via the predecessor's "
        f"rows (id_only={id_only_version}, pinned={version}); the fixture "
        "may no longer be recycling the id"
    )


def test_live_transaction_id_is_not_the_predecessors(
    recycled_id_charts: RecycledIdCharts,
) -> None:
    """The live transaction resolved for the successor must be its own.

    ``current_live_version_uuid`` derives the client-visible version uuid from
    this transaction id, so a predecessor's id here produces an ETag naming a
    version the caller can never legitimately hold.
    """
    entity_id, predecessor_uuid, successor = recycled_id_charts
    assert successor.uuid is not None
    ver_cls = version_class(Slice)

    successor_tx = VersionDAO.current_live_transaction_id(
        Slice, entity_id, successor.uuid
    )
    # Asking about the hard-deleted predecessor must not answer with the
    # successor's transaction. Without the uuid pin the query cannot tell the
    # two apart and returns the newest live row under the id — the
    # successor's — as though the predecessor were still current.
    predecessor_tx = VersionDAO.current_live_transaction_id(
        Slice, entity_id, predecessor_uuid
    )

    assert successor_tx is not None, "successor should have a live transaction"
    assert predecessor_tx is None, (
        "a hard-deleted predecessor has no live version row; got "
        f"{predecessor_tx} (successor's is {successor_tx})"
    )
    # Control: an explicit id-only query cannot make that distinction.
    id_only_tx = (
        db.session.query(ver_cls.transaction_id)
        .filter(ver_cls.id == entity_id, ver_cls.end_transaction_id.is_(None))
        .order_by(ver_cls.transaction_id.desc())
        .limit(1)
        .scalar()
    )
    assert id_only_tx == successor_tx


def test_restore_refuses_a_predecessors_transaction(
    recycled_id_charts: RecycledIdCharts,
) -> None:
    """Refuse to restore a successor from its predecessor's transaction.

    This is the destructive half of the defect: the read side merely misreports
    history, but restore *writes*.
    """
    entity_id, predecessor_uuid, successor = recycled_id_charts
    assert successor.uuid is not None

    # The predecessor has no *live* row (it was hard-deleted), so take any of
    # its surviving shadow transactions directly — that is exactly what an
    # attacker-or-accident supplies to the restore endpoint.
    ver_cls = version_class(Slice)
    predecessor_tx = (
        db.session.query(ver_cls.transaction_id)
        .filter(ver_cls.id == entity_id, ver_cls.uuid == predecessor_uuid)
        .order_by(ver_cls.transaction_id.asc())
        .limit(1)
        .scalar()
    )
    assert predecessor_tx is not None, "fixture should leave predecessor history"

    original_name = successor.slice_name
    result = restore_version(Slice, successor.uuid, predecessor_tx, entity=successor)

    assert result is None, (
        "restore resolved a version row belonging to a hard-deleted "
        "predecessor under the same id"
    )
    db.session.refresh(successor)
    assert successor.slice_name == original_name, (
        "successor's content was overwritten from the predecessor's version"
    )


def test_shadow_rows_for_both_entities_share_the_id(
    recycled_id_charts: RecycledIdCharts,
) -> None:
    """Prove both entities' shadow rows coexist under the recycled id.

    This guards against the behavioral tests passing without exercising the
    collision they are intended to cover.
    """
    entity_id, predecessor_uuid, successor = recycled_id_charts

    ver_cls = version_class(Slice)
    uuids = {
        row[0]
        for row in db.session.query(ver_cls.uuid)
        .filter(ver_cls.id == entity_id)
        .distinct()
        .all()
    }

    assert predecessor_uuid in uuids, (
        f"predecessor's shadow rows missing under the recycled id; found {uuids}"
    )
    assert successor.uuid in uuids, (
        f"successor's shadow rows missing under the recycled id; found {uuids}"
    )
    assert sa.inspect(db.session.get_bind()).has_table("slices_version")


def test_list_versions_excludes_the_predecessors_rows(
    recycled_id_charts: RecycledIdCharts,
) -> None:
    """The history listing must contain the successor's versions only.

    ``list_versions`` selects the shadow rows with its own Core query rather
    than going through the counting helper, so pinning the count alone left
    this path — the one behind the version-history panel — still listing a
    stranger's versions.
    """
    _entity_id, _predecessor_uuid, successor = recycled_id_charts
    assert successor.uuid is not None

    versions = list_versions(Slice, successor.uuid, entity=successor)

    assert versions is not None, "successor is active, so its history resolves"
    assert len(versions) == 1, (
        "successor should list only its own INSERT; got "
        f"{len(versions)} entries: {[v['transaction_id'] for v in versions]}"
    )


def test_get_version_returns_the_successors_own_snapshot(
    recycled_id_charts: RecycledIdCharts,
) -> None:
    """A version snapshot must carry the content of the entity asked about.

    ``version_number`` is resolved from a pinned count but applied to the
    snapshot query as an OFFSET. While that query matched on the id alone the
    offset was counted over one row set and applied to a wider one, so the row
    it addressed could be a predecessor's — returning that entity's content
    labelled with the successor's version uuid.
    """
    _entity_id, _predecessor_uuid, successor = recycled_id_charts
    assert successor.uuid is not None

    versions = list_versions(Slice, successor.uuid, entity=successor)
    assert versions, "fixture should leave the successor one version"

    snapshot = get_version(
        Slice, successor.uuid, versions[0]["version_uuid"], entity=successor
    )

    assert snapshot is not None, "the successor's own version must resolve"
    assert snapshot["slice_name"] == "id_reuse_successor", (
        f"snapshot returned another entity's content: got {snapshot['slice_name']!r}"
    )
    assert snapshot["uuid"] == str(successor.uuid), (
        f"snapshot belongs to a different entity: {snapshot['uuid']}"
    )


def _assert_reused_id_gets_its_own_baseline_when_capture_resumes() -> None:
    """A predecessor's shadow rows must not suppress a successor baseline."""
    predecessor_uuid = uuid_module.uuid4()
    predecessor = _make_chart("baseline_predecessor", predecessor_uuid)
    entity_id = predecessor.id
    predecessor.slice_name = "baseline_predecessor_v2"
    db.session.commit()
    db.session.delete(predecessor)
    db.session.commit()

    successor_uuid = uuid_module.uuid4()
    with _capture_disabled():
        successor = _make_chart("baseline_successor", successor_uuid)

    if successor.id != entity_id:
        db.session.delete(successor)
        db.session.commit()
        pytest.skip(f"backend did not recycle the id ({entity_id} -> {successor.id})")

    try:
        successor.slice_name = "baseline_successor_v2"
        db.session.commit()

        ver_cls = version_class(Slice)
        rows = (
            db.session.query(ver_cls)
            .filter(ver_cls.id == entity_id, ver_cls.uuid == successor_uuid)
            .order_by(ver_cls.transaction_id.asc())
            .all()
        )
        assert [row.operation_type for row in rows] == [0, 1]
        assert [row.slice_name for row in rows] == [
            "baseline_successor",
            "baseline_successor_v2",
        ]
    finally:
        db.session.rollback()
        db.session.delete(successor)
        db.session.commit()


def test_reused_id_gets_its_own_baseline_when_capture_resumes() -> None:
    """Exercise the capture transition inside the integration app context."""
    with app.app_context():
        _assert_reused_id_gets_its_own_baseline_when_capture_resumes()
