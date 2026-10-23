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
"""Tests for migration ``e18dda53ce53_canvas_widgets_as_entities``."""

from __future__ import annotations

from importlib import import_module

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, select

from superset.utils import json

migration = import_module(
    "superset.migrations.versions."
    "2026-10-23_12-00_e18dda53ce53_canvas_widgets_as_entities"
)


def test_revision_chain() -> None:
    assert migration.revision == "e18dda53ce53"
    assert migration.down_revision == "06373bc38605"


def test_inline_content_becomes_widgets_the_canvas_editors_edit() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    migration.metadata.create_all(engine)
    definition = {
        "root": {"children": ["kpis", "notes"]},
        "nodes": {
            "kpis": {
                "widgetType": "group",
                "schemaVersion": 1,
                "props": {},
                "layout": {"colSpan": 24},
                "children": ["sales"],
            },
            "sales": {
                "widgetType": "metric-tile",
                "schemaVersion": 1,
                "props": {"title": "Sales"},
                "layout": {"colSpan": 6},
            },
            "notes": {"widgetType": "markdown", "schemaVersion": 1, "props": {}},
        },
    }
    with engine.begin() as conn:
        conn.execute(
            migration.canvases.insert().values(
                id=1, definition=json.dumps(definition), revision=4
            )
        )
        conn.execute(
            migration.canvas_editors.insert().values(subject_id=9, canvas_id=1)
        )
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()

    with engine.connect() as conn:
        canvas = conn.execute(select(migration.canvases)).one()
        widget = conn.execute(select(migration.widgets)).one()
        editors = conn.execute(select(migration.widget_editors)).all()
    nodes = json.loads(canvas.definition)["nodes"]
    assert canvas.revision == 5
    assert nodes["sales"] == {"widgetId": str(widget.uuid), "layout": {"colSpan": 6}}
    assert nodes["kpis"]["widgetType"] == "group"
    assert nodes["notes"]["widgetType"] == "markdown"
    assert (widget.widget_type, widget.name, widget.props) == (
        "metric-tile",
        "Sales",
        {"title": "Sales"},
    )
    assert [(row.subject_id, row.widget_id) for row in editors] == [(9, widget.id)]
