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

"""Tests for SemanticViewDAO."""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy.orm.session import Session


@pytest.fixture
def session_with_semantic_view(session: Session) -> Iterator[Session]:
    """Create an in-memory DB with a SemanticLayer and one SemanticView."""
    from superset.semantic_layers.models import SemanticLayer, SemanticView

    engine = session.get_bind()
    SemanticView.metadata.create_all(engine)  # pylint: disable=no-member

    layer = SemanticLayer(
        uuid=uuid.uuid4(),
        name="test_layer",
        type="test",
        configuration="{}",
    )
    session.add(layer)
    session.flush()

    view = SemanticView(
        id=1,
        uuid=uuid.uuid4(),
        name="test_view",
        semantic_layer_uuid=layer.uuid,
        configuration="{}",
    )
    session.add(view)
    session.flush()

    return session


def test_find_by_id_uses_integer_id_column(
    session_with_semantic_view: Session,
) -> None:
    """
    SemanticViewDAO.find_by_id must look up by the integer ``id`` column, not
    by ``uuid``.

    Regression test: SemanticViewDAO previously set ``id_column_name = "uuid"``,
    which caused find_by_id(pk) to filter on the UUID column using an integer
    value, always returning None and making every PUT request return 404.
    """
    from superset.daos.semantic_layer import SemanticViewDAO
    from superset.semantic_layers.models import SemanticView

    view = session_with_semantic_view.query(SemanticView).one()

    # Sanity check: the view has an auto-assigned integer id
    assert isinstance(view.id, int)

    result = SemanticViewDAO.find_by_id(view.id)

    assert result is not None, (
        "find_by_id returned None for a valid integer id — "
        "id_column_name is likely set to 'uuid' instead of 'id'"
    )
    assert result.id == view.id
    assert result.name == "test_view"
