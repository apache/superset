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
"""What the gate captures must cover everything the apply will write.

The one invariant under both regressions this project has caused and most of
the defects filed against it. Capture was narrowed to stop over-capturing
and overshot into under-capturing; a keyword the gate had not heard of
reached the asset with nothing held; an exempt field was shown, approved and
dropped. Each time a test passed because it asked about the *capture* (does
the payload say X?) and nothing asked about the *apply* (does approving leave
the asset where the author's own save would have?).

So this asks the second question, with the first as its means. Every case
makes the same write twice on two identical assets:

* **directly**, with review off -- what the author's save does, which is the
  oracle, and never an expected dictionary somebody typed in;
* **through review** -- captured by the shipped gate, then replayed by the
  shipped approval from *nothing but* the stored payload and ``command_args``.

The two assets must end up the same. Anything the direct save wrote that the
capture did not carry, the replay cannot write, and the assets differ. That
is true however the gap came about, which is why one test body covers the
keyword the gate did not know about, the narrowed capture, the stripped
exempt field and the session that a commit refreshes.

A case also asserts the write was *held*. A write that sails through the gate
unreviewed would trivially "match" itself.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from asset_approval import gate
from asset_approval.exceptions import ChangeRequestCreated
from asset_approval.models import ChangeRequest
from asset_approval.replay import apply_change
from asset_approval.types import AssetType, Operation
from flask import g
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db

AUTHOR = 5

#: Columns that differ between two correct runs of the same write: identity,
#: time and who did it. Everything else is the asset.
NOISE = frozenset(
    {
        "id",
        "uuid",
        "table_id",
        "created_on",
        "changed_on",
        "created_by_fk",
        "changed_by_fk",
        "last_saved_at",
        "last_saved_by_fk",
        "perm",
        "schema_perm",
        "catalog_perm",
    }
)


def _row(instance: Any) -> dict[str, Any]:
    return {
        column.name: getattr(instance, column.key)
        for column in instance.__table__.columns
        if column.name not in NOISE
    }


def _dataset_state(dataset: Any) -> dict[str, Any]:
    """The dataset and everything hanging off it, minus identity and time."""
    db.session.expire_all()
    return {
        "dataset": _row(dataset),
        "columns": sorted(
            (_row(c) for c in dataset.columns), key=lambda r: r["column_name"]
        ),
        "metrics": sorted(
            (_row(m) for m in dataset.metrics), key=lambda r: r["metric_name"]
        ),
    }


@pytest.fixture
def review(mocker: MockerFixture) -> dict[str, Any]:
    """Review on or off at will, with the asset's one open request in memory.

    ``_insert_request`` and ``_update_own_request`` commit on their own
    connections, which a unit test has no engine for. These keep exactly what
    they would have been handed, so a second save by the same author folds
    onto the first through the shipped ``gate_write``, and what replay later
    reads back is what the gate stored.
    """
    state: dict[str, Any] = {"on": False, "request": None, "captures": 0}

    def store(
        request: ChangeRequest,
        payload: dict[str, Any],
        command_args: dict[str, Any] | None,
        operation: Operation,
        base: dict[str, Any] | None,
    ) -> None:
        request.payload = ChangeRequest.serialize_payload(payload, command_args, base)
        request.operation = operation.value

    def insert(
        asset_type: AssetType,
        asset_id: int,
        payload: dict[str, Any],
        author_id: int,
        note: str | None = None,
        command_args: dict[str, Any] | None = None,
        operation: Operation = Operation.UPDATE,
        base: dict[str, Any] | None = None,
        **_: Any,
    ) -> int:
        request = ChangeRequest(
            id=7,
            asset_type=asset_type.value,
            asset_id=asset_id,
            author_fk=author_id,
            status="draft",
        )
        store(request, payload, command_args, operation, base)
        state["request"] = request
        state["captures"] += 1
        return request.id

    def update(
        change_request_id: int,
        payload: dict[str, Any],
        note: str | None,
        command_args: dict[str, Any] | None = None,
        operation: Operation = Operation.UPDATE,
        clear_note: bool = False,
        base: dict[str, Any] | None = None,
    ) -> int:
        store(state["request"], payload, command_args, operation, base)
        state["captures"] += 1
        return change_request_id

    mocker.patch.object(gate, "is_enabled", side_effect=lambda: state["on"])
    mocker.patch.object(gate, "get_user_id", return_value=AUTHOR)
    mocker.patch.object(
        gate, "find_open_request", side_effect=lambda *_: state["request"]
    )
    mocker.patch.object(gate, "_insert_request", side_effect=insert)
    mocker.patch.object(gate, "_update_own_request", side_effect=update)
    return state


def _capture_then_apply(
    review: dict[str, Any], *saves: Callable[[], Any]
) -> ChangeRequest:
    """Make the saves under review, expect each held, and approve what was held.

    More than one save is what a layout save followed by a Properties save is:
    the second folds onto the first, and it is the fold that is approved.
    """
    review["on"] = True
    for save in saves:
        with pytest.raises(ChangeRequestCreated):
            save()
    review["on"] = False
    assert review["request"] is not None, "the write was not held"
    request = review["request"]
    # ``approve`` is itself a transaction, so every command the replay runs is
    # nested in it and commits nothing of its own; the approval commits once.
    # Replaying without that would make each command commit, as the direct
    # route does, and so hide the one difference between the two.
    g.in_transaction = True
    try:
        apply_change(request)
        db.session.commit()
    finally:
        g.in_transaction = False
    return request


# ---- datasets ------------------------------------------------------------


@pytest.fixture
def datasets(mocker: MockerFixture, session: Session) -> Callable[[], Any]:
    """A factory of identical datasets, with their commands made runnable.

    Only ``validate`` and the two things a unit test has no database for (the
    source's column list and its metrics) are replaced. ``run`` is the
    shipped command and the DAO under it is the shipped DAO.
    """
    from superset.commands.dataset.refresh import RefreshDatasetCommand
    from superset.commands.dataset.update import UpdateDatasetCommand
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="source", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    def validate(self: Any) -> None:
        self._model = db.session.get(SqlaTable, self._model_id)

    mocker.patch.object(UpdateDatasetCommand, "validate", validate)
    mocker.patch.object(RefreshDatasetCommand, "validate", validate)
    # The source lists one column, ``a``; anything else the dataset holds that
    # is not a calculated column is, to the refresh, something to drop.
    mocker.patch.object(  # noqa: PT008
        SqlaTable,
        "external_metadata",
        lambda self: [
            {"column_name": "a", "type": "INT"},
            # A second physical column, so the resync has one it merely
            # matches rather than adds. ``restricted`` below is where the
            # editor's own choices live.
            {"column_name": "restricted", "type": "INT"},
        ],
    )
    mocker.patch.object(  # noqa: PT008
        Database,
        "get_metrics",
        lambda self, table: [],
    )
    mocker.patch("superset.commands.dataset.refresh.DatetimeFormatDetector")
    mocker.patch(
        "asset_approval.replay.load_asset",
        side_effect=lambda kind, asset_id, **_: db.session.get(SqlaTable, asset_id),
    )

    def make() -> Any:
        dataset = SqlaTable(table_name="orders", database=database)
        db.session.add(dataset)
        db.session.flush()
        db.session.add(TableColumn(column_name="a", type="INT", table_id=dataset.id))
        # Grouping and filtering turned off deliberately. These are editor
        # choices, not facts about the source, and the source has no opinion
        # about them -- so nothing a resync learns can justify changing them.
        db.session.add(
            TableColumn(
                column_name="restricted",
                type="INT",
                table_id=dataset.id,
                groupby=False,
                filterable=False,
            )
        )
        db.session.add(
            TableColumn(
                column_name="b", type="INT", expression="a+1", table_id=dataset.id
            )
        )
        for name in ("revenue", "cost", "margin"):
            db.session.add(
                SqlMetric(
                    metric_name=name, expression=f"SUM({name})", table_id=dataset.id
                )
            )
        db.session.commit()
        return dataset

    return make


def _metric_id(dataset: Any, name: str) -> int:
    return next(m.id for m in dataset.metrics if m.metric_name == name)


DATASET_CASES = {
    # B2: the survivors of an additive write. ``preserve_existing_metrics`` is
    # a keyword, not a field, and a replay without it deletes every metric the
    # body does not mention.
    "an additive metric write keeps the other metrics": lambda ds: (
        {"metrics": [{"metric_name": "profit", "expression": "SUM(profit)"}]},
        {"preserve_existing_metrics": True},
    ),
    # A12: no body at all. There is no diff for anything to hold, and the
    # delete is entirely in the keyword.
    "a metric delete has an empty body and still counts": lambda ds: (
        {},
        {"delete_metric_ids": {_metric_id(ds, "cost")}},
    ),
    # The body and a keyword together.
    "a body that changes a field and deletes a metric does both": lambda ds: (
        {"cache_timeout": 90},
        {"delete_metric_ids": {_metric_id(ds, "margin")}},
    ),
    # B4 on a dataset: ``description`` is exempt and rides with a governed
    # field. Direct, both land.
    "an exempt field riding with a governed one is applied": lambda ds: (
        {"cache_timeout": 90, "description": "now with a description"},
        {},
    ),
    # B6: the update adds a column the source does not list, then the refresh
    # drops it. The direct route commits between them.
    "an override_columns save refreshes as the route does": lambda ds: (
        {
            "columns": [
                {"column_name": "a", "type": "INT"},
                {"column_name": "extra", "type": "INT"},
            ]
        },
        {"override_columns": True},
    ),
}


@pytest.mark.parametrize("case", DATASET_CASES)
def test_approving_a_dataset_save_writes_what_the_save_writes(
    case: str, review: dict[str, Any], datasets: Callable[[], Any]
) -> None:
    from superset.commands.dataset.refresh import RefreshDatasetCommand
    from superset.commands.dataset.update import UpdateDatasetCommand

    direct, reviewed = datasets(), datasets()
    body, direct_keywords = DATASET_CASES[case](direct)
    _, reviewed_keywords = DATASET_CASES[case](reviewed)

    # What the author's save does: the command, and the route's own second
    # step when it asked for ``override_columns``.
    UpdateDatasetCommand(direct.id, body, **direct_keywords).run()
    if direct_keywords.get("override_columns"):
        RefreshDatasetCommand(direct.id).run()

    _capture_then_apply(
        review,
        lambda: UpdateDatasetCommand(reviewed.id, body, **reviewed_keywords).run(),
    )

    assert _dataset_state(reviewed) == _dataset_state(direct)


def test_approving_writes_only_what_the_reviewer_was_shown(
    review: dict[str, Any], datasets: Callable[[], Any]
) -> None:
    """The other half of this file's property, and the half it was missing.

    Every test above asks "does approving leave the asset where the author's
    own save would have". That is a differential oracle, and a differential
    oracle is blind to anything wrong in both arms. It was: the route runs a
    refresh after an ``override_columns`` save, the refresh reset
    ``groupby``/``filterable`` to True on every column it matched, and both
    sides got the same wrong answer, so ``reviewed == direct`` held.

    What that cost: a reviewer approved a change described to them as "label
    one column", and the approval also re-enabled grouping and filtering on a
    different column -- a restriction that had itself been through review.
    Nothing in the diff named it and no change request recorded it.

    So this one is absolute. The property is not "approving matches a direct
    save" but "approving writes what was shown, and nothing else".
    """
    from superset.commands.dataset.update import UpdateDatasetCommand

    dataset = datasets()
    before = {
        column.column_name: (column.groupby, column.filterable)
        for column in dataset.columns
    }
    assert before["restricted"] == (False, False), "the fixture has to start restricted"

    # A save about one column's label, with the resync keyword the dataset
    # editor sets by ticking "Sync columns from source".
    #
    # The body carries EVERY column, because that is what the editor posts --
    # it sends the fields of the tab it was on, for all the rows it showed.
    # A body listing only the edited column is a different write:
    # `override_columns` replaces rather than merges, so the unlisted column
    # is deleted and the refresh re-adds it from the source as a new one,
    # which legitimately arrives open. Getting this wrong is how a test
    # passes against a payload the product never sends.
    request = _capture_then_apply(
        review,
        lambda: UpdateDatasetCommand(
            dataset.id,
            {
                "columns": [
                    {"column_name": "a", "type": "INT", "verbose_name": "A"},
                    {
                        "column_name": "restricted",
                        "type": "INT",
                        "groupby": False,
                        "filterable": False,
                    },
                    {"column_name": "b", "type": "INT", "expression": "a+1"},
                ]
            },
            override_columns=True,
        ).run(),
    )

    db.session.expire_all()
    restricted = next(
        column for column in dataset.columns if column.column_name == "restricted"
    )
    assert (restricted.groupby, restricted.filterable) == (False, False), (
        "approving re-enabled grouping and filtering on a column the change "
        "never mentioned and the reviewer never saw"
    )
    # And the thing that WAS approved still landed.
    labelled = next(
        column for column in dataset.columns if column.column_name == "a"
    )
    assert labelled.verbose_name == "A"
    assert request.asset_id == dataset.id


def test_a_resync_still_opens_up_a_column_it_has_just_added(
    review: dict[str, Any], datasets: Callable[[], Any], mocker: MockerFixture
) -> None:
    """The counterweight, so the fix above cannot be "never set them".

    A column nobody has configured yet has to arrive groupable and
    filterable, or a resync that picks up a new source column leaves it
    unusable until someone finds the checkboxes.
    """
    from superset.commands.dataset.update import UpdateDatasetCommand
    from superset.connectors.sqla.models import SqlaTable

    dataset = datasets()
    # The source grows a column. Re-patched rather than assigned, so the
    # fixture's own patch is what gets restored.
    mocker.patch.object(  # noqa: PT008
        SqlaTable,
        "external_metadata",
        lambda self: [
            {"column_name": "a", "type": "INT"},
            {"column_name": "restricted", "type": "INT"},
            {"column_name": "brand_new", "type": "INT"},
        ],
    )

    _capture_then_apply(
        review,
        lambda: UpdateDatasetCommand(
            dataset.id,
            {"columns": [{"column_name": "a", "type": "INT"}]},
            override_columns=True,
        ).run(),
    )

    db.session.expire_all()
    added = next(
        column for column in dataset.columns if column.column_name == "brand_new"
    )
    assert (added.groupby, added.filterable) == (True, True)


# ---- charts --------------------------------------------------------------


@pytest.fixture
def charts(mocker: MockerFixture, session: Session) -> Callable[[], Any]:
    from superset.commands.chart.update import UpdateChartCommand
    from superset.models.slice import Slice

    Slice.metadata.create_all(db.session.get_bind())
    # The chart command stamps who saved; a unit test has no logged-in user.
    g.user = None

    def validate(self: Any) -> None:
        self._model = db.session.get(Slice, self._model_id)

    mocker.patch.object(UpdateChartCommand, "validate", validate)
    mocker.patch(
        "asset_approval.replay.load_asset",
        side_effect=lambda kind, asset_id, **_: db.session.get(Slice, asset_id),
    )

    def make() -> Any:
        chart = Slice(
            slice_name="Sales",
            viz_type="table",
            datasource_id=1,
            datasource_type="table",
            params='{"metric": "count"}',
            description="the original",
        )
        db.session.add(chart)
        db.session.commit()
        return chart

    return make


def _chart_state(chart: Any) -> dict[str, Any]:
    db.session.expire_all()
    return _row(chart)


CHART_CASES = {
    "a plain rename": ({"slice_name": "Renamed"}, {}),
    # B4 on a chart.
    "an exempt field riding with a governed one is applied": (
        {"slice_name": "Renamed", "description": "a new description"},
        {},
    ),
    # Inert bookkeeping for version history, passed through untouched.
    "normalization bookkeeping changes nothing it should not": (
        {"slice_name": "Renamed"},
        {"normalization_changes": ["time_range"]},
    ),
}


@pytest.mark.parametrize("case", CHART_CASES)
def test_approving_a_chart_save_writes_what_the_save_writes(
    case: str, review: dict[str, Any], charts: Callable[[], Any]
) -> None:
    from superset.commands.chart.update import UpdateChartCommand

    direct, reviewed = charts(), charts()
    body, keywords = CHART_CASES[case]

    UpdateChartCommand(direct.id, body, **keywords).run()
    _capture_then_apply(
        review, lambda: UpdateChartCommand(reviewed.id, body, **keywords).run()
    )

    assert _chart_state(reviewed) == _chart_state(direct)


# ---- dashboards ----------------------------------------------------------


@pytest.fixture
def dashboards(mocker: MockerFixture, session: Session) -> Callable[[], Any]:
    from superset.commands.dashboard.update import UpdateDashboardCommand
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(db.session.get_bind())

    def validate(self: Any) -> None:
        self._model = db.session.get(Dashboard, self._model_id)

    mocker.patch.object(UpdateDashboardCommand, "validate", validate)
    mocker.patch(
        "asset_approval.replay.load_asset",
        side_effect=lambda kind, asset_id, **_: db.session.get(Dashboard, asset_id),
    )

    def make() -> Any:
        dashboard = Dashboard(
            dashboard_title="Executive",
            slug=None,
            # Published, so the gate holds its saves at all (SOW 5.1).
            published=True,
            position_json=json.dumps(LIVE_LAYOUT),
            json_metadata=json.dumps({"refresh_frequency": 0}),
            description="the original",
        )
        db.session.add(dashboard)
        db.session.commit()
        return dashboard

    return make


from superset.utils import json  # noqa: E402

LIVE_LAYOUT = {
    "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
    "GRID_ID": {
        "type": "GRID",
        "id": "GRID_ID",
        "children": [],
        "parents": ["ROOT_ID"],
    },
}

#: What the author's layout edit adds: a heading in the grid.
EDITED_LAYOUT = {
    **LIVE_LAYOUT,
    "GRID_ID": {
        "type": "GRID",
        "id": "GRID_ID",
        "children": ["HEADER-1"],
        "parents": ["ROOT_ID"],
    },
    "HEADER-1": {
        "type": "HEADER",
        "id": "HEADER-1",
        "meta": {"text": "Quarter close"},
        "parents": ["ROOT_ID", "GRID_ID"],
    },
}


def _layout_save(dashboard_id: int) -> tuple[int, dict[str, Any]]:
    """Header's Save: the layout rides inside ``json_metadata``."""
    return dashboard_id, {
        "dashboard_title": "Executive",
        "description": "the original",
        "json_metadata": json.dumps(
            {"refresh_frequency": 0, "positions": EDITED_LAYOUT}
        ),
    }


def _properties_save(dashboard_id: int) -> tuple[int, dict[str, Any]]:
    """The Properties dialog's Save: a handful of fields, and no layout."""
    return dashboard_id, {
        "dashboard_title": "Executive (Q4)",
        "description": "the original",
        "json_metadata": json.dumps({"refresh_frequency": 0}),
        "css": "",
    }


def _dashboard_state(dashboard: Any) -> dict[str, Any]:
    db.session.expire_all()
    state = _row(dashboard)
    state["position_json"] = json.loads(state["position_json"] or "null")
    state["json_metadata"] = json.loads(state["json_metadata"] or "null")
    return state


def test_approving_a_layout_save_then_a_properties_save_writes_what_the_two_saves_write(
    review: dict[str, Any], dashboards: Callable[[], Any]
) -> None:
    """B3, on the shipped surfaces.

    Both saves are the dashboard's own, and the second one, by posting a
    ``json_metadata`` with no layout in it, used to replace the first one's
    whole draft. The fold has to come out where the two saves in order do.
    """
    from superset.commands.dashboard.update import UpdateDashboardCommand

    direct, reviewed = dashboards(), dashboards()
    for save in (_layout_save, _properties_save):
        UpdateDashboardCommand(*save(direct.id)).run()

    _capture_then_apply(
        review,
        lambda: UpdateDashboardCommand(*_layout_save(reviewed.id)).run(),
        lambda: UpdateDashboardCommand(*_properties_save(reviewed.id)).run(),
    )

    assert _dashboard_state(reviewed) == _dashboard_state(direct)
    # And the thing the sentence in the bug report is about, said directly.
    assert "HEADER-1" in _dashboard_state(reviewed)["position_json"]


# ---- the exempt field that is only a snapshot (129071) --------------------


def test_an_exempt_field_that_only_echoed_the_form_is_not_written_back(
    review: dict[str, Any], charts: Callable[[], Any]
) -> None:
    """The property the narrowing of B4 must not give up (129071).

    The author renames the chart; the dialog posts ``description`` too, as it
    always does, still equal to what is live. Review waits. Meanwhile someone
    else rewrites the description, which is an exempt edit and so applies at
    once. Approving the rename must not put the old description back: that
    copy in the request is a snapshot of a field nobody on this request
    changed.
    """
    from superset.commands.chart.update import UpdateChartCommand

    chart = charts()
    echoed = chart.description

    review["on"] = True
    with pytest.raises(ChangeRequestCreated):
        UpdateChartCommand(
            chart.id, {"slice_name": "Renamed", "description": echoed}
        ).run()
    review["on"] = False
    request = review["request"]

    # The exempt edit someone else made while the review waited.
    chart.description = "rewritten during the review"
    db.session.commit()

    g.in_transaction = True
    try:
        apply_change(request)
        db.session.commit()
    finally:
        g.in_transaction = False

    db.session.expire_all()
    assert chart.slice_name == "Renamed"
    assert chart.description == "rewritten during the review"
    assert gate.captured_exempt_fields(request.command_args) is None


def test_a_request_from_before_ownership_was_recorded_still_drops_exempt_fields(
    charts: Callable[[], Any],
) -> None:
    """Requests already in the queue replay exactly as they always did."""
    from asset_approval.replay import build_command

    chart = charts()
    request = ChangeRequest(
        id=1,
        asset_type="chart",
        asset_id=chart.id,
        operation="update",
        payload=ChangeRequest.serialize_payload(
            {"slice_name": "Renamed", "description": "from before"}, {}
        ),
    )

    assert build_command(request)._properties == {"slice_name": "Renamed"}


def test_an_exempt_field_the_write_changed_is_owned_by_the_request(
    review: dict[str, Any], charts: Callable[[], Any]
) -> None:
    from superset.commands.chart.update import UpdateChartCommand

    chart = charts()

    review["on"] = True
    with pytest.raises(ChangeRequestCreated):
        UpdateChartCommand(
            chart.id, {"slice_name": "Renamed", "description": "a new description"}
        ).run()

    request = review["request"]
    assert gate.captured_exempt_fields(request.command_args) == ["description"]
    # Owned, so it is applied -- and so it is measured: a stale list written
    # over one that moved since would be 129071 all over again, so approval is
    # refused with the field named rather than overwriting it.
    assert "description" in request.base_dict


def test_an_owned_exempt_field_that_moved_during_the_review_refuses_the_approval(
    review: dict[str, Any], charts: Callable[[], Any]
) -> None:
    from asset_approval.changes import moved_since

    from superset.commands.chart.update import UpdateChartCommand

    chart = charts()
    review["on"] = True
    with pytest.raises(ChangeRequestCreated):
        UpdateChartCommand(
            chart.id, {"slice_name": "Renamed", "description": "mine"}
        ).run()
    request = review["request"]

    chart.description = "someone else's, meanwhile"
    db.session.commit()

    assert moved_since(chart, request.base_dict) == ["description"]


# ---- the legacy chart save names a dashboard (B7) -------------------------


def _approve(request: ChangeRequest) -> None:
    g.in_transaction = True
    try:
        apply_change(request)
        db.session.commit()
    finally:
        g.in_transaction = False


def test_approving_a_legacy_save_attaches_the_chart_to_the_dashboard_it_named(
    charts: Callable[[], Any], dashboards: Callable[[], Any], mocker: MockerFixture
) -> None:
    """The reviewer approved a rename and was told "published"; no row was written."""
    mocker.patch("superset.security_manager.is_editor", return_value=True)
    chart, dashboard = charts(), dashboards()
    assert chart not in dashboard.slices

    _approve(
        ChangeRequest(
            id=1,
            asset_type="chart",
            asset_id=chart.id,
            operation="update",
            payload=ChangeRequest.serialize_payload(
                {"slice_name": "Renamed"},
                {gate.KWARGS_KEY: {"save_to_dashboard_id": dashboard.id}},
            ),
        )
    )

    db.session.expire_all()
    assert chart.slice_name == "Renamed"
    assert chart in dashboard.slices


def test_a_legacy_save_approved_after_the_author_lost_the_dashboard_changes_nothing(
    charts: Callable[[], Any], dashboards: Callable[[], Any], mocker: MockerFixture
) -> None:
    from asset_approval.exceptions import ReplayFailedError

    mocker.patch("superset.security_manager.is_editor", return_value=False)
    chart, dashboard = charts(), dashboards()

    with pytest.raises(ReplayFailedError):
        _approve(
            ChangeRequest(
                id=1,
                asset_type="chart",
                asset_id=chart.id,
                operation="update",
                payload=ChangeRequest.serialize_payload(
                    {"slice_name": "Renamed"},
                    {gate.KWARGS_KEY: {"save_to_dashboard_id": dashboard.id}},
                ),
            )
        )
    db.session.rollback()

    db.session.expire_all()
    assert chart.slice_name == "Sales"
    assert chart not in dashboard.slices
