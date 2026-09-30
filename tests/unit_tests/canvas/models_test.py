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
from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.session import Session

from superset.utils import json


@pytest.fixture
def canvas_session(session: Session) -> Iterator[Session]:
    from superset.models.canvas import Canvas

    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    yield session
    session.rollback()


def new_canvas(title: str = "Exec overview") -> Any:
    from superset.canvas.definition.schemas import empty_definition
    from superset.models.canvas import Canvas

    return Canvas(
        title=title,
        definition=json.dumps(empty_definition()),
        definition_version=1,
    )


def test_canvas_has_an_integer_id_and_a_uuid(canvas_session: Session) -> None:
    canvas = new_canvas()
    canvas_session.add(canvas)
    canvas_session.flush()

    # The integer id plus uuid shape is what entity versioning expects.
    assert isinstance(canvas.id, int)
    assert isinstance(canvas.uuid, UUID)
    assert canvas.revision == 1
    assert canvas.url == f"/canvas/{canvas.id}/"


def test_op_log_is_unique_per_revision_and_sequence(canvas_session: Session) -> None:
    from superset.models.canvas import CanvasOp

    canvas = new_canvas()
    canvas_session.add(canvas)
    canvas_session.flush()

    def log(sequence: int) -> CanvasOp:
        return CanvasOp(
            canvas_id=canvas.id,
            revision=2,
            sequence=sequence,
            op=json.dumps({"op": "remove", "id": "n0"}),
            touched=json.dumps([["n0", "tree"]]),
        )

    canvas_session.add_all([log(0), log(1)])
    canvas_session.flush()
    stored = canvas_session.query(CanvasOp).order_by("sequence").all()

    assert [row.sequence for row in stored] == [0, 1]
    assert stored[0].op_dict == {"op": "remove", "id": "n0"}
    assert stored[0].touched_pairs == [("n0", "tree")]

    canvas_session.add(log(1))
    with pytest.raises(IntegrityError):
        canvas_session.flush()


def test_deleting_a_canvas_deletes_its_op_log(canvas_session: Session) -> None:
    from superset.models.canvas import CanvasOp

    canvas = new_canvas()
    canvas.ops.append(CanvasOp(revision=2, sequence=0, op="{}", touched="[]"))
    canvas_session.add(canvas)
    canvas_session.flush()

    canvas_session.delete(canvas)
    canvas_session.flush()

    assert canvas_session.query(CanvasOp).count() == 0
