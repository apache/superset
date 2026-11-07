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
"""Deny by default: a write nobody declared is refused, not applied.

Every QA round found a path nobody had listed, because the gate was an
allowlist and the list of paths is unbounded. These tests are written against
the *model*, not against the paths already found: they walk every column the
governed models map, so a column added to ``Slice`` next year is judged by the
same rule today. If a new column needs to be writable without review it has to
be named in ``gate.UNGOVERNED_FIELDS``; if it is not, writing it directly is
refused, which is the safe way for the list to be wrong.
"""

from datetime import datetime
from typing import Any

import pytest
from asset_approval import gate
from asset_approval.exceptions import UnreviewableWriteRefusedError
from sqlalchemy import inspect

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    commit_or_raise,
    guarded_world,
)

#: Columns that identify a row rather than describe it. Not writes.
IDENTITY = {"id", "uuid"}


def _other_value(row: Any, column: Any) -> Any:
    """A value for ``column`` that differs from the one ``row`` holds."""
    was = getattr(row, column.key)
    kind = column.type.python_type
    if kind is bool:
        return not was
    if kind is int:
        return (was or 0) + 1
    if kind is datetime:
        return datetime(2030, 1, 1)
    if kind is str:
        return f"{was or ''}x"
    if kind is dict:
        return {**(was or {}), "touched": 1}
    raise pytest.skip.Exception(f"no stand-in value for {kind.__name__}")


def _columns(model: type) -> list[str]:
    return [
        attr.key
        for attr in inspect(model).column_attrs
        if attr.key not in IDENTITY
    ]


def _governed_models() -> list[tuple[str, type]]:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    return [("live", Dashboard), ("chart", Slice), ("dataset", SqlaTable)]


def _cases() -> list[Any]:
    cases = []
    for which, model in _governed_models():
        for key in _columns(model):
            cases.append(pytest.param(which, key, id=f"{model.__name__}.{key}"))
    return cases


@pytest.mark.parametrize(("which", "key"), _cases())
def test_every_mapped_column_is_either_declared_ungoverned_or_refused(
    guarded_world: Any, which: str, key: str
) -> None:
    """The property: no column is silently writable.

    Walks the mapper, so it covers columns nobody has thought about yet.
    """
    row = getattr(guarded_world, "dataset" if which == "dataset" else which)
    column = inspect(type(row)).columns[key]
    setattr(row, key, _other_value(row, column))

    refusal = commit_or_raise(guarded_world.session)

    if key in gate.UNGOVERNED_FIELDS:
        assert refusal is None, f"{key} is declared ungoverned but was refused"
    else:
        assert isinstance(refusal, UnreviewableWriteRefusedError), (
            f"{type(row).__name__}.{key} was written with no gate on the stack "
            "and nothing refused it"
        )


def test_a_refused_write_does_not_stay_in_the_session(guarded_world: Any) -> None:
    """A caller that catches the refusal must not be refused forever.

    The MCP chart preview (A1) mutated a live chart and was flushed by the
    event logger's own commit. If the refused change stayed pending, every
    later commit would raise again and the logger would take the tool down.
    """
    guarded_world.chart.viz_type = "pie"

    with pytest.raises(UnreviewableWriteRefusedError):
        guarded_world.session.commit()

    guarded_world.session.commit()  # nothing is pending now
    assert guarded_world.chart.viz_type == "table"


def test_the_refusal_says_what_was_written_and_what_to_do(guarded_world: Any) -> None:
    guarded_world.chart.viz_type = "pie"

    refusal = commit_or_raise(guarded_world.session)

    message = str(refusal)
    assert "viz_type" in message
    assert "chart 1" in message
    assert "reviewed" in message
    # The way out has to be one the person reading it can take. "reviewed"
    # alone is satisfied by a sentence telling them to have an administrator
    # turn review off -- which is the S-06 class of refusal: the flag is
    # global and needs a restart, so that is an instruction nobody in the
    # room can follow. `ImportOverwriteRefusedError` carries exactly these
    # negatives (`test_import_refusal`); they were never extended to this
    # one, which is the path every raw-write refusal takes.
    assert "turn review off" not in message
    assert "administrator" not in message
    # What is left names the surfaces that do work.
    assert "in the editor" in message
    assert "update call" in message


def test_a_bulk_update_is_refused_like_a_flushed_one(guarded_world: Any) -> None:
    """``Query.update`` never appears in a flush, so it has its own hook."""
    from superset.models.slice import Slice

    with pytest.raises(UnreviewableWriteRefusedError):
        guarded_world.session.query(Slice).filter(Slice.id == 1).update(
            {Slice.viz_type: "pie"}, synchronize_session=False
        )


def test_a_bulk_update_of_bookkeeping_is_not(guarded_world: Any) -> None:
    from superset.models.slice import Slice

    guarded_world.session.query(Slice).filter(Slice.id == 1).update(
        {Slice.perm: "[d].[t](id:1)"}, synchronize_session=False
    )


def test_a_bulk_delete_is_refused(guarded_world: Any) -> None:
    from superset.models.dashboard import Dashboard

    with pytest.raises(UnreviewableWriteRefusedError):
        guarded_world.session.query(Dashboard).filter(Dashboard.id == 1).delete(
            synchronize_session=False
        )


def test_a_hard_delete_of_a_governed_row_is_refused(guarded_world: Any) -> None:
    guarded_world.session.delete(guarded_world.chart)

    refusal = commit_or_raise(guarded_world.session)

    assert isinstance(refusal, UnreviewableWriteRefusedError)


def test_a_column_added_to_a_dataset_outside_the_editor_is_refused(
    guarded_world: Any,
) -> None:
    from superset.connectors.sqla.models import TableColumn

    guarded_world.dataset.columns.append(TableColumn(column_name="b"))

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_a_metric_edited_outside_the_editor_is_refused(guarded_world: Any) -> None:
    guarded_world.dataset.metrics[0].expression = "2"

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_a_chart_taken_off_a_live_dashboard_directly_is_refused(
    guarded_world: Any,
) -> None:
    guarded_world.live.slices.append(guarded_world.chart)
    guarded_world.state.allowed = True  # set the scene with the guard off
    guarded_world.session.commit()
    guarded_world.state.allowed = False

    guarded_world.live.slices.remove(guarded_world.chart)

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_an_annotation_on_a_layer_a_chart_displays_is_refused(
    guarded_world: Any,
) -> None:
    """A15: text a chart serves to its viewers is chart content."""
    from superset.models.annotations import Annotation, AnnotationLayer

    session = guarded_world.session
    layer, other = AnnotationLayer(name="shown"), AnnotationLayer(name="unused")
    session.add_all([layer, other])
    session.commit()
    guarded_world.chart.params = (
        '{"annotation_layers": [{"sourceType": "NATIVE", "value": %d}]}' % layer.id
    )
    guarded_world.state.allowed = True
    session.commit()
    guarded_world.state.allowed = False

    session.add(Annotation(layer_id=layer.id, short_descr="injected"))
    assert isinstance(commit_or_raise(session), UnreviewableWriteRefusedError)

    session.add(Annotation(layer_id=other.id, short_descr="fine"))
    assert commit_or_raise(session) is None


def test_a_theme_delete_cannot_null_the_theme_of_a_bound_dashboard(
    guarded_world: Any,
) -> None:
    """A8: ``DeleteThemeCommand`` runs exactly this statement."""
    from superset.models.dashboard import Dashboard

    with pytest.raises(UnreviewableWriteRefusedError) as refusal:
        guarded_world.session.query(Dashboard).filter(
            Dashboard.theme_id.in_([1])
        ).update({Dashboard.theme_id: None}, synchronize_session=False)

    assert "theme" in str(refusal.value).lower()

# ---- every table a bulk statement can reach a governed row through ---------
#
# A mutation sweep deleted entries from ``gate._GOVERNED_TABLES`` one at a
# time and the suite stayed green: the two tests above drive the bulk path
# for real, but only through ``slices`` and ``dashboards``. The strings
# ``_GOVERNED_TABLES`` and ``dashboard_slices`` appeared nowhere in the
# suite.
#
# The contrast with the sibling structure in this same file is the tell:
# ``test_every_mapped_column_is_either_declared_ungoverned_or_refused``
# parametrises over every mapped column of all three asset classes. The
# column list is pinned exhaustively; the table list it is read against was
# not pinned at all.
#
# What a missing entry costs: a bulk statement against that table is not
# inspected. Without ``dashboard_slices``, charts can be attached to or
# detached from a live published dashboard with no capture and no refusal --
# viewers watch panels appear and vanish from a dashboard whose change log
# is empty. Without ``sql_metrics``, a bulk delete strips a dataset's
# metrics that every chart on it depends on.


#: Named here, not read from ``gate._GOVERNED_TABLES``. Parametrising over
#: the dict would delete the test case along with the entry, which is the
#: tautology this whole exercise is about: both sides shrink together and
#: the suite stays green.
BULK_REACHABLE_TABLES = [
    "dashboards",
    "slices",
    "tables",
    "table_columns",
    "sql_metrics",
    "embedded_dashboards",
    "dashboard_slices",
]


def test_the_named_tables_are_the_ones_the_guard_reads() -> None:
    """Both directions, so neither list can drift from the other.

    An entry added to the guard without a case here is unexercised; a case
    here with no entry in the guard is a table nothing inspects.
    """
    assert sorted(BULK_REACHABLE_TABLES) == sorted(gate._GOVERNED_TABLES)


@pytest.mark.parametrize("table_name", BULK_REACHABLE_TABLES)
def test_a_bulk_update_of_any_governed_table_is_refused(
    guarded_world: Any, table_name: str
) -> None:
    from sqlalchemy import column, table as sa_table

    target = sa_table(table_name, column("a_governed_column"))

    with pytest.raises(UnreviewableWriteRefusedError):
        guarded_world.session.execute(
            target.update().values(a_governed_column="moved")
        )


@pytest.mark.parametrize("table_name", BULK_REACHABLE_TABLES)
def test_a_bulk_delete_of_any_governed_table_is_refused(
    guarded_world: Any, table_name: str
) -> None:
    from sqlalchemy import column, table as sa_table

    target = sa_table(table_name, column("a_governed_column"))

    with pytest.raises(UnreviewableWriteRefusedError):
        guarded_world.session.execute(target.delete())


def test_every_asset_type_is_reachable_through_at_least_one_table(
    guarded_world: Any,
) -> None:
    """A whole asset type dropping out of the bulk guard is the worst shape
    of this leak, and the cheapest to notice."""
    from asset_approval.types import AssetType

    assert set(gate._GOVERNED_TABLES.values()) == {
        AssetType.DASHBOARD,
        AssetType.CHART,
        AssetType.DATASET,
    }


def test_a_table_nobody_governs_is_left_alone(guarded_world: Any) -> None:
    """The guard must not refuse every bulk statement in the application."""
    from sqlalchemy import column, table as sa_table

    target = sa_table("ab_permission", column("name"))

    # No assertion needed beyond this not raising: a gate that refused it
    # would fail the test with its own refusal.
    guarded_world.session.execute(target.delete())
