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
"""Deny by default must not break the writers that are not someone editing.

If approving a change request stopped working the whole feature would be dead,
so that is asserted first and against the real replay. The rest are the writers
the guard has to leave alone, each by a narrow, named way through rather than a
bypass: the approval's replay, the body of a gated command whose gate has let
the write by, and the few declared internal writers. The last tests are the
other direction -- the way through is scoped to its block, and a write beside it
is still refused.
"""

from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import bindings, gate, install, replay
from asset_approval.exceptions import UnreviewableWriteRefusedError

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    commit_or_raise,
    guarded_world,
)


@contextmanager
def _as(_user: Any) -> Any:
    yield


# ---- approving a change request ---------------------------------------------


def _approve_with(world: Any, mocker: Any, write: Any) -> None:
    """Run ``replay.apply_change`` the way ``lifecycle.approve`` does.

    The command is the author's, replayed as the author with the gate
    suspended; the approval then commits. Only the command is a stand-in.
    """

    class Replayed:
        def run(self) -> Any:
            write(world)
            return world.chart

    mocker.patch.object(replay, "build_command", return_value=Replayed())
    mocker.patch.object(replay, "override_user", _as)
    replay.apply_change(SimpleNamespace(author=SimpleNamespace(id=1)))
    world.session.commit()


def test_approving_a_change_writes_the_asset(guarded_world: Any, mocker: Any) -> None:
    _approve_with(
        guarded_world,
        mocker,
        lambda world: setattr(world.chart, "viz_type", "pie"),
    )

    assert guarded_world.chart.viz_type == "pie"


def test_approving_a_publish_writes_the_flag(guarded_world: Any, mocker: Any) -> None:
    _approve_with(
        guarded_world,
        mocker,
        lambda world: setattr(world.draft, "published", True),
    )

    assert guarded_world.draft.published is True


def test_approving_a_delete_and_a_dataset_edit_work_too(
    guarded_world: Any, mocker: Any
) -> None:
    def write(world: Any) -> None:
        world.dataset.metrics[0].expression = "2"
        world.dataset.table_name = "renamed"
        world.session.delete(world.chart)

    _approve_with(guarded_world, mocker, write)

    assert guarded_world.dataset.table_name == "renamed"


def test_the_same_write_without_the_replay_is_refused(guarded_world: Any) -> None:
    """The control: it is the replay that lets the first three through."""
    guarded_world.chart.viz_type = "pie"

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


# ---- a gated command whose gate has let the write by -------------------------


_COUNTER = [0]


def _command(world: Any, body: Any = None) -> str:
    """A new command class, findable by name, whose \`\`run\`\` writes a chart.

    A fresh one per test: binding replaces \`\`run\`\` on the class and is
    idempotent, so a reused class would keep the first test's gate.
    """
    _COUNTER[0] += 1
    name = f"_Command{_COUNTER[0]}"

    def run(self: Any) -> None:
        (body or _write_a_viz_type)(world)
        world.session.commit()

    globals()[name] = type(name, (), {"run": run})
    return name


def _write_a_viz_type(world: Any) -> None:
    world.chart.viz_type = "pie"


@pytest.fixture
def bound(guarded_world: Any, mocker: Any) -> Any:
    mocker.patch.object(install, "_gate_applies", return_value=True)
    mocker.patch.object(install, "_patched", [])
    return guarded_world


def test_a_gated_commands_body_runs_inside_a_permit(bound: Any) -> None:
    name = _command(bound)
    install.gate_run(__name__, name, lambda _c: None, validate_first=False)

    globals()[name]().run()

    assert bound.chart.viz_type == "pie"


def test_a_gate_that_captures_never_lets_the_body_run(bound: Any) -> None:
    def capture(_command: Any) -> None:
        raise RuntimeError("held for review")

    name = _command(bound)
    install.gate_run(__name__, name, capture, validate_first=False)

    with pytest.raises(RuntimeError):
        globals()[name]().run()

    assert bound.chart.viz_type == "table"


def test_a_path_that_is_not_permitted_is_still_watched(bound: Any) -> None:
    """A creation, or an importer that found no collision, is not approved."""
    name = _command(bound)
    install.gate_run(
        __name__, name, lambda _c: None, validate_first=False, permit=False
    )

    with pytest.raises(UnreviewableWriteRefusedError):
        globals()[name]().run()


def test_a_permit_ends_with_the_block(bound: Any) -> None:
    name = _command(bound)
    install.gate_run(__name__, name, lambda _c: None, validate_first=False)
    globals()[name]().run()
    assert gate.current_permits() == ()

    bound.chart.viz_type = "line"

    assert isinstance(commit_or_raise(bound.session), UnreviewableWriteRefusedError)


def test_a_permit_ends_even_when_the_body_fails(bound: Any) -> None:
    def fail(_world: Any) -> None:
        raise ValueError("boom")

    name = _command(bound, fail)
    install.gate_run(__name__, name, lambda _c: None, validate_first=False)

    with pytest.raises(ValueError):
        globals()[name]().run()

    assert gate.current_permits() == ()


# ---- declared internal writers ------------------------------------------------


class _Resync:
    world: Any = None

    def run(self) -> None:
        self.world.dataset.columns[0].type = "BIGINT"
        self.world.session.commit()


def test_a_declared_internal_writer_is_permitted(bound: Any, mocker: Any) -> None:
    _Resync.world = bound
    install.permit_run(__name__, "_Resync")

    _Resync().run()

    assert bound.dataset.columns[0].type == "BIGINT"


def test_the_writers_the_table_declares_are_the_ones_permitted() -> None:
    from superset.commands.dataset.refresh import RefreshDatasetCommand

    declared = {p.target for p in bindings.WRITE_PATHS if p.gate is None and p.permits_writes}

    assert declared == {
        "RefreshDatasetCommand.run",
        "ForcePurgeCommand.run",
        "_purge_one",
        # Seeding an instance. Undeclared, it reached the deny-by-default
        # guard and a clean install failed part way through loading the
        # examples whenever the extension was installed before they were.
        "load_examples_from_configs",
        # And the run that encloses it. The bundles commit as they import,
        # so their writes are checked inside their own permit; the Python
        # loaders that run first do not, and two of them publish a dashboard
        # on a bare ORM object. Those writes reached the guard at the
        # enclosing `@transaction()`'s commit, long after every permit had
        # been released, so a clean `make asset-demo` failed at the *end* of
        # seeding on an example dashboard's published state (R8-01).
        "load_examples_run",
    }
    assert getattr(RefreshDatasetCommand.run, "__asset_approval_permit__", False)


def test_seeding_an_instance_is_permitted() -> None:
    """A clean install must not depend on the order it was done in.

    The example bundles share the `examples` database and several
    datasets, so the first bundle creates a row the next one lands on and
    the import gate correctly reads that as an overwrite of a live asset.
    With the extension installed before the examples, loading them failed
    part way through; with it installed after, the same instance came up
    fine. The examples are not assets anyone is protecting.
    """
    from superset.examples import utils as example_utils

    assert getattr(
        example_utils.load_examples_from_configs,
        "__asset_approval_permit__",
        False,
    )

    # And only that loader. `ImportExamplesCommand` is shared with
    # `superset import-directory`, which carries arbitrary operator YAML;
    # permitting the command class would have let that replace live
    # governed assets unreviewed while `superset import-dashboards` next
    # to it stayed refused.
    from superset.commands.importers.v1.examples import ImportExamplesCommand

    assert not getattr(
        ImportExamplesCommand.run, "__asset_approval_permit__", False
    )
    assert not getattr(
        example_utils.load_configs_from_directory,
        "__asset_approval_permit__",
        False,
    )


def test_an_uploaded_bundle_is_still_refused() -> None:
    """What the permit does not extend to. Only the examples command is
    permitted; the REST importers stay gated, so a bundle someone uploads
    that would replace a live asset is refused as before."""
    declared = {
        p.target for p in bindings.WRITE_PATHS if p.gate is not None
    }

    assert "ImportDashboardsCommand.run" in declared
    assert "ImportChartsCommand.run" in declared


def test_the_permitted_writers_are_not_gates() -> None:
    """A permit is not a gate: verification still treats an exempt path as one."""
    from superset.commands.dataset.refresh import RefreshDatasetCommand

    assert not install._already_gated(RefreshDatasetCommand.run)


def test_the_rest_route_to_a_purge_is_refused_and_the_schedule_is_not(
    bound: Any,
) -> None:
    from superset.commands.deletion_retention.force_purge import ForcePurgeCommand
    from superset.commands.purge import PurgeArchivedCommand
    from superset.tasks import deletion_retention

    assert install._already_gated(PurgeArchivedCommand.run)
    assert getattr(ForcePurgeCommand.run, "__asset_approval_permit__", False)
    assert getattr(deletion_retention._purge_one, "__asset_approval_permit__", False)

    with pytest.raises(UnreviewableWriteRefusedError):
        bindings._refuse_rest_purge()


# ---- everything else that is not a content edit ------------------------------


def test_a_row_created_and_edited_in_one_transaction_is_not_an_edit(
    guarded_world: Any,
) -> None:
    from superset.models.slice import Slice

    chart = Slice(
        slice_name="new", viz_type="table", datasource_id=1, datasource_type="table"
    )
    guarded_world.session.add(chart)
    guarded_world.session.flush()
    chart.viz_type = "pie"
    chart.params = '{"a": 1}'
    guarded_world.session.flush()
    guarded_world.session.delete(chart)

    assert commit_or_raise(guarded_world.session) is None


def test_a_new_dataset_with_its_columns_is_a_creation(guarded_world: Any) -> None:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

    guarded_world.session.add(
        SqlaTable(
            table_name="another",
            database=guarded_world.dataset.database,
            columns=[TableColumn(column_name="x"), TableColumn(column_name="y")],
            metrics=[SqlMetric(metric_name="n", expression="count(*)")],
        )
    )

    assert commit_or_raise(guarded_world.session) is None


def test_who_saved_and_when_is_bookkeeping(guarded_world: Any) -> None:
    from datetime import datetime

    guarded_world.chart.last_saved_at = datetime(2030, 1, 1)
    guarded_world.chart.perm = "[d].[t](id:1)"
    guarded_world.live.changed_on = datetime(2030, 1, 1)

    assert commit_or_raise(guarded_world.session) is None


def test_the_fields_the_sow_exempts_are_not_governed(guarded_world: Any) -> None:
    guarded_world.chart.description = "now with a description"
    guarded_world.live.certified_by = "Finance"
    guarded_world.live.certification_details = "Reviewed"

    assert commit_or_raise(guarded_world.session) is None


def test_certifying_a_dataset_is_exempt_and_a_warning_banner_is_not(
    guarded_world: Any,
) -> None:
    guarded_world.state.allowed = True
    guarded_world.dataset.extra = '{"certification": {"certified_by": "a"}}'
    guarded_world.session.commit()
    guarded_world.state.allowed = False

    guarded_world.dataset.extra = '{"certification": {"certified_by": "b"}}'
    assert commit_or_raise(guarded_world.session) is None

    guarded_world.dataset.extra = (
        '{"certification": {"certified_by": "b"}, "warning_markdown": "DO NOT USE"}'
    )
    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_a_draft_dashboard_is_built_without_an_approval_per_save(
    guarded_world: Any,
) -> None:
    """The exemption the guard shares with the gate (SOW 5.1)."""
    guarded_world.draft.dashboard_title = "still building"
    guarded_world.draft.position_json = "{}"
    guarded_world.draft.css = "body {}"

    assert commit_or_raise(guarded_world.session) is None


def test_revoking_guest_tokens_is_not_refused(guarded_world: Any) -> None:
    """Narrowing who can reach an embedded dashboard is not an exposure."""
    from superset.models.embedded_dashboard import EmbeddedDashboard

    guarded_world.state.allowed = True
    embedded = EmbeddedDashboard(dashboard_id=guarded_world.live.id)
    guarded_world.session.add(embedded)
    guarded_world.session.commit()
    guarded_world.state.allowed = False

    embedded.guest_token_revoked_before = 1_900_000_000

    assert commit_or_raise(guarded_world.session) is None


def test_review_being_off_makes_the_guard_inert(guarded_world: Any) -> None:
    guarded_world.state.enabled = False
    guarded_world.chart.viz_type = "pie"

    assert commit_or_raise(guarded_world.session) is None


# ---- schema migrations, and the database's own cascade ------------------------


def test_a_data_migration_is_not_someone_editing_an_asset(guarded_world: Any) -> None:
    """\`\`superset db upgrade\`\` runs with the app's flags and rewrites charts.

    A viz type renamed in a migration would otherwise fail the upgrade half
    way on an instance with review on.
    """
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    assert gate._running_a_migration() is False
    context = MigrationContext.configure(guarded_world.session.connection())
    with Operations.context(context):
        assert gate._running_a_migration() is True
        guarded_world.chart.viz_type = "renamed_by_a_migration"
        assert commit_or_raise(guarded_world.session) is None
    assert gate._running_a_migration() is False

    guarded_world.chart.viz_type = "table"
    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_a_database_edit_moves_its_datasets_catalog_in_one_statement(
    guarded_world: Any,
) -> None:
    """\`\`UpdateDatabaseCommand._update_catalog_attribute\`\`: derived, not authored."""
    from superset.connectors.sqla.models import SqlaTable

    guarded_world.session.query(SqlaTable).filter_by(
        database_id=guarded_world.dataset.database_id
    ).update({"catalog": "new_default"}, synchronize_session=False)


def test_the_same_catalog_set_on_one_datasets_row_is_still_an_edit(
    guarded_world: Any,
) -> None:
    guarded_world.dataset.catalog = "somewhere_else"

    assert isinstance(
        commit_or_raise(guarded_world.session), UnreviewableWriteRefusedError
    )


def test_the_whole_example_run_is_permitted_and_settles_its_writes() -> None:
    """The two halves R8-01 needed.

    Permitted, so the ORM-only loaders are not refused; and settled, so the
    check happens while the permit is still held rather than at the
    enclosing transaction's commit. Without the second half the first one
    buys nothing: the writes are made inside the permit and *seen* outside
    it.
    """
    declared = {
        p.target: p
        for p in bindings.WRITE_PATHS
        if p.gate is None and p.permits_writes
    }

    path = declared["load_examples_run"]
    assert path.via == "function"
    assert path.settles, (
        "permitted but not settled: the example loaders flush nothing, so "
        "the guard would meet their writes at the outer commit"
    )


def test_only_the_example_run_settles() -> None:
    """A flush inside a permit changes when rows are sent, so it is not a
    thing to switch on by default. Every other permitted writer commits for
    itself."""
    settling = {
        p.target for p in bindings.WRITE_PATHS if getattr(p, "settles", False)
    }

    assert settling == {"load_examples_run"}


def test_the_narrower_bundle_permit_is_still_there() -> None:
    """Widening to the run must not have replaced it. The bundle importer is
    reached by `superset import-directory` too, which stays refused because
    the permit is on the loader function and not on
    `ImportExamplesCommand`."""
    declared = {
        p.target for p in bindings.WRITE_PATHS if p.gate is None and p.permits_writes
    }

    assert "load_examples_from_configs" in declared
