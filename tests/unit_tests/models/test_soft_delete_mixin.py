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
"""Tests for SoftDeleteMixin and the do_orm_execute visibility filter."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm.session import Session

from superset.models.helpers import (
    SKIP_VISIBILITY_FILTER,
)


def test_soft_delete_sets_deleted_at(app_context: None, session: Session) -> None:
    """soft_delete() should set deleted_at to a non-null datetime."""
    from superset.models.slice import Slice

    Slice.metadata.create_all(session.get_bind())

    chart = Slice(
        slice_name="test_chart",
        viz_type="table",
        datasource_type="table",
        datasource_id=0,
    )
    session.add(chart)
    session.flush()

    assert chart.deleted_at is None
    assert not chart.is_deleted

    chart.soft_delete()
    session.flush()

    assert chart.deleted_at is not None
    assert isinstance(chart.deleted_at, datetime)
    assert chart.is_deleted


def test_restore_clears_deleted_at(app_context: None, session: Session) -> None:
    """restore() should clear deleted_at back to None."""
    from superset.models.slice import Slice

    Slice.metadata.create_all(session.get_bind())

    chart = Slice(
        slice_name="test_chart",
        viz_type="table",
        datasource_type="table",
        datasource_id=0,
    )
    session.add(chart)
    session.flush()

    chart.soft_delete()
    session.flush()
    assert chart.is_deleted

    chart.restore()
    session.flush()
    assert chart.deleted_at is None
    assert not chart.is_deleted


def test_not_deleted_filter_clause(app_context: None, session: Session) -> None:
    """not_deleted() should return a filter clause usable in queries."""
    from superset.models.slice import Slice

    Slice.metadata.create_all(session.get_bind())

    active = Slice(
        slice_name="active_chart",
        viz_type="table",
        datasource_type="table",
        datasource_id=0,
    )
    deleted = Slice(
        slice_name="deleted_chart",
        viz_type="table",
        datasource_type="table",
        datasource_id=0,
    )
    session.add_all([active, deleted])
    session.flush()

    deleted.soft_delete()
    session.flush()

    results = (
        session.query(Slice)
        .filter(Slice.not_deleted())
        .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        .all()
    )

    assert len(results) == 1
    assert results[0].slice_name == "active_chart"


def test_skip_visibility_filter_returns_soft_deleted_rows(
    app_context: None, session: Session
) -> None:
    """The skip_visibility_filter execution option should make soft-deleted
    rows visible (needed by restore commands)."""
    from superset.models.slice import Slice

    Slice.metadata.create_all(session.get_bind())

    chart = Slice(
        slice_name="soon_deleted",
        viz_type="table",
        datasource_type="table",
        datasource_id=0,
    )
    session.add(chart)
    session.flush()
    chart_id = chart.id

    chart.soft_delete()
    session.flush()
    session.expire_all()

    # Without the flag: invisible (the global filter excludes it)
    normal_result = session.query(Slice).filter(Slice.id == chart_id).one_or_none()
    assert normal_result is None

    # With the flag: visible
    visible_result = (
        session.query(Slice)
        .execution_options(**{SKIP_VISIBILITY_FILTER: True})
        .filter(Slice.id == chart_id)
        .one_or_none()
    )
    assert visible_result is not None
    assert visible_result.slice_name == "soon_deleted"
