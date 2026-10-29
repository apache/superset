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
from pytest_mock import MockerFixture
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


@pytest.fixture
def session_with_accessible_views(session: Session) -> Iterator[Session]:
    """Create two layers, each with a view, to test permission filtering.

    Perm strings are computed by the ``after_insert`` hooks on
    ``SemanticLayer``/``SemanticView`` (see ``superset/security/manager.py``),
    so any perm values passed in here are overwritten on flush; tests read
    the real values back off the persisted rows instead of guessing them.
    """
    from superset.semantic_layers.models import SemanticLayer, SemanticView

    engine = session.get_bind()
    SemanticView.metadata.create_all(engine)  # pylint: disable=no-member

    layer_a = SemanticLayer(
        uuid=uuid.uuid4(),
        name="layer_a",
        type="test",
        configuration="{}",
    )
    layer_b = SemanticLayer(
        uuid=uuid.uuid4(),
        name="layer_b",
        type="test",
        configuration="{}",
    )
    session.add_all([layer_a, layer_b])
    session.flush()

    view_a = SemanticView(
        id=1,
        uuid=uuid.uuid4(),
        name="view_a",
        semantic_layer_uuid=layer_a.uuid,
        configuration="{}",
    )
    view_b = SemanticView(
        id=2,
        uuid=uuid.uuid4(),
        name="view_b",
        semantic_layer_uuid=layer_b.uuid,
        configuration="{}",
    )
    session.add_all([view_a, view_b])
    session.flush()

    return session


def test_find_accessible_returns_all_when_user_can_access_all(
    session_with_accessible_views: Session,
    mocker: MockerFixture,
) -> None:
    """When the user can access all datasources, no filtering is applied."""
    from superset.daos.semantic_layer import SemanticViewDAO

    mocker.patch(
        "superset.daos.semantic_layer.security_manager.can_access_all_datasources",
        return_value=True,
    )

    results = SemanticViewDAO.find_accessible()

    assert {v.name for v in results} == {"view_a", "view_b"}


def test_find_accessible_filters_by_view_level_perm(
    session_with_accessible_views: Session,
    mocker: MockerFixture,
) -> None:
    """A view is accessible if its own perm is granted."""
    from superset.daos.semantic_layer import SemanticViewDAO
    from superset.semantic_layers.models import SemanticView

    view_a = (
        session_with_accessible_views.query(SemanticView).filter_by(name="view_a").one()
    )

    mocker.patch(
        "superset.daos.semantic_layer.security_manager.can_access_all_datasources",
        return_value=False,
    )
    mocker.patch(
        "superset.daos.semantic_layer.security_manager.user_view_menu_names",
        return_value={view_a.perm},
    )

    results = SemanticViewDAO.find_accessible()

    assert {v.name for v in results} == {"view_a"}


def test_find_accessible_filters_by_layer_level_perm(
    session_with_accessible_views: Session,
    mocker: MockerFixture,
) -> None:
    """A view is accessible via its parent layer's perm, even when the
    view's own perm is not granted.

    Regression test: find_accessible uses an inner join between SemanticView
    and SemanticLayer. Since semantic_layer_uuid is non-nullable, every view
    has a matching layer row, so the join must not drop layer-only-permission
    matches.
    """
    from superset.daos.semantic_layer import SemanticViewDAO
    from superset.semantic_layers.models import SemanticLayer

    layer_b = (
        session_with_accessible_views.query(SemanticLayer)
        .filter_by(name="layer_b")
        .one()
    )

    mocker.patch(
        "superset.daos.semantic_layer.security_manager.can_access_all_datasources",
        return_value=False,
    )
    mocker.patch(
        "superset.daos.semantic_layer.security_manager.user_view_menu_names",
        return_value={layer_b.perm},
    )

    results = SemanticViewDAO.find_accessible()

    assert {v.name for v in results} == {"view_b"}


def test_find_accessible_returns_empty_when_no_perms_granted(
    session_with_accessible_views: Session,
    mocker: MockerFixture,
) -> None:
    """No views are returned when the user has no matching perms."""
    from superset.daos.semantic_layer import SemanticViewDAO

    mocker.patch(
        "superset.daos.semantic_layer.security_manager.can_access_all_datasources",
        return_value=False,
    )
    mocker.patch(
        "superset.daos.semantic_layer.security_manager.user_view_menu_names",
        return_value=set(),
    )

    results = SemanticViewDAO.find_accessible()

    assert results == []


def test_find_accessible_eager_loads_semantic_layer_unfiltered(
    session_with_accessible_views: Session,
    mocker: MockerFixture,
) -> None:
    """When unfiltered (can_access_all_datasources), semantic_layer is still
    eager-loaded, since callers commonly call view.raise_for_access() per row,
    which reads view.semantic_layer.perm and would otherwise trigger an N+1.
    """
    from sqlalchemy import inspect

    from superset.daos.semantic_layer import SemanticViewDAO

    mocker.patch(
        "superset.daos.semantic_layer.security_manager.can_access_all_datasources",
        return_value=True,
    )

    results = SemanticViewDAO.find_accessible()

    assert results
    assert all("semantic_layer" not in inspect(v).unloaded for v in results)


def test_find_accessible_eager_loads_semantic_layer_filtered(
    session_with_accessible_views: Session,
    mocker: MockerFixture,
) -> None:
    """When permission-filtered, the join is reused via contains_eager instead
    of triggering a separate lazy-load per row for semantic_layer.
    """
    from sqlalchemy import inspect

    from superset.daos.semantic_layer import SemanticViewDAO
    from superset.semantic_layers.models import SemanticLayer

    layer_a = (
        session_with_accessible_views.query(SemanticLayer)
        .filter_by(name="layer_a")
        .one()
    )

    mocker.patch(
        "superset.daos.semantic_layer.security_manager.can_access_all_datasources",
        return_value=False,
    )
    mocker.patch(
        "superset.daos.semantic_layer.security_manager.user_view_menu_names",
        return_value={layer_a.perm},
    )

    results = SemanticViewDAO.find_accessible()

    assert results
    assert all("semantic_layer" not in inspect(v).unloaded for v in results)
