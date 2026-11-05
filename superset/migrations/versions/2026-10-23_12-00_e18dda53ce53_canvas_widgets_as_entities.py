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
"""Move canvas content widgets into the widgets table.

Only structural widgets (containers and text) stay stored on a canvas
placement. Every other widget a canvas stored inline becomes a ``widgets``
row, edited by the canvas's editors, and its placement references it.

Revision ID: e18dda53ce53
Revises: 06373bc38605
Create Date: 2026-10-23 12:00:00.000000

"""

from datetime import datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from superset.utils import json

# revision identifiers, used by Alembic.
revision = "e18dda53ce53"
down_revision = "06373bc38605"

# The built-in structural widget types when this migration was written.
STRUCTURAL = {"group", "tabs", "tab", "filter.bar", "markdown"}

metadata = sa.MetaData()
canvases = sa.Table(
    "canvases",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("definition", sa.Text),
    sa.Column("revision", sa.BigInteger),
)
canvas_editors = sa.Table(
    "canvas_editors",
    metadata,
    sa.Column("subject_id", sa.Integer),
    sa.Column("canvas_id", sa.Integer),
)
widgets = sa.Table(
    "widgets",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("uuid", UUIDType(binary=True)),
    sa.Column("widget_type", sa.String(250)),
    sa.Column("schema_version", sa.Integer),
    sa.Column("name", sa.String(250)),
    sa.Column("props", sa.JSON),
    sa.Column("revision", sa.Integer),
    sa.Column("created_on", sa.DateTime),
    sa.Column("changed_on", sa.DateTime),
)
widget_editors = sa.Table(
    "widget_editors",
    metadata,
    sa.Column("subject_id", sa.Integer),
    sa.Column("widget_id", sa.Integer),
)


def _name(node: dict, widget_type: str) -> str:
    title = (node.get("props") or {}).get("title")
    name = title if isinstance(title, str) and title.strip() else widget_type
    return name[:250]


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now()
    for canvas in bind.execute(sa.select(canvases)).fetchall():
        definition = json.loads(canvas.definition)
        editors = [
            row.subject_id
            for row in bind.execute(
                sa.select(canvas_editors.c.subject_id).where(
                    canvas_editors.c.canvas_id == canvas.id
                )
            )
        ]
        changed = False
        for node_id, node in definition.get("nodes", {}).items():
            widget_type = node.get("widgetType")
            if not widget_type or widget_type in STRUCTURAL:
                continue
            widget_uuid = uuid4()
            widget_id = bind.execute(
                widgets.insert().values(
                    uuid=widget_uuid,
                    widget_type=widget_type,
                    schema_version=node.get("schemaVersion") or 1,
                    name=_name(node, widget_type),
                    props=node.get("props") or {},
                    revision=1,
                    created_on=now,
                    changed_on=now,
                )
            ).inserted_primary_key[0]
            for subject_id in editors:
                bind.execute(
                    widget_editors.insert().values(
                        subject_id=subject_id, widget_id=widget_id
                    )
                )
            replaced = {"widgetId": str(widget_uuid), "layout": node.get("layout", {})}
            if "children" in node:
                replaced["children"] = node["children"]
            definition["nodes"][node_id] = replaced
            changed = True
        if changed:
            # A new revision, so drafts started from the inline form can't
            # be committed over it.
            bind.execute(
                canvases.update()
                .where(canvases.c.id == canvas.id)
                .values(
                    definition=json.dumps(definition),
                    revision=canvas.revision + 1,
                )
            )


def downgrade() -> None:
    # The widgets may since be placed elsewhere or edited on their own, so
    # they are left as they are.
    pass
