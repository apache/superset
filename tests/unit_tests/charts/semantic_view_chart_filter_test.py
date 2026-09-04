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

"""SC-119500 regression tests: the chart list for non-table datasource types.

``ChartFilter``'s dataset-access fallback (branch C, the sole reachable
path) inner-joined ``Slice.datasource_id == SqlaTable.id`` with no
``datasource_type`` predicate, with two opposite failures for charts on
non-table datasource types (semantic views foremost):

- fail closed: the inner join dropped semantic-view charts entirely, so a
  user holding the view's ``datasource_access`` grant never saw them in the
  chart list — even though the object gate admits them;
- fail open: the type-less join could bind a semantic-view chart to an
  unrelated table sharing its numeric id, listing the chart to a user
  entitled only to the colliding table's database.

The tests pin the grant×type contract in
``specs/sc-119500-chartfilter-datasource-parity/contracts/chart-list-access.md``,
mirroring the dashboard-side tests shipped with apache/superset#43781.
"""

from __future__ import annotations

import uuid as uuid_lib
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm.session import Session

VIEW_PERM = "[test_layer].[test_view](id:1)"
VIEW2_PERM = "[test_layer].[test_view_2](id:2)"
TABLE_PERM = "[examples].[birth_names](id:1)"


@pytest.fixture
def chart_fixtures(session: Session) -> SimpleNamespace:
    """In-memory rows covering every column of the list-access contract.

    The semantic view and the table deliberately share the numeric id ``1``
    so the type-less-join collision case is representable. Perm-carrying
    rows go through the ORM (the ``set_related_perm`` listener denormalizes
    each datasource's explicitly-set perm onto the slice); rows the listener
    cannot handle (saved-query and unknown types — it reads attributes those
    sources lack) are core-inserted with NULL perms, which is exactly the
    state such charts have in a real metadata database.
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
    semantic_slice_2 = Slice(
        slice_name="semantic chart 2",
        datasource_id=view2.id,
        datasource_type="semantic_view",
        datasource_name="test_view_2",
        viz_type="table",
    )
    table_slice = Slice(
        slice_name="table chart",
        datasource_id=table.id,
        datasource_type="table",
        datasource_name="birth_names",
        viz_type="table",
    )
    session.add_all([semantic_slice, semantic_slice_2, table_slice])
    session.flush()

    # Core inserts bypass the ORM listener. The query-typed chart carries the
    # Query row's perm explicitly (``set_related_perm`` cannot denormalize a
    # Query source: it reads ``catalog_perm``, which Query lacks — the same
    # unguarded-source class as SC-119782); a saved-query-backed chart (its
    # source model carries no perm) and an unknown-type chart keep NULL perm
    # columns, and a chart with no datasource reference must never be
    # listed by the fallback nor error.
    query_perm = query.perm
    assert query_perm
    session.execute(
        Slice.__table__.insert(),
        [
            {
                "slice_name": "query chart",
                "datasource_id": query.id,
                "datasource_type": "query",
                "viz_type": "table",
                "perm": query_perm,
                "uuid": uuid_lib.uuid4(),
            },
            {
                "slice_name": "savedquery chart",
                "perm": None,
                "datasource_id": saved_query.id,
                "datasource_type": "saved_query",
                "viz_type": "table",
                "uuid": uuid_lib.uuid4(),
            },
            {
                "slice_name": "druid chart",
                "perm": None,
                "datasource_id": 3,
                "datasource_type": "druid",
                "viz_type": "table",
                "uuid": uuid_lib.uuid4(),
            },
            {
                "slice_name": "no datasource chart",
                "perm": None,
                "datasource_id": None,
                "datasource_type": "table",
                "viz_type": "table",
                "uuid": uuid_lib.uuid4(),
            },
        ],
    )
    session.flush()

    return SimpleNamespace(
        session=session,
        layer_perm=layer_perm,
        query_perm=query_perm,
    )


ALL_CHART_NAMES = {
    "semantic chart",
    "semantic chart 2",
    "table chart",
    "query chart",
    "savedquery chart",
    "druid chart",
    "no datasource chart",
}


def _apply_chart_filter(
    *,
    datasource_perms: set[str],
    accessible_databases: list[int],
    all_datasources: bool = False,
) -> set[str]:
    """Run ChartFilter for an anonymous-subject user and return the names of
    the charts it yields."""
    # pylint: disable=import-outside-toplevel
    from superset import db
    from superset.charts.filters import ChartFilter
    from superset.models.slice import Slice

    view_menus = {
        "datasource_access": set(datasource_perms),
        "schema_access": set(),
        "catalog_access": set(),
    }
    sm = MagicMock()
    sm.is_admin.return_value = False
    sm.can_access_all_datasources.return_value = all_datasources
    sm.get_accessible_databases.return_value = accessible_databases
    sm.user_view_menu_names.side_effect = lambda perm: view_menus[perm]

    with (
        patch("superset.charts.filters.security_manager", sm),
        patch("superset.security_manager", sm),
        patch(
            "superset.charts.filters.guest_embedded_dashboard_filter",
            return_value=None,
        ),
        patch("superset.charts.filters.get_user_id", return_value=None),
    ):
        flt = ChartFilter.__new__(ChartFilter)
        query = flt.apply(db.session.query(Slice), None)
        return {slc.slice_name for slc in query.all()}


def test_list_hides_everything_without_grants(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """No grants: the dataset-access fallback yields no charts of any type."""
    names = _apply_chart_filter(datasource_perms=set(), accessible_databases=[])
    assert names == set()


def test_list_shows_semantic_chart_to_entitled_user(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """SC-119500 fail-closed case: a user with the semantic view's grant must
    see the view's chart in the list (the inner SqlaTable join used to drop
    it). Uses the NON-colliding view (id 2, no table with that id) so the
    assertion discriminates: under the old unconstrained join this chart had
    no SqlaTable row to survive through at all."""
    names = _apply_chart_filter(datasource_perms={VIEW2_PERM}, accessible_databases=[])
    assert names == {"semantic chart 2"}


def test_list_entitled_visibility_survives_id_collision(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """The colliding view (shares id 1 with a table) is also listed for its
    grant holder — the type constraint must not lose entitled visibility."""
    names = _apply_chart_filter(datasource_perms={VIEW_PERM}, accessible_databases=[])
    assert names == {"semantic chart"}


def test_list_table_grant_matches_only_table_chart(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A table grant lists the table's chart and nothing else."""
    names = _apply_chart_filter(datasource_perms={TABLE_PERM}, accessible_databases=[])
    assert names == {"table chart"}


def test_list_database_grant_does_not_leak_colliding_semantic_chart(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Id-collision control (FR-007): the semantic view and an unrelated
    table share numeric id 1. Database-level access to that table's database
    must list only the table's chart — the type-less join used to bind the
    semantic-view chart to the colliding table and leak it."""
    names = _apply_chart_filter(datasource_perms=set(), accessible_databases=[10])
    assert names == {"table chart"}


def test_list_layer_grant_lists_all_layer_charts(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """sc-119501 mirror (FR-002): a datasource_access grant on the PARENT
    LAYER surfaces every chart built on the layer's views, matching the
    dashboard list and both object gates."""
    names = _apply_chart_filter(
        datasource_perms={chart_fixtures.layer_perm}, accessible_databases=[]
    )
    assert names == {"semantic chart", "semantic chart 2"}


def test_list_wrong_layer_grant_lists_nothing(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """A grant on some OTHER layer's perm matches none of this layer's
    charts — the layer clause matches the exact parent perm only."""
    names = _apply_chart_filter(
        datasource_perms={"[other_layer](id:ffffffff)"}, accessible_databases=[]
    )
    assert names == set()


def test_list_query_chart_participates_uniformly(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """Uniform participation (clarify Q2): any perm-carrying datasource type
    is listed when its denormalized perm matches a held grant — no per-type
    allowlist. A ``query``-typed chart is the non-semantic witness."""
    names = _apply_chart_filter(
        datasource_perms={chart_fixtures.query_perm}, accessible_databases=[]
    )
    assert names == {"query chart"}


def test_list_all_datasource_access_lists_everything(
    chart_fixtures: SimpleNamespace, app_context: None
) -> None:
    """all_datasource_access short-circuits the fallback and lists every
    chart, including NULL-perm rows the fallback itself can never match."""
    names = _apply_chart_filter(
        datasource_perms=set(), accessible_databases=[], all_datasources=True
    )
    assert names == ALL_CHART_NAMES
