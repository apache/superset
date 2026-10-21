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
"""Chart listings must name and link the semantic view behind a chart.

A chart's ``datasource_id`` is only unique within its ``datasource_type``, so a
semantic view and a regular dataset routinely share a numeric id. These tests
use real rows with a deliberate id collision to pin that a chart always resolves
to a datasource of its own kind. They drive the ORM relationship directly: the
chart list API serialises these same model helpers (``datasource_name_text``,
``datasource_url``) without transformation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.slice import Slice
from superset.semantic_layers.models import SemanticLayer, SemanticView

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

SHARED_ID = 7

# The resolver does not consult the feature flag; this pins that charts already
# built on a semantic view keep resolving after SEMANTIC_LAYERS is turned off.
FLAG_OFF = pytest.mark.parametrize(
    "app",
    [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": False}}],
    ids=["semantic_layers_off"],
    indirect=True,
)


def _seed(session: Session) -> tuple[Slice, Slice]:
    """Insert a semantic view and a dataset sharing an id, and a chart on each."""
    SqlaTable.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")
    table = SqlaTable(
        id=SHARED_ID, table_name="aaa_table", schema="public", database=database
    )
    layer = SemanticLayer(name="demo", type="demo", configuration={})
    view = SemanticView(
        id=SHARED_ID, name="orders", semantic_layer=layer, configuration={}
    )
    view_chart = Slice(
        slice_name="On the view",
        datasource_type="semantic_view",
        datasource_id=SHARED_ID,
        datasource_name="orders",
        viz_type="table",
        params="{}",
    )
    table_chart = Slice(
        slice_name="On the table",
        datasource_type="table",
        datasource_id=SHARED_ID,
        datasource_name="aaa_table",
        viz_type="table",
        params="{}",
    )
    session.add_all([database, table, layer, view, view_chart, table_chart])
    session.flush()
    session.expire_all()
    return view_chart, table_chart


@FLAG_OFF
def test_semantic_view_chart_resolves_to_the_view_not_the_colliding_table(
    app: object,
    session: Session,
) -> None:
    """The display name/link come from the semantic view sharing the id."""
    view_chart, table_chart = _seed(session)

    assert view_chart.datasource_name_text() == "orders"
    assert (
        view_chart.datasource_url()
        == f"/explore/?datasource_type=semantic_view&datasource_id={SHARED_ID}"
    )
    assert (
        view_chart.datasource_edit_url
        == f"/semantic_view/{view_chart.semantic_view.uuid}/"
    )
    # No legacy HTML renderer exists for semantic views; the helper degrades.
    assert view_chart.datasource_link() is None
    # The dataset chart on the same numeric id is untouched by the new path.
    assert table_chart.datasource_name_text() == "public.aaa_table"
    assert (
        table_chart.datasource_url()
        == f"/explore/?datasource_type=table&datasource_id={SHARED_ID}"
    )


def test_semantic_view_chart_with_deleted_view_degrades_to_empty(
    session: Session,
) -> None:
    """A dangling semantic-view id yields empty fields, never an error."""
    view_chart, _ = _seed(session)
    session.delete(session.get(SemanticView, SHARED_ID))
    session.flush()
    session.expire_all()

    assert view_chart.datasource_name_text() is None
    assert view_chart.datasource_url() is None
    assert view_chart.datasource_edit_url is None
    assert view_chart.datasource_link() is None


def test_charts_sort_by_stored_datasource_name_across_kinds(
    session: Session,
) -> None:
    """Characterisation: list sorting uses the stored ``datasource_name`` column.

    The chart list orders by the name captured when the chart was saved, not by
    the resolved display name, for datasets and semantic views alike; the two
    can disagree after a rename. Pinned here so the split is deliberate.
    """
    view_chart, table_chart = _seed(session)

    ordered = [
        slc.id for slc in session.query(Slice).order_by(Slice.datasource_name).all()
    ]

    assert ordered.index(table_chart.id) < ordered.index(view_chart.id)
    assert view_chart.datasource_name == "orders"
