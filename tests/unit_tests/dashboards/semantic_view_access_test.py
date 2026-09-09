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

"""SC-111233 regression tests: semantic-view charts in dashboard authorization.

The dashboard object gate and the dashboard list filter both resolved chart
datasources through table-pinned relationships, with two opposite failures for
dashboards of semantic-view charts:

- fail open: the object gate's dataset fallback treated an empty
  ``Dashboard.datasources`` set as "nothing to check" and allowed any
  authenticated user, exposing the dashboard shell (title, layout, chart
  names, native-filter defaults) to scoped users without any DAR grant;
- fail closed: the list filter's inner join to ``SqlaTable`` dropped
  semantic-view charts entirely, hiding the dashboard from users who DO hold
  a semantic-view ``datasource_access`` grant (and, being type-less, the join
  could bind a semantic-view chart to an unrelated table sharing its id).
"""

from __future__ import annotations

import uuid as uuid_lib
from contextlib import contextmanager, ExitStack
from types import SimpleNamespace
from typing import Iterator
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm.session import Session

VIEW_PERM = "[test_layer].[test_view](id:1)"
VIEW2_PERM = "[test_layer].[test_view_2](id:2)"
TABLE_PERM = "[examples].[birth_names](id:1)"


@pytest.fixture
def access_fixtures(session: Session) -> SimpleNamespace:
    """In-memory rows: a semantic-view-only, a regular, and an empty dashboard.

    The semantic view and the table deliberately share the numeric id ``1`` so
    the type-less-join collision case is representable.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery
    from superset.semantic_layers.models import SemanticLayer, SemanticView

    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    layer = SemanticLayer(
        uuid=uuid_lib.uuid4(),
        name="test_layer",
        type="test",
        configuration="{}",
    )
    session.add(layer)
    session.flush()
    # An insert listener stamps the computed perm on flush (overwriting any
    # fixture-supplied value); tests granting the layer perm must use it.
    layer_perm = layer.perm
    assert layer_perm

    view = SemanticView(
        id=1,
        uuid=uuid_lib.uuid4(),
        name="test_view",
        semantic_layer_uuid=layer.uuid,
        configuration="{}",
        perm=VIEW_PERM,
    )
    # A second view with a NON-colliding numeric id (no table shares id 2):
    # the entitled-visibility test uses it so it discriminates the type-aware
    # join from the old unconstrained join, which happened to match view 1
    # only via its id collision with the table below.
    view2 = SemanticView(
        id=2,
        uuid=uuid_lib.uuid4(),
        name="test_view_2",
        semantic_layer_uuid=layer.uuid,
        configuration="{}",
        perm=VIEW2_PERM,
    )
    database = Database(id=10, database_name="examples", sqlalchemy_uri="sqlite://")
    session.add_all([view, view2, database])
    session.flush()

    table = SqlaTable(
        id=1,  # same numeric id as the semantic view, on purpose
        table_name="birth_names",
        database_id=database.id,
        perm=TABLE_PERM,
    )
    session.add(table)
    session.flush()

    saved_query = SavedQuery(id=77, sql="select 1", label="a saved query")
    query = Query(
        id=78,
        client_id="abc1234567",
        database_id=database.id,
        sql="select 1",
    )
    session.add_all([saved_query, query])
    session.flush()

    semantic_slice = Slice(
        slice_name="semantic chart",
        datasource_id=view.id,
        datasource_type="semantic_view",
        datasource_name="test_view",
        viz_type="table",
    )
    table_slice = Slice(
        slice_name="table chart",
        datasource_id=table.id,
        datasource_type="table",
        datasource_name="birth_names",
        viz_type="table",
    )
    dangling_slice = Slice(
        slice_name="dangling chart",
        datasource_id=12345,
        datasource_type="semantic_view",
        datasource_name="gone",
        viz_type="table",
    )
    semantic_slice_2 = Slice(
        slice_name="semantic chart 2",
        datasource_id=view2.id,
        datasource_type="semantic_view",
        datasource_name="test_view_2",
        viz_type="table",
    )
    session.add_all([semantic_slice, semantic_slice_2, table_slice, dangling_slice])
    session.flush()

    semantic_dashboard = Dashboard(
        dashboard_title="semantic only",
        slug="semantic-only",
        published=True,
        slices=[semantic_slice],
    )
    regular_dashboard = Dashboard(
        dashboard_title="regular",
        slug="regular",
        published=True,
        slices=[table_slice],
    )
    dangling_dashboard = Dashboard(
        dashboard_title="dangling",
        slug="dangling",
        published=True,
        slices=[dangling_slice],
    )
    semantic_nocollide_dashboard = Dashboard(
        dashboard_title="semantic nocollide",
        slug="semantic-nocollide",
        published=True,
        slices=[semantic_slice_2],
    )
    empty_dashboard = Dashboard(
        dashboard_title="empty",
        slug="empty",
        published=True,
        slices=[],
    )
    session.add_all(
        [
            semantic_dashboard,
            regular_dashboard,
            dangling_dashboard,
            semantic_nocollide_dashboard,
            empty_dashboard,
        ]
    )
    session.flush()

    return SimpleNamespace(
        session=session,
        layer_perm=layer_perm,
        view=view,
        table=table,
        semantic_slice=semantic_slice,
        table_slice=table_slice,
        dangling_slice=dangling_slice,
        semantic_dashboard=semantic_dashboard,
        semantic_nocollide_dashboard=semantic_nocollide_dashboard,
        regular_dashboard=regular_dashboard,
        dangling_dashboard=dangling_dashboard,
        empty_dashboard=empty_dashboard,
    )


# ---------------------------------------------------------------------------
# Slice.resolved_datasource
# ---------------------------------------------------------------------------


def test_resolved_datasource_semantic_view(access_fixtures: SimpleNamespace) -> None:
    """A semantic-view chart resolves to its SemanticView row."""
    # pylint: disable=import-outside-toplevel
    from superset.semantic_layers.models import SemanticView

    resolved = access_fixtures.semantic_slice.resolved_datasource
    assert isinstance(resolved, SemanticView)
    assert resolved.id == access_fixtures.view.id
    assert resolved.name == "test_view"


def test_resolved_datasource_table(access_fixtures: SimpleNamespace) -> None:
    """A table-backed chart resolves through the existing relationship."""
    assert access_fixtures.table_slice.resolved_datasource is access_fixtures.table


def test_resolved_datasource_missing_row_is_none(
    access_fixtures: SimpleNamespace,
) -> None:
    """A chart whose datasource row is gone resolves to None, not an error."""
    assert access_fixtures.dangling_slice.resolved_datasource is None


def test_resolved_datasource_unknown_type_is_none(app_context: None) -> None:
    """An unknown datasource type resolves to None, not an error."""
    # pylint: disable=import-outside-toplevel
    from superset.models.slice import Slice

    slc = Slice(datasource_id=3, datasource_type="druid")
    assert slc.resolved_datasource is None


def test_resolved_datasource_without_id_is_none(app_context: None) -> None:
    """A chart with no datasource_id resolves to None (inaccessible)."""
    # pylint: disable=import-outside-toplevel
    from superset.models.slice import Slice

    slc = Slice(datasource_id=None, datasource_type="table")
    assert slc.resolved_datasource is None


def test_resolved_datasource_saved_query_is_none(
    access_fixtures: SimpleNamespace,
) -> None:
    """SavedQuery carries no perm, so it cannot participate in access checks:
    resolve to None (inaccessible) instead of crashing the gate."""
    # pylint: disable=import-outside-toplevel
    from superset.models.slice import Slice

    slc = Slice(datasource_id=77, datasource_type="saved_query")
    assert slc.resolved_datasource is None


def test_resolved_datasource_query_resolves(
    access_fixtures: SimpleNamespace,
) -> None:
    """Query exposes a perm property, so it resolves and can be authorized."""
    # pylint: disable=import-outside-toplevel
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query

    slc = Slice(datasource_id=78, datasource_type="query")
    resolved = slc.resolved_datasource
    assert isinstance(resolved, Query)
    assert resolved.perm


# ---------------------------------------------------------------------------
# Object gate: security_manager.raise_for_access(dashboard=..., chart=...)
# ---------------------------------------------------------------------------


def _gate_sm():
    # pylint: disable=import-outside-toplevel
    from superset.security.manager import SupersetSecurityManager

    return SupersetSecurityManager.__new__(SupersetSecurityManager)


@contextmanager
def _gate_patches(sm, *, granted_perms: set[str]) -> Iterator[None]:
    patches = (
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_guest_user", return_value=False),
        patch.object(sm, "get_current_guest_user_if_guest", return_value=None),
        patch.object(sm, "can_access_all_datasources", return_value=False),
        patch.object(
            sm,
            "can_access",
            side_effect=lambda _perm_type, perm: perm in granted_perms,
        ),
        patch.object(sm, "get_dashboard_access_error_object", return_value=MagicMock()),
        patch.object(
            sm, "get_datasource_access_error_object", return_value=MagicMock()
        ),
        patch.object(sm, "get_chart_access_error_object", return_value=MagicMock()),
    )
    with ExitStack() as stack:
        for patcher in patches:
            stack.enter_context(patcher)
        yield


def test_gate_denies_semantic_dashboard_without_grant(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """SC-111233 fail-open case: a scoped user with no DAR grant must be
    denied a semantic-view-only dashboard instead of getting its shell."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException

    sm = _gate_sm()
    with (
        _gate_patches(sm, granted_perms=set()),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=access_fixtures.semantic_dashboard)


def test_gate_allows_semantic_dashboard_for_entitled_user(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A user holding the semantic view's datasource_access perm gets in."""
    sm = _gate_sm()
    with _gate_patches(sm, granted_perms={VIEW_PERM}):
        sm.raise_for_access(dashboard=access_fixtures.semantic_dashboard)


def test_gate_allows_semantic_dashboard_for_layer_grant(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """sc-119501: a datasource_access grant on the PARENT LAYER (not the
    view) admits the user to the dashboard, matching the data path's
    layer-perm fallback in SemanticView.raise_for_access."""
    sm = _gate_sm()
    with _gate_patches(sm, granted_perms={access_fixtures.layer_perm}):
        sm.raise_for_access(dashboard=access_fixtures.semantic_dashboard)


def test_gate_allows_semantic_chart_for_layer_grant(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """sc-119501: the standalone chart gate honors the layer grant too."""
    sm = _gate_sm()
    with _gate_patches(sm, granted_perms={access_fixtures.layer_perm}):
        sm.raise_for_access(chart=access_fixtures.semantic_slice)


def test_gate_layer_grant_is_inert_for_table_dashboards(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """The layer fallback must not leak outside semantic views: a layer
    grant admits nothing on a table-backed dashboard."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException

    sm = _gate_sm()
    with (
        _gate_patches(sm, granted_perms={access_fixtures.layer_perm}),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=access_fixtures.regular_dashboard)


def test_gate_denies_wrong_layer_grant(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A grant on some OTHER layer's perm does not admit this layer's
    views — the fallback matches the exact parent perm only."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException

    sm = _gate_sm()
    with (
        _gate_patches(sm, granted_perms={"[other_layer](id:ffffffff)"}),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=access_fixtures.semantic_dashboard)


def test_gate_denies_regular_dashboard_without_grant(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Parity: the regular-dataset dashboard keeps denying, as before."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException

    sm = _gate_sm()
    with (
        _gate_patches(sm, granted_perms=set()),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=access_fixtures.regular_dashboard)


def test_gate_denies_dashboard_of_unresolvable_datasources(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A chart whose datasource row is gone counts as inaccessible, never as
    absent — even for a user with broad grants."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException

    sm = _gate_sm()
    with (
        _gate_patches(sm, granted_perms={VIEW_PERM, TABLE_PERM}),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=access_fixtures.dangling_dashboard)


def test_gate_still_allows_empty_dashboard(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A dashboard with no charts stays accessible (pinned behaviour)."""
    sm = _gate_sm()
    with _gate_patches(sm, granted_perms=set()):
        sm.raise_for_access(dashboard=access_fixtures.empty_dashboard)


def test_gate_denies_dashboard_with_datasource_less_chart(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Pinned decision: a chart with no datasource reference at all counts as
    inaccessible in the fallback (fail closed), unlike a chart-less dashboard."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException
    from superset.models.slice import Slice

    session = access_fixtures.session
    orphan_slice = Slice(
        slice_name="no datasource",
        datasource_id=None,
        datasource_type="table",
        viz_type="table",
    )
    session.add(orphan_slice)
    session.flush()
    from superset.models.dashboard import Dashboard

    dashboard = Dashboard(
        dashboard_title="orphan",
        slug="orphan",
        published=True,
        slices=[orphan_slice],
    )
    session.add(dashboard)
    session.flush()

    sm = _gate_sm()
    with (
        _gate_patches(sm, granted_perms={VIEW_PERM, TABLE_PERM}),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=dashboard)


def test_gate_allows_semantic_chart_for_entitled_user(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """SC-111233 fail-closed sibling: standalone chart access must work for a
    user holding the semantic view's grant (chart.datasource is None here)."""
    sm = _gate_sm()
    with _gate_patches(sm, granted_perms={VIEW_PERM}):
        sm.raise_for_access(chart=access_fixtures.semantic_slice)


def test_gate_denies_dashboard_of_unsupported_datasource_type(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Gate-level pin for an unsupported datasource_type: a dashboard whose
    chart references an unknown type is denied even for a broadly granted
    user (previously only covered at resolver level). Built transient so the
    unknown type never hits insert-time perm denormalization."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    druid_slice = Slice(
        slice_name="druid chart", datasource_id=3, datasource_type="druid"
    )
    dashboard = Dashboard(
        dashboard_title="druid only", published=True, slices=[druid_slice]
    )

    sm = _gate_sm()
    with (
        _gate_patches(sm, granted_perms={VIEW_PERM, VIEW2_PERM, TABLE_PERM}),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=dashboard)


def test_layer_fallback_never_consults_grants_for_non_semantic_datasource(
    app_context: None,
) -> None:
    """CI regression pin (#43781): integration tests pass MagicMock
    datasources with ``__class__`` reassigned to ``SqlaTable``; the mock
    auto-creates a truthy ``semantic_layer.perm`` child, which duck-typed
    attribute sniffing would bind as a SQL parameter inside ``can_access``.
    The layer fallback must type-check the datasource and answer False
    without any permission lookup."""
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable

    fake = MagicMock()
    fake.__class__ = SqlaTable
    sm = _gate_sm()
    with patch.object(sm, "can_access") as can_access:
        assert sm._semantic_layer_grant_allows(fake) is False
        can_access.assert_not_called()


def test_gate_denies_semantic_chart_without_grant(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """And without the grant the same chart stays denied."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException

    sm = _gate_sm()
    with (
        _gate_patches(sm, granted_perms=set()),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(chart=access_fixtures.semantic_slice)


# ---------------------------------------------------------------------------
# List filter: DashboardAccessFilter dataset-access fallback (branch C)
# ---------------------------------------------------------------------------


def _apply_list_filter(
    *,
    datasource_perms: set[str],
    accessible_databases: list[int],
) -> set[str]:
    """Run DashboardAccessFilter for an anonymous-subject user and return the
    titles of the dashboards it yields."""
    # pylint: disable=import-outside-toplevel
    from superset import db
    from superset.dashboards.filters import DashboardAccessFilter
    from superset.models.dashboard import Dashboard

    view_menus = {
        "datasource_access": set(datasource_perms),
        "schema_access": set(),
        "catalog_access": set(),
    }
    sm = MagicMock()
    sm.is_admin.return_value = False
    sm.can_access_all_datasources.return_value = False
    sm.get_accessible_databases.return_value = accessible_databases
    sm.user_view_menu_names.side_effect = lambda perm: view_menus[perm]

    with (
        patch("superset.dashboards.filters.security_manager", sm),
        patch("superset.security_manager", sm),
        patch(
            "superset.dashboards.filters.guest_embedded_dashboard_filter",
            return_value=None,
        ),
        patch("superset.dashboards.filters.get_user_id", return_value=None),
    ):
        flt = DashboardAccessFilter.__new__(DashboardAccessFilter)
        query = flt.apply(db.session.query(Dashboard), None)
        return {dashboard.dashboard_title for dashboard in query.all()}


def test_list_filter_shows_semantic_dashboard_to_entitled_user(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """SC-111233 fail-closed case: a user with the semantic view's grant must
    see the semantic-view-only dashboard in the list (the inner SqlaTable
    join used to drop it). Uses the NON-colliding view (id 2, no table with
    that id) so the assertion discriminates: under the old unconstrained
    join this dashboard had no SqlaTable row to survive through at all."""
    titles = _apply_list_filter(datasource_perms={VIEW2_PERM}, accessible_databases=[])
    assert titles == {"semantic nocollide"}


def test_list_filter_entitled_visibility_survives_id_collision(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """The colliding view (shares id 1 with a table) is also listed for its
    grant holder — the type constraint must not lose entitled visibility."""
    titles = _apply_list_filter(datasource_perms={VIEW_PERM}, accessible_databases=[])
    assert titles == {"semantic only"}


def test_list_filter_layer_grant_lists_all_layer_dashboards(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """sc-119501: a layer-level grant surfaces every dashboard built on the
    layer's views — both semantic dashboards here share one parent layer."""
    titles = _apply_list_filter(
        datasource_perms={access_fixtures.layer_perm}, accessible_databases=[]
    )
    assert titles == {"semantic only", "semantic nocollide"}


def test_list_filter_hides_everything_without_grants(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """No grants: no dashboards from the dataset-access fallback."""
    titles = _apply_list_filter(datasource_perms=set(), accessible_databases=[])
    assert titles == set()


def test_list_filter_table_grant_matches_only_regular_dashboard(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A table grant lists the regular dashboard and not the semantic one."""
    titles = _apply_list_filter(datasource_perms={TABLE_PERM}, accessible_databases=[])
    assert titles == {"regular"}


def test_list_filter_database_grant_does_not_leak_colliding_semantic_dashboard(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Id-collision control: the semantic view and an unrelated table share
    numeric id 1. Database-level access to that table's database must list
    only the regular dashboard — the type-less join used to bind the
    semantic-view chart to the colliding table and leak its dashboard."""
    titles = _apply_list_filter(datasource_perms=set(), accessible_databases=[10])
    assert titles == {"regular"}
