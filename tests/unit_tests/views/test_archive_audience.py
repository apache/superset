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
"""Archive audience parity across charts, dashboards and datasets."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import patch

import pytest
from flask import g
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy.orm import Session

from superset.charts.filters import ChartDeletedStateFilter
from superset.connectors.sqla.models import Database, SqlaTable
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.dashboards.filters import DashboardDeletedStateFilter
from superset.datasets.filters import DatasetDeletedStateFilter
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.views.filters import scope_query_to_restore_audience
from tests.unit_tests.conftest import with_feature_flags


@pytest.fixture
def archive_rows(
    session: Session,
) -> dict[str, tuple[Any, Any, set[int], set[int], int]]:
    """Create one live row and two archived rows, only one edited by user 2."""
    Dashboard.metadata.create_all(session.get_bind())
    editor = Subject(label="editor", type=SubjectType.USER, user_id=2)
    database = Database(database_name="archive-audience", sqlalchemy_uri="sqlite://")
    session.add_all([editor, database])
    session.flush()
    models: dict[str, tuple[Any, Any, dict[str, Any]]] = {
        "chart": (Slice, ChartDeletedStateFilter, {"slice_name": "chart"}),
        "dashboard": (
            Dashboard,
            DashboardDeletedStateFilter,
            {"dashboard_title": "dashboard"},
        ),
        "dataset": (
            SqlaTable,
            DatasetDeletedStateFilter,
            {"table_name": "dataset", "database_id": database.id},
        ),
    }
    rows = {}
    for kind, (model, filter_type, kwargs) in models.items():
        live = model(**kwargs)
        owned = model(**kwargs, deleted_at=datetime(2026, 1, 1), editors=[editor])
        other = model(**kwargs, deleted_at=datetime(2026, 1, 1))
        if kind == "dataset":
            owned.table_name = "owned"
            other.table_name = "other"
        session.add_all([live, owned, other])
        session.flush()
        rows[kind] = (model, filter_type, {live.id}, {owned.id, other.id}, owned.id)
    session.expunge_all()
    return rows


@pytest.mark.parametrize("kind", ["chart", "dashboard", "dataset"])
@pytest.mark.parametrize("mode", ["include", "only"])
@pytest.mark.parametrize("principal", ["admin", "editor", "non-editor", "no-user"])
@with_feature_flags(SOFT_DELETE=True)
def test_deleted_state_audience_parity(
    session: Session,
    archive_rows: dict[str, Any],
    kind: str,
    mode: str,
    principal: str,
) -> None:
    """Extracting the predicate preserves each entity's include/only audience."""
    model, filter_type, live_ids, archived_ids, owned_id = archive_rows[kind]
    user_id = {"admin": 1, "editor": 2, "non-editor": 3, "no-user": None}[principal]
    with (
        patch(
            "superset.views.filters.security_manager.is_admin",
            return_value=principal == "admin",
        ),
        patch("superset.views.filters.get_user_id", return_value=user_id),
    ):
        query = filter_type("id", SQLAInterface(model)).apply(
            session.query(model.id), mode
        )
        actual = {row_id for (row_id,) in query.all()}
    expected = set(live_ids) if mode == "include" else set()
    if principal == "admin":
        expected |= archived_ids
    elif principal == "editor":
        expected.add(owned_id)
    assert actual == expected
    session.info.get(SKIP_VISIBILITY_FILTER_CLASSES, set()).discard(model)
    g.pop("_deleted_state_added_classes", None)
    g.pop("_augment_response_with_deleted_at", None)


@pytest.mark.parametrize("kind", ["chart", "dashboard", "dataset"])
@with_feature_flags(SOFT_DELETE=True)
def test_only_audience_helper_excludes_live_rows_for_admin(
    session: Session, archive_rows: dict[str, Any], kind: str
) -> None:
    """The public only helper supplies its own archive predicate and no state."""
    model, _, _, archived_ids, _ = archive_rows[kind]
    before = dict(session.info)
    query = session.query(model.id).execution_options(
        **{SKIP_VISIBILITY_FILTER_CLASSES: {model}}
    )
    with patch("superset.views.filters.security_manager.is_admin", return_value=True):
        result = scope_query_to_restore_audience(query, model, "only").all()
    assert {row_id for (row_id,) in result} == archived_ids
    assert session.info == before
    assert not getattr(g, "_deleted_state_added_classes", set())
    assert not getattr(g, "_augment_response_with_deleted_at", False)
