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
"""A creation is not reviewed. Showing it to viewers is (A2, A3, A4, A5, A6, D1).

The gate could not represent a creation, and the instinct was to add an
operation for one. There is nothing for such a request to be: no asset to take
the open slot, no baseline to go stale, and no editors, which is where the set
of people who may approve comes from (SOW 5.4). What the SOW actually governs
is exposure -- "a dashboard is created as a draft, and making it visible is an
edit that requires approval" -- so a creation is free, and what is held is the
two ways it can reach viewers: a dashboard being born published, and a chart
being placed on a dashboard viewers can already reach.

These tests pin that rule on every way in, not on the REST route alone: the
command, a bare session (an MCP tool), an import, and the legacy Explore save.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import bindings, gate
from asset_approval.exceptions import UnreviewableWriteRefusedError
from asset_approval.types import AssetType

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    AUTHOR,
    commit_or_raise,
    guarded_world,
)

# ---- A2, A3: a dashboard born published ------------------------------------


def _published_dashboard(**fields: Any) -> Any:
    from superset.models.dashboard import Dashboard

    return Dashboard(dashboard_title="born live", published=True, **fields)


def test_a_dashboard_created_published_is_a_draft(guarded_world: Any) -> None:
    """A3's shape: raw ORM, no command, ``published`` and ``slices`` together."""
    dashboard = _published_dashboard(slices=[guarded_world.chart])
    guarded_world.session.add(dashboard)

    assert commit_or_raise(guarded_world.session) is None

    assert dashboard.published is False
    assert guarded_world.chart in dashboard.slices


def test_the_publish_it_asked_for_is_requested_once_it_has_committed(
    guarded_world: Any,
) -> None:
    dashboard = _published_dashboard()
    guarded_world.session.add(dashboard)
    guarded_world.session.commit()

    guarded_world.filed.assert_called_once_with(dashboard.id, AUTHOR)


def test_nothing_is_requested_if_the_creation_rolls_back(guarded_world: Any) -> None:
    guarded_world.session.add(_published_dashboard())
    guarded_world.session.flush()
    guarded_world.session.rollback()

    guarded_world.filed.assert_not_called()


def test_a_draft_created_as_a_draft_asks_for_nothing(guarded_world: Any) -> None:
    from superset.models.dashboard import Dashboard

    guarded_world.session.add(Dashboard(dashboard_title="plain draft"))
    guarded_world.session.commit()

    guarded_world.filed.assert_not_called()


def test_publishing_it_in_the_same_transaction_is_still_the_exposure(
    guarded_world: Any,
) -> None:
    """Created, flushed, then flipped: the flip is the act that is reviewed."""
    dashboard = _published_dashboard()
    guarded_world.session.add(dashboard)
    guarded_world.session.flush()
    dashboard.published = True

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_a_draft_built_over_several_flushes_is_not_judged_per_flush(
    guarded_world: Any,
) -> None:
    """An import creates a dashboard and fills it in across flushes.

    Nothing created in a transaction that has not committed has been seen by
    anyone, so the later flushes are still part of creating it.
    """
    from superset.models.dashboard import Dashboard

    dashboard = Dashboard(dashboard_title="imported", published=True)
    guarded_world.session.add(dashboard)
    guarded_world.session.flush()
    dashboard.slices = [guarded_world.chart]
    dashboard.position_json = "{}"
    guarded_world.session.flush()
    dashboard.json_metadata = "{}"

    assert commit_or_raise(guarded_world.session) is None
    assert dashboard.published is False


def test_the_creation_command_defers_the_publish_and_says_so() -> None:
    """A2: ``POST /api/v1/dashboard/`` with ``published: true``."""
    command = SimpleNamespace(_properties={"dashboard_title": "x", "published": True})

    bindings._gate_dashboard_create(command)

    assert command._properties["published"] is False
    assert command._first_publish_deferred is True


def test_a_creation_that_did_not_ask_to_be_published_is_left_alone() -> None:
    command = SimpleNamespace(_properties={"dashboard_title": "x"})

    bindings._gate_dashboard_create(command)

    assert command._properties == {"dashboard_title": "x"}
    assert not hasattr(command, "_first_publish_deferred")


def test_the_answer_to_the_create_is_the_request_it_made(
    guarded_world: Any, mocker: Any
) -> None:
    """Otherwise the REST create answers 201 and echoes ``published: true``."""
    capture = mocker.patch.object(bindings, "gate_write")
    mocker.patch.object(bindings, "get_user_id", return_value=AUTHOR)
    command = SimpleNamespace(_first_publish_deferred=True)

    bindings._announce_deferred_publish(command, SimpleNamespace(id=9))

    capture.assert_called_once()
    assert capture.call_args.args == (AssetType.DASHBOARD, 9, {"published": True})


def test_a_create_that_never_asked_is_not_answered_with_a_signal(
    mocker: Any,
) -> None:
    capture = mocker.patch.object(bindings, "gate_write")

    bindings._announce_deferred_publish(SimpleNamespace(), SimpleNamespace(id=9))

    capture.assert_not_called()


def test_the_creation_command_is_declared_and_not_permitted() -> None:
    """Declared, so verification sees it; not permitted, so the guard watches."""
    path = next(p for p in bindings.WRITE_PATHS if p.class_name == "CreateDashboardCommand")

    assert path.permits_writes is False
    assert path.after is bindings._announce_deferred_publish


# ---- A5: a chart placed on a dashboard viewers can reach --------------------


def test_a_chart_created_on_a_live_dashboard_is_refused(guarded_world: Any) -> None:
    from superset.models.slice import Slice

    guarded_world.session.add(
        Slice(
            slice_name="new",
            viz_type="table",
            datasource_id=1,
            datasource_type="table",
            dashboards=[guarded_world.live],
        )
    )

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_a_chart_created_on_a_live_dashboard_is_refused_while_a_request_is_open(
    guarded_world: Any,
) -> None:
    """The one-open-request rule used to be silent about this write."""
    guarded_world.state.in_review.add(guarded_world.live.id)
    command = SimpleNamespace(_properties={"dashboards": [guarded_world.live]})

    with pytest.raises(UnreviewableWriteRefusedError):
        bindings._gate_chart_create(command)


def test_the_create_gate_refuses_before_anything_is_written(
    guarded_world: Any,
) -> None:
    command = SimpleNamespace(_properties={"dashboards": [guarded_world.live]})

    with pytest.raises(UnreviewableWriteRefusedError) as refusal:
        bindings._gate_chart_create(command)

    assert "dashboard editor" in str(refusal.value)


def test_a_chart_created_on_its_own_or_on_a_draft_is_free(guarded_world: Any) -> None:
    from superset.models.slice import Slice

    fields = {"viz_type": "table", "datasource_id": 1, "datasource_type": "table"}
    guarded_world.session.add(Slice(slice_name="alone", **fields))
    guarded_world.session.add(
        Slice(slice_name="on a draft", dashboards=[guarded_world.draft], **fields)
    )

    assert commit_or_raise(guarded_world.session) is None
    bindings._gate_chart_create(
        SimpleNamespace(_properties={"dashboards": [guarded_world.draft]})
    )


def test_a_draft_that_is_in_review_is_not_open_to_new_charts(
    guarded_world: Any,
) -> None:
    guarded_world.state.in_review.add(guarded_world.draft.id)

    with pytest.raises(UnreviewableWriteRefusedError):
        bindings._gate_chart_create(
            SimpleNamespace(_properties={"dashboards": [guarded_world.draft]})
        )


def test_a_dashboard_once_published_and_since_unpublished_is_still_exposed(
    guarded_world: Any,
) -> None:
    guarded_world.state.ever_published.add(guarded_world.draft.id)

    with pytest.raises(UnreviewableWriteRefusedError):
        bindings._gate_chart_create(
            SimpleNamespace(_properties={"dashboards": [guarded_world.draft]})
        )


# ---- A6: an import ----------------------------------------------------------


def test_an_import_that_appends_a_chart_to_a_live_dashboard_is_refused(
    guarded_world: Any,
) -> None:
    """``overwrite=False`` still appends new charts to a dashboard that exists."""
    guarded_world.live.slices = list(guarded_world.live.slices) + [guarded_world.chart]

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_an_import_that_appends_a_chart_to_a_draft_is_not(guarded_world: Any) -> None:
    guarded_world.draft.slices = [guarded_world.chart]

    assert commit_or_raise(guarded_world.session) is None


def test_an_import_that_restores_an_archived_dashboard_is_refused(
    guarded_world: Any,
) -> None:
    """Re-importing a soft-deleted uuid clears ``deleted_at`` -- an un-archive."""
    from datetime import datetime

    guarded_world.state.allowed = True
    guarded_world.live.deleted_at = datetime(2026, 1, 1)
    guarded_world.session.commit()
    guarded_world.state.allowed = False

    guarded_world.live.deleted_at = None

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_both_importers_that_can_publish_prove_the_creation_half_holds() -> None:
    probed = [
        p.class_name
        for p in bindings.WRITE_PATHS
        if any("published dashboard" in name for name, _ in p.probes)
    ]

    assert sorted(probed) == ["ImportAssetsCommand", "ImportDashboardsCommand"]
    assert all(probe() for p in bindings.WRITE_PATHS for _n, probe in p.probes)


# ---- A4: the legacy Explore save --------------------------------------------


def test_saving_as_onto_a_live_dashboard_is_held_and_onto_a_draft_is_not(
    guarded_world: Any,
) -> None:
    chart = SimpleNamespace(id=1)

    assert bindings._legacy_save_is_held("saveas", chart, guarded_world.live)
    assert not bindings._legacy_save_is_held("saveas", chart, guarded_world.draft)
    assert not bindings._legacy_save_is_held("saveas", chart, None)


def test_saving_as_onto_a_dashboard_in_review_is_held(guarded_world: Any) -> None:
    guarded_world.state.in_review.add(guarded_world.draft.id)

    assert bindings._legacy_save_is_held(
        "saveas", SimpleNamespace(id=1), guarded_world.draft
    )


def test_the_gate_refuses_the_save_as_before_the_view_writes_anything(
    guarded_world: Any, mocker: Any
) -> None:
    args = {"action": "saveas", "save_to_dashboard_id": "1"}
    mocker.patch(
        "flask.request", SimpleNamespace(args=SimpleNamespace(get=args.get))
    )
    mocker.patch.object(bindings, "_dashboard_named", return_value=guarded_world.live)

    with pytest.raises(UnreviewableWriteRefusedError):
        bindings._gate_legacy_slice_save(SimpleNamespace(id=1))


def test_the_real_create_command_makes_a_draft_and_answers_with_the_request(
    guarded_world: Any, mocker: Any
) -> None:
    """A2 through the bound command, not through its gate functions.

    Only what needs a full app (validation, the DAO's subject handling) is
    stubbed; the wrapper \`\`install_bindings\`\` put on \`\`run\`\` is the real one.
    """
    from superset.commands.dashboard.create import CreateDashboardCommand
    from superset.models.dashboard import Dashboard

    def create(attributes: dict[str, Any]) -> Any:
        dashboard = Dashboard(
            dashboard_title=attributes["dashboard_title"],
            published=attributes.get("published", False),
        )
        guarded_world.session.add(dashboard)
        return dashboard

    mocker.patch("asset_approval.replay.load_asset", return_value=None)
    mocker.patch.object(bindings, "get_user_id", return_value=AUTHOR)
    mocker.patch.object(gate, "_insert_request", return_value=77)
    mocker.patch.object(CreateDashboardCommand, "validate", lambda self: None)
    mocker.patch("superset.daos.dashboard.DashboardDAO.create", side_effect=create)

    from asset_approval.exceptions import ChangeRequestCreated

    with pytest.raises(ChangeRequestCreated) as signal:
        CreateDashboardCommand({"dashboard_title": "api", "published": True}).run()

    created = (
        guarded_world.session.query(Dashboard).filter_by(dashboard_title="api").one()
    )
    assert created.published is False
    assert signal.value.asset_id == created.id
    assert signal.value.change_request_id == 77
