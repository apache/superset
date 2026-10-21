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
from typing import cast, Iterator, TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import event
from sqlalchemy.engine import Connection, Engine, ExecutionContext
from sqlalchemy.orm.session import Session

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.security.manager import SupersetSecurityManager

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


@pytest.mark.parametrize("allow_last", [False, True])
def test_dashboard_batches_query_datasource_resolution(
    access_fixtures: SimpleNamespace, app_context: None, allow_last: bool
) -> None:
    """Distinct query references use one SELECT without changing allow/deny."""
    from superset.exceptions import SupersetSecurityException
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query

    session: Session = access_fixtures.session
    queries: list[Query] = [
        Query(id=idx, client_id=f"batch{idx}", database_id=10, sql="select 1")
        for idx in (80, 81, 82)
    ]
    session.add_all(queries)
    session.flush()
    dashboard: Dashboard = Dashboard(
        dashboard_title="query members",
        published=True,
        slices=[
            Slice(datasource_type="query", datasource_id=idx)
            for idx in (80, 80, 81, 82)
        ],
    )
    granted_perms: set[str] = {queries[-1].perm} if allow_last else set()
    statements: list[str] = []
    engine: Engine = session.get_bind()

    def record_query_select(
        connection: Connection,
        cursor: object,
        statement: str,
        parameters: object,
        context: ExecutionContext,
        executemany: bool,
    ) -> None:
        """Count actual datasource SELECTs, not mocked DAO invocations."""
        if "FROM query " in statement or 'FROM "query" ' in statement:
            statements.append(statement)

    sm: SupersetSecurityManager = _gate_sm()
    event.listen(engine, "before_cursor_execute", record_query_select)
    try:
        with _gate_patches(sm, granted_perms=granted_perms):
            if allow_last:
                sm.raise_for_access(dashboard=dashboard)
            else:
                with pytest.raises(SupersetSecurityException):
                    sm.raise_for_access(dashboard=dashboard)
    finally:
        event.remove(engine, "before_cursor_execute", record_query_select)
    assert len(statements) == 1, statements


@pytest.mark.parametrize(
    ("datasource_type", "datasource_id", "expected_access"),
    [
        ("table", 1, True),
        ("semantic_view", 1, True),
        ("query", 78, True),
        ("query", 999, False),
        ("query", -78, False),
        ("query", True, False),
        ("saved_query", 77, False),
        ("unknown", 1, False),
        (None, 1, False),
        ("table", None, False),
    ],
)
def test_batched_dashboard_resolution_preserves_access_decisions(
    access_fixtures: SimpleNamespace,
    app_context: None,
    datasource_type: str | None,
    datasource_id: int | None,
    expected_access: bool,
) -> None:
    """A typed batch preserves the single resolver's fail-closed decisions."""
    from superset.daos.datasource import Datasource
    from superset.exceptions import SupersetSecurityException
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query

    session: Session = access_fixtures.session
    query: Query = session.query(Query).filter(Query.id == 78).one()
    grants: set[str] = {TABLE_PERM, VIEW_PERM, query.perm}
    member: Slice
    if datasource_type == "table" and datasource_id == 1:
        member = access_fixtures.table_slice
    elif datasource_type == "semantic_view":
        member = access_fixtures.semantic_slice
    else:
        member = Slice(datasource_type=datasource_type, datasource_id=datasource_id)
    dashboard: Dashboard = Dashboard(
        dashboard_title="typed resolution", published=True, slices=[member]
    )
    sm: SupersetSecurityManager = _gate_sm()
    with _gate_patches(sm, granted_perms=grants):
        original: Datasource | None = member.resolved_datasource
        assert bool(original is not None and sm.can_access_datasource(original)) == (
            expected_access
        )
        if expected_access:
            sm.raise_for_access(dashboard=dashboard)
        else:
            with pytest.raises(SupersetSecurityException):
                sm.raise_for_access(dashboard=dashboard)


@pytest.mark.parametrize("relationship_type", ["table", "semantic_view"])
def test_dashboard_relationship_short_circuit_skips_fallback_batch(
    access_fixtures: SimpleNamespace, app_context: None, relationship_type: str
) -> None:
    """An accessible relationship-backed member avoids loading later queries."""
    from superset.daos.datasource import DatasourceDAO
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    member: Slice = (
        access_fixtures.table_slice
        if relationship_type == "table"
        else access_fixtures.semantic_slice
    )
    dashboard: Dashboard = Dashboard(
        dashboard_title="relationship first",
        published=True,
        slices=[member, Slice(datasource_type="query", datasource_id=78)],
    )
    sm: SupersetSecurityManager = _gate_sm()
    with (
        _gate_patches(sm, granted_perms={TABLE_PERM, VIEW_PERM}),
        patch.object(DatasourceDAO, "get_datasources_by_ids") as batch,
    ):
        sm.raise_for_access(dashboard=dashboard)
        batch.assert_not_called()


def test_batched_resolver_keeps_typed_order_and_relationship_identity(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Batches neither reorder members nor conflate colliding table/view IDs."""
    from superset.daos.datasource import Datasource, DatasourceDAO
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query

    session: Session = access_fixtures.session
    query: Query = session.query(Query).filter(Query.id == 78).one()
    members: list[Slice] = [
        access_fixtures.semantic_slice,
        Slice(datasource_type="query", datasource_id=78),
        access_fixtures.table_slice,
        Slice(datasource_type="query", datasource_id=78),
        Slice(datasource_type="saved_query", datasource_id=77),
        Slice(datasource_type="query", datasource_id=999),
    ]
    with patch.object(
        DatasourceDAO,
        "get_datasources_by_ids",
        wraps=DatasourceDAO.get_datasources_by_ids,
    ) as batch:
        resolved: list[Datasource | None] = list(
            Slice.iter_resolved_datasources(members)
        )
    assert resolved == [access_fixtures.view, query, access_fixtures.table, None, None]
    assert batch.call_count == 2
    batch.assert_any_call("query", {78, 999})
    batch.assert_any_call("saved_query", {77})


def test_batched_resolver_does_not_cache_across_calls(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A later resolution sees deletion rather than a prior batch's Query."""
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query

    session: Session = access_fixtures.session
    member: Slice = Slice(datasource_type="query", datasource_id=78)
    assert next(Slice.iter_resolved_datasources([member])) is not None
    session.query(Query).filter(Query.id == 78).delete(synchronize_session=False)
    assert list(Slice.iter_resolved_datasources([member])) == [None]


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
    """A PUBLISHED dashboard with no charts stays accessible.

    Chart-less dashboards can still carry markdown content, and published
    is the signal that content is meant to be shared; the fixture is
    published, so this pins the fallback's allow half (sc-120032)."""
    sm = _gate_sm()
    with _gate_patches(sm, granted_perms=set()):
        sm.raise_for_access(dashboard=access_fixtures.empty_dashboard)


def test_gate_denies_unpublished_empty_dashboard(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """sc-120032: an UNPUBLISHED chart-less dashboard is editor-only.

    Previously any authenticated user could read it by URL even though it
    appeared in no list (the list filter's fallback was already
    published-only); markdown-only dashboards made that a content leak."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException
    from superset.models.dashboard import Dashboard

    unpublished_empty: Dashboard = Dashboard(
        dashboard_title="unpublished empty",
        slug="unpublished-empty",
        published=False,
        slices=[],
    )
    access_fixtures.session.add(unpublished_empty)
    access_fixtures.session.flush()

    sm: SupersetSecurityManager = _gate_sm()
    with (
        _gate_patches(sm, granted_perms=set()),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=unpublished_empty)


def test_gate_allows_published_table_dashboard_for_entitled_user(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Publication admits a datasource-entitled reader with no viewer subjects."""
    sm: SupersetSecurityManager = _gate_sm()
    with _gate_patches(sm, granted_perms={TABLE_PERM}):
        sm.raise_for_access(dashboard=access_fixtures.regular_dashboard)


def test_gate_denies_unpublished_dashboard_despite_datasource_grant(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """sc-120031: an unpublished no-viewers dashboard denies datasource holders.

    With viewers empty, a datasource-entitled non-editor used to be
    admitted to an UNPUBLISHED dashboard through the fallback — so
    removing the last viewer subject silently WIDENED access (the viewer
    branch is published-gated but the fallback was not). The fallback now
    requires published, matching the list filter's fallback branch."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException
    from superset.models.dashboard import Dashboard

    unpublished_regular: Dashboard = Dashboard(
        dashboard_title="unpublished regular",
        slug="unpublished-regular",
        published=False,
        slices=[access_fixtures.table_slice],
    )
    access_fixtures.session.add(unpublished_regular)
    access_fixtures.session.flush()

    sm: SupersetSecurityManager = _gate_sm()
    with (
        _gate_patches(sm, granted_perms={TABLE_PERM}),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(dashboard=unpublished_regular)


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
    join this dashboard had no SqlaTable row to survive through at all.

    The chart-less "empty" dashboard is always included in the fallback
    (sc-120032): it has no dataset to check access against, so it survives
    regardless of which grants the user holds."""
    titles = _apply_list_filter(datasource_perms={VIEW2_PERM}, accessible_databases=[])
    assert titles == {"semantic nocollide", "empty"}


def test_list_filter_entitled_visibility_survives_id_collision(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """The colliding view (shares id 1 with a table) is also listed for its
    grant holder — the type constraint must not lose entitled visibility."""
    titles = _apply_list_filter(datasource_perms={VIEW_PERM}, accessible_databases=[])
    assert titles == {"semantic only", "empty"}


def test_list_filter_layer_grant_lists_all_layer_dashboards(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """sc-119501: a layer-level grant surfaces every dashboard built on the
    layer's views — both semantic dashboards here share one parent layer."""
    titles = _apply_list_filter(
        datasource_perms={access_fixtures.layer_perm}, accessible_databases=[]
    )
    assert titles == {"semantic only", "semantic nocollide", "empty"}


def test_list_filter_hides_everything_without_grants(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """No grants: no dashboards from the dataset-access fallback, except the
    chart-less "empty" dashboard (sc-120032), which has no dataset to check
    access against and so is unaffected by the grant set."""
    titles = _apply_list_filter(datasource_perms=set(), accessible_databases=[])
    assert titles == {"empty"}


def test_list_filter_table_grant_matches_only_regular_dashboard(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A table grant lists the regular dashboard and not the semantic one,
    plus the always-visible chart-less "empty" dashboard (sc-120032)."""
    titles = _apply_list_filter(datasource_perms={TABLE_PERM}, accessible_databases=[])
    assert titles == {"regular", "empty"}


def test_list_filter_database_grant_does_not_leak_colliding_semantic_dashboard(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Id-collision control: the semantic view and an unrelated table share
    numeric id 1. Database-level access to that table's database must list
    only the regular dashboard — the type-less join used to bind the
    semantic-view chart to the colliding table and leak its dashboard. The
    chart-less "empty" dashboard is always included (sc-120032)."""
    titles = _apply_list_filter(datasource_perms=set(), accessible_databases=[10])
    assert titles == {"regular", "empty"}


def test_list_filter_hides_dashboard_with_only_soft_deleted_charts(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """sc-120032 regression (soft-delete edge case flagged in review): a
    dashboard whose only chart has been soft-deleted must be treated the
    same as a genuinely chart-less one -- listed via the fallback's
    ``Slice.id.is_(None)`` arm, matching the outer join's own exclusion of
    soft-deleted slices, rather than via an ``EXISTS`` that would still see
    the row."""
    # pylint: disable=import-outside-toplevel
    from datetime import datetime

    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    session = access_fixtures.session
    deleted_slice = Slice(
        slice_name="soft-deleted chart",
        datasource_id=access_fixtures.table.id,
        datasource_type="table",
        datasource_name="birth_names",
        viz_type="table",
        deleted_at=datetime.now(),
    )
    session.add(deleted_slice)
    session.flush()

    dashboard = Dashboard(
        dashboard_title="all charts soft-deleted",
        slug="all-charts-soft-deleted",
        published=True,
        slices=[deleted_slice],
    )
    session.add(dashboard)
    session.flush()

    titles = _apply_list_filter(datasource_perms=set(), accessible_databases=[])
    assert "all charts soft-deleted" in titles


# ---------------------------------------------------------------------------
# Drill membership: Dashboard.has_member_datasource (SC-119500 / FR-005)
# ---------------------------------------------------------------------------


def test_membership_rejects_datasource_without_id() -> None:
    """A duck-typed datasource without an id is not a dashboard member."""
    from superset.connectors.sqla.models import BaseDatasource
    from superset.models.dashboard import Dashboard

    datasource: BaseDatasource = cast(BaseDatasource, SimpleNamespace(type="table"))
    dashboard: Dashboard = Dashboard()

    assert dashboard.has_member_datasource(datasource) is False


def test_membership_recognizes_semantic_view_member(
    access_fixtures: SimpleNamespace,
) -> None:
    """A member semantic view is recognized — the table-shaped
    ``Dashboard.datasources`` set made this vacuously false."""
    dashboard: Dashboard = access_fixtures.semantic_dashboard
    assert dashboard.has_member_datasource(access_fixtures.view) is True


def test_membership_rejects_colliding_non_member_table(
    access_fixtures: SimpleNamespace,
) -> None:
    """A table sharing the member view's numeric id but NOT on the dashboard
    is no member — a bare id-set test could have said true."""
    dashboard: Dashboard = access_fixtures.semantic_dashboard
    assert dashboard.has_member_datasource(access_fixtures.table) is False


def test_membership_recognizes_table_member(
    access_fixtures: SimpleNamespace,
) -> None:
    """Table membership keeps working through the same pair comparison."""
    dashboard: Dashboard = access_fixtures.regular_dashboard
    assert dashboard.has_member_datasource(access_fixtures.table) is True


def test_membership_rejects_colliding_non_member_view(
    access_fixtures: SimpleNamespace,
) -> None:
    """The mirror collision: the semantic view sharing the member table's id
    is no member of the table dashboard."""
    dashboard: Dashboard = access_fixtures.regular_dashboard
    assert dashboard.has_member_datasource(access_fixtures.view) is False


def test_drill_via_dashboard_access_recognizes_semantic_member(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """SC-119500 / FR-005: an embedded guest with dashboard access can pass
    the drill membership check for a member semantic view. Capability gating
    (``supports_drill_to_detail``) is separate and still denies semantic
    views today; this pins the membership primitive for the day a provider
    enables drill."""
    sm: SupersetSecurityManager = _gate_sm()
    with (
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
        ),
        patch.object(sm, "is_guest_user", return_value=True),
        patch.object(sm, "has_guest_access", return_value=True),
    ):
        assert sm.can_drill_dataset_via_dashboard_access(
            access_fixtures.view, access_fixtures.semantic_dashboard
        )


def test_drill_via_dashboard_access_rejects_colliding_non_member(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """The colliding table is not drillable via the semantic dashboard — the
    replaced id-set membership test would have matched its bare id."""
    sm: SupersetSecurityManager = _gate_sm()
    with (
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
        ),
        patch.object(sm, "is_guest_user", return_value=True),
        patch.object(sm, "has_guest_access", return_value=True),
    ):
        assert not sm.can_drill_dataset_via_dashboard_access(
            access_fixtures.table, access_fixtures.semantic_dashboard
        )


def test_has_drill_access_drill_to_detail_semantic_member(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Drill to Detail's dashboard-membership leg recognizes a member
    semantic view (no slice context in the form data)."""
    sm: SupersetSecurityManager = _gate_sm()
    assert sm.has_drill_access(
        {}, access_fixtures.semantic_dashboard, access_fixtures.view
    )


def test_has_drill_access_rejects_colliding_non_member(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """And the colliding non-member table stays rejected on the same leg."""
    sm: SupersetSecurityManager = _gate_sm()
    assert not sm.has_drill_access(
        {}, access_fixtures.semantic_dashboard, access_fixtures.table
    )


# ---------------------------------------------------------------------------
# Embedded-guest datasets allowlist (SC-119500 / FR-006)
# ---------------------------------------------------------------------------


def test_guest_allowlist_denies_semantic_member_chart(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """FR-006 pin — DECIDED fail-closed semantic, not an accident: a guest
    token carrying a ``datasets`` allowlist denies a semantic-view member
    chart, because the allowlist is dataset-id space and resolving other
    datasource types into it would reintroduce id-collision ambiguity. The
    token even allowlists id 1 — the number this view shares with a table —
    and must still deny. Revisit only with a type-qualified allowlist claim."""
    # pylint: disable=import-outside-toplevel
    from superset.exceptions import SupersetSecurityException

    sm: SupersetSecurityManager = _gate_sm()
    guest: MagicMock = MagicMock()
    guest.guest_token = {"datasets": [1]}
    with (
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
        ),
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_guest_user", return_value=True),
        patch.object(sm, "get_current_guest_user_if_guest", return_value=guest),
        patch.object(sm, "has_guest_access", return_value=True),
        patch.object(sm, "can_access_all_datasources", return_value=False),
        patch.object(sm, "can_access", return_value=False),
        patch.object(sm, "get_chart_access_error_object", return_value=MagicMock()),
        patch.object(
            sm, "get_datasource_access_error_object", return_value=MagicMock()
        ),
        pytest.raises(SupersetSecurityException),
    ):
        sm.raise_for_access(chart=access_fixtures.semantic_slice)


def test_guest_allowlist_allows_table_member_chart(
    access_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Companion control: the very same token admits the table-backed member
    chart whose dataset id it names — the denial above is the type gap, not
    a broken allowlist."""
    sm: SupersetSecurityManager = _gate_sm()
    guest: MagicMock = MagicMock()
    guest.guest_token = {"datasets": [1]}
    with (
        patch(
            "superset.is_feature_enabled",
            side_effect=lambda flag: flag == "EMBEDDED_SUPERSET",
        ),
        patch.object(sm, "is_admin", return_value=False),
        patch.object(sm, "is_editor", return_value=False),
        patch.object(sm, "is_guest_user", return_value=True),
        patch.object(sm, "get_current_guest_user_if_guest", return_value=guest),
        patch.object(sm, "has_guest_access", return_value=True),
        patch.object(sm, "can_access_all_datasources", return_value=False),
        patch.object(sm, "can_access", return_value=False),
        patch.object(sm, "get_chart_access_error_object", return_value=MagicMock()),
        patch.object(
            sm, "get_datasource_access_error_object", return_value=MagicMock()
        ),
    ):
        sm.raise_for_access(chart=access_fixtures.table_slice)
