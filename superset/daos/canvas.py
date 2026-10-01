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
"""Data access for canvases and their operation log."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func

from superset import db
from superset.canvas.definition.ops import AppliedOperation
from superset.canvas.definition.upgrades import upgrade_definition
from superset.canvas.filters import CanvasAccessFilter
from superset.daos.base import BaseDAO
from superset.models.canvas import Canvas, CanvasOp
from superset.utils import json


class CanvasDAO(BaseDAO[Canvas]):
    base_filter = CanvasAccessFilter

    @staticmethod
    def lock(canvas_id: int) -> Canvas:
        """Reload the canvas row under a write lock for the transaction."""
        return (
            db.session.query(Canvas)
            .filter(Canvas.id == canvas_id)
            .with_for_update()
            .populate_existing()
            .one()
        )

    @staticmethod
    def slug_in_use(slug: str, exclude_id: int | None = None) -> bool:
        """Whether another canvas, visible to the caller or not, has ``slug``."""
        query = db.session.query(Canvas).filter(Canvas.slug == slug)
        if exclude_id is not None:
            query = query.filter(Canvas.id != exclude_id)
        return db.session.query(query.exists()).scalar()

    @staticmethod
    def load(canvas: Canvas) -> dict[str, Any]:
        """The stored definition, upgraded to the current schema version."""
        return upgrade_definition(json.loads(canvas.definition))

    @staticmethod
    def ops_since(canvas_id: int, revision: int) -> list[CanvasOp]:
        """Logged operations after ``revision``, in application order."""
        return (
            db.session.query(CanvasOp)
            .filter(CanvasOp.canvas_id == canvas_id, CanvasOp.revision > revision)
            .order_by(CanvasOp.revision, CanvasOp.sequence)
            .all()
        )

    @staticmethod
    def oldest_logged_revision(canvas_id: int) -> int | None:
        return (
            db.session.query(func.min(CanvasOp.revision))
            .filter(CanvasOp.canvas_id == canvas_id)
            .scalar()
        )

    @staticmethod
    def log(
        canvas_id: int,
        revision: int,
        applied: list[AppliedOperation],
        user_id: int | None,
    ) -> None:
        db.session.add_all(
            CanvasOp(
                canvas_id=canvas_id,
                revision=revision,
                sequence=sequence,
                op=json.dumps(operation.op),
                touched=json.dumps(
                    [[touch.node_id, touch.group.value] for touch in operation.touched]
                ),
                created_by_fk=user_id,
            )
            for sequence, operation in enumerate(applied)
        )

    @staticmethod
    def prune(canvas_id: int, keep_after_revision: int | None = None) -> None:
        """Drop logged operations at or before ``keep_after_revision``, or all."""
        query = db.session.query(CanvasOp).filter(CanvasOp.canvas_id == canvas_id)
        if keep_after_revision is not None:
            query = query.filter(CanvasOp.revision <= keep_after_revision)
        query.delete(synchronize_session=False)
