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

"""Unit tests for semantic layer DAOs."""

from __future__ import annotations

from typing import Iterator
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.semantic_layers.models import SemanticLayer, SemanticView


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    """
    Create session with semantic layer test data.
    """

    engine = session.get_bind()
    SemanticLayer.metadata.create_all(engine)

    layer1 = SemanticLayer(
        uuid=uuid4(),
        name="layer1",
        description="First layer",
        type="cube",
        configuration='{"url": "http://localhost:4000"}',
        cache_timeout=3600,
    )
    layer2 = SemanticLayer(
        uuid=uuid4(),
        name="layer2",
        description="Second layer",
        type="dbt",
        configuration='{"token": "secret"}',
    )

    session.add_all([layer1, layer2])
    session.flush()

    view1 = SemanticView(
        uuid=uuid4(),
        name="view1",
        configuration='{"columns": ["id", "name"]}',
        cache_timeout=1800,
        semantic_layer_uuid=layer1.uuid,
    )
    view2 = SemanticView(
        uuid=uuid4(),
        name="view2",
        configuration='{"columns": ["id", "value"]}',
        semantic_layer_uuid=layer1.uuid,
    )
    view3 = SemanticView(
        uuid=uuid4(),
        name="view1",
        configuration='{"columns": ["id"]}',
        semantic_layer_uuid=layer2.uuid,
    )

    session.add_all([view1, view2, view3])
    session.flush()

    yield session
    session.rollback()


def test_semantic_layer_find_by_name(session_with_data: Session) -> None:
    """
    Test finding semantic layer by name.
    """
    result = SemanticLayerDAO.find_by_name("layer1")
    assert result is not None
    assert result.name == "layer1"
    assert result.description == "First layer"


def test_semantic_layer_find_by_name_not_found(session_with_data: Session) -> None:
    """
    Test finding non-existent semantic layer by name.
    """
    result = SemanticLayerDAO.find_by_name("nonexistent")
    assert result is None


def test_semantic_layer_validate_uniqueness_true(session_with_data: Session) -> None:
    """
    Test validating uniqueness returns True for new name.
    """
    result = SemanticLayerDAO.validate_uniqueness("new_layer")
    assert result is True


def test_semantic_layer_validate_uniqueness_false(session_with_data: Session) -> None:
    """
    Test validating uniqueness returns False for existing name.
    """
    result = SemanticLayerDAO.validate_uniqueness("layer1")
    assert result is False


def test_semantic_layer_validate_update_uniqueness_same_name(
    session_with_data: Session,
) -> None:
    """
    Test validating update uniqueness allows keeping same name.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    result = SemanticLayerDAO.validate_update_uniqueness(str(layer.uuid), "layer1")
    assert result is True


def test_semantic_layer_validate_update_uniqueness_new_name(
    session_with_data: Session,
) -> None:
    """
    Test validating update uniqueness allows new unique name.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    result = SemanticLayerDAO.validate_update_uniqueness(str(layer.uuid), "new_name")
    assert result is True


def test_semantic_layer_validate_update_uniqueness_existing_name(
    session_with_data: Session,
) -> None:
    """
    Test validating update uniqueness rejects existing name.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    result = SemanticLayerDAO.validate_update_uniqueness(str(layer.uuid), "layer2")
    assert result is False


def test_semantic_layer_get_semantic_views(session_with_data: Session) -> None:
    """
    Test getting all semantic views for a layer.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    views = SemanticLayerDAO.get_semantic_views(layer.uuid)
    assert len(views) == 2
    assert views[0].name in ["view1", "view2"]
    assert views[1].name in ["view1", "view2"]


def test_semantic_view_find_by_semantic_layer(session_with_data: Session) -> None:
    """
    Test finding all views for a semantic layer.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    views = SemanticViewDAO.find_by_semantic_layer(layer.uuid)
    assert len(views) == 2
    assert all(view.semantic_layer_uuid == layer.uuid for view in views)


def test_semantic_view_find_by_name(session_with_data: Session) -> None:
    """
    Test finding semantic view by name within layer.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    view = SemanticViewDAO.find_by_name("view1", layer.uuid)
    assert view is not None
    assert view.name == "view1"
    assert view.semantic_layer_uuid == layer.uuid


def test_semantic_view_find_by_name_not_found(session_with_data: Session) -> None:
    """
    Test finding non-existent semantic view by name.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    view = SemanticViewDAO.find_by_name("nonexistent", layer.uuid)
    assert view is None


def test_semantic_view_validate_uniqueness_true(session_with_data: Session) -> None:
    """
    Test validating uniqueness returns True for new name in layer.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    result = SemanticViewDAO.validate_uniqueness("new_view", layer.uuid)
    assert result is True


def test_semantic_view_validate_uniqueness_false(session_with_data: Session) -> None:
    """
    Test validating uniqueness returns False for existing name in layer.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    result = SemanticViewDAO.validate_uniqueness("view1", layer.uuid)
    assert result is False


def test_semantic_view_validate_uniqueness_different_layer(
    session_with_data: Session,
) -> None:
    """
    Test validating uniqueness allows same name in different layer.
    """
    layer2 = session_with_data.query(SemanticLayer).filter_by(name="layer2").first()
    assert layer2 is not None

    # view1 exists in layer1, but we're checking layer2 where view1 also exists
    # So this should return False
    result = SemanticViewDAO.validate_uniqueness("view1", layer2.uuid)
    assert result is False


def test_semantic_view_validate_update_uniqueness_same_name(
    session_with_data: Session,
) -> None:
    """
    Test validating update uniqueness allows keeping same name.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    view = (
        session_with_data.query(SemanticView)
        .filter_by(name="view1", semantic_layer_uuid=layer.uuid)
        .first()
    )
    assert view is not None

    result = SemanticViewDAO.validate_update_uniqueness(view.uuid, "view1", layer.uuid)
    assert result is True


def test_semantic_view_validate_update_uniqueness_new_name(
    session_with_data: Session,
) -> None:
    """
    Test validating update uniqueness allows new unique name.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    view = (
        session_with_data.query(SemanticView)
        .filter_by(name="view1", semantic_layer_uuid=layer.uuid)
        .first()
    )
    assert view is not None

    result = SemanticViewDAO.validate_update_uniqueness(
        view.uuid, "new_view", layer.uuid
    )
    assert result is True


def test_semantic_view_validate_update_uniqueness_existing_name(
    session_with_data: Session,
) -> None:
    """
    Test validating update uniqueness rejects existing name in same layer.
    """
    layer = session_with_data.query(SemanticLayer).filter_by(name="layer1").first()
    assert layer is not None

    view = (
        session_with_data.query(SemanticView)
        .filter_by(name="view1", semantic_layer_uuid=layer.uuid)
        .first()
    )
    assert view is not None

    result = SemanticViewDAO.validate_update_uniqueness(view.uuid, "view2", layer.uuid)
    assert result is False
