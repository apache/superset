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

import logging
from functools import partial
from typing import cast

import sqlalchemy as sa
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import gettext as _
from sqlalchemy.exc import SQLAlchemyError

from superset import db, security_manager
from superset.charts.filters import ChartFilter
from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.exceptions import (
    SemanticDeleteDependentsError,
    SemanticLayerDeleteFailedError,
    SemanticLayerForbiddenError,
    SemanticLayerNotFoundError,
    SemanticViewDeleteFailedError,
    SemanticViewForbiddenError,
    SemanticViewNotFoundError,
)
from superset.commands.utils import current_user_can_modify_object
from superset.daos.semantic_layer import SemanticLayerDAO, SemanticViewDAO
from superset.dashboards.filters import DashboardAccessFilter
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.slice import Slice
from superset.reports.filters import ReportScheduleFilter
from superset.reports.models import ReportSchedule
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)
_DEPENDENT_LIMIT: int = 20


def _dependent_assets(
    view_ids: sa.Select,
) -> tuple[int, list[dict[str, str | int]], int]:
    """Count dependents, naming only assets visible through their list APIs."""
    chart_ids: sa.Select = sa.select(Slice.id).where(
        Slice.datasource_type == "semantic_view",
        Slice.datasource_id.in_(view_ids),
        Slice.deleted_at.is_(None),
    )
    dashboard_ids: sa.Select = (
        sa.select(dashboard_slices.c.dashboard_id)
        .join(Slice, dashboard_slices.c.slice_id == Slice.id)
        .join(Dashboard, dashboard_slices.c.dashboard_id == Dashboard.id)
        .where(
            Slice.id.in_(chart_ids),
            Dashboard.deleted_at.is_(None),
        )
        .distinct()
    )
    dependents: sa.Subquery = sa.union_all(
        sa.select(
            sa.literal("chart").label("type"),
            Slice.id.label("id"),
            sa.func.coalesce(Slice.slice_name, str(_("Untitled"))).label("name"),
        ).where(Slice.id.in_(chart_ids)),
        sa.select(
            sa.literal("dashboard").label("type"),
            Dashboard.id.label("id"),
            sa.func.coalesce(Dashboard.dashboard_title, str(_("Untitled"))).label(
                "name"
            ),
        ).where(Dashboard.id.in_(dashboard_ids)),
        sa.select(
            ReportSchedule.type.label("type"),
            ReportSchedule.id.label("id"),
            ReportSchedule.name.label("name"),
        ).where(
            ReportSchedule.active.is_(True),
            sa.or_(
                ReportSchedule.chart_id.in_(chart_ids),
                ReportSchedule.dashboard_id.in_(dashboard_ids),
            ),
        ),
    ).subquery()
    visible_chart_ids: sa.Select = (
        cast(
            sa.Select,
            ChartFilter("id", SQLAInterface(Slice, db.session))
            .apply(db.session.query(Slice.id), None)
            .statement,
        )
        if security_manager.can_access("can_read", "Chart")
        else sa.select(Slice.id).where(sa.false())
    )
    visible_dashboard_ids: sa.Select = (
        cast(
            sa.Select,
            DashboardAccessFilter("id", SQLAInterface(Dashboard, db.session))
            .apply(db.session.query(Dashboard.id), None)
            .statement,
        )
        if security_manager.can_access("can_read", "Dashboard")
        else sa.select(Dashboard.id).where(sa.false())
    )
    visible_schedule_ids: sa.Select = (
        cast(
            sa.Select,
            ReportScheduleFilter("id", SQLAInterface(ReportSchedule, db.session))
            .apply(db.session.query(ReportSchedule.id), None)
            .statement,
        )
        if security_manager.can_access("can_read", "ReportSchedule")
        else sa.select(ReportSchedule.id).where(sa.false())
    )
    visibility: sa.ColumnElement[bool] = sa.or_(
        sa.and_(
            dependents.c.type == "chart",
            dependents.c.id.in_(visible_chart_ids),
        ),
        sa.and_(
            dependents.c.type == "dashboard",
            dependents.c.id.in_(visible_dashboard_ids),
        ),
        sa.and_(
            dependents.c.type.notin_(("chart", "dashboard")),
            dependents.c.id.in_(visible_schedule_ids),
        ),
    )
    # Both counts come from one statement so READ COMMITTED cannot mix snapshots.
    counts: tuple[int, int | None] = cast(
        tuple[int, int | None],
        db.session.execute(
            sa.select(
                sa.func.count(),
                sa.func.sum(sa.case((visibility, 1), else_=0)),
            ).select_from(dependents)
        ).one(),
    )
    total: int = int(counts[0])
    if not total:
        return 0, [], 0
    visible_total: int = int(counts[1] or 0)
    visible: sa.Subquery = sa.select(dependents).where(visibility).subquery()
    rows: list[tuple[str, int, str]] = cast(
        list[tuple[str, int, str]],
        db.session.execute(
            sa.select(visible.c.type, visible.c.id, visible.c.name)
            .order_by(visible.c.type, visible.c.id)
            .limit(_DEPENDENT_LIMIT)
        ).all(),
    )
    return (
        total,
        [
            {"type": asset_type, "id": asset_id, "name": name}
            for asset_type, asset_id, name in rows
        ],
        total - visible_total,
    )


def _raise_for_dependents(view_ids: sa.Select) -> None:
    """Best-effort guard; a concurrent chart write can still orphan a view."""
    total: int
    dependents: list[dict[str, str | int]]
    inaccessible_count: int
    total, dependents, inaccessible_count = _dependent_assets(view_ids)
    if total:
        raise SemanticDeleteDependentsError(total, dependents, inaccessible_count)


class DeleteSemanticLayerCommand(BaseCommand):
    def __init__(self, uuid: str):
        self._uuid = uuid
        self._model: SemanticLayer | None = None

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError,),
            reraise=SemanticLayerDeleteFailedError,
        )
    )
    def run(self) -> None:
        self.validate()
        assert self._model
        SemanticLayerDAO.delete([self._model])

    def validate(self) -> None:
        self._model = SemanticLayerDAO.find_by_uuid(self._uuid)
        if not self._model:
            raise SemanticLayerNotFoundError()
        try:
            self._model.raise_for_access()
        except SupersetSecurityException as ex:
            raise SemanticLayerForbiddenError() from ex

        if not current_user_can_modify_object(self._model):
            raise SemanticLayerForbiddenError()
        _raise_for_dependents(
            sa.select(SemanticView.id).where(
                SemanticView.semantic_layer_uuid == self._model.uuid
            )
        )


class DeleteSemanticViewCommand(BaseCommand):
    def __init__(self, pk: int):
        self._pk = pk
        self._model: SemanticView | None = None

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError,),
            reraise=SemanticViewDeleteFailedError,
        )
    )
    def run(self) -> None:
        self.validate()
        assert self._model
        SemanticViewDAO.delete([self._model])

    def validate(self) -> None:
        self._model = SemanticViewDAO.find_by_id(self._pk, id_column="id")
        if not self._model:
            raise SemanticViewNotFoundError()
        if not current_user_can_modify_object(self._model):
            raise SemanticViewForbiddenError()
        _raise_for_dependents(
            sa.select(SemanticView.id).where(SemanticView.id == self._model.id)
        )


class BulkDeleteSemanticViewCommand(BaseCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._models: list[SemanticView] = []

    @transaction(
        on_error=partial(
            on_error,
            catches=(SQLAlchemyError,),
            reraise=SemanticViewDeleteFailedError,
        )
    )
    def run(self) -> None:
        self.validate()
        SemanticViewDAO.delete(self._models)

    def validate(self) -> None:
        self._models = SemanticViewDAO.find_by_ids(self._model_ids, id_column="id")
        if len(self._models) != len(self._model_ids):
            raise SemanticViewNotFoundError()
        for model in self._models:
            if not current_user_can_modify_object(model):
                raise SemanticViewForbiddenError()
        _raise_for_dependents(
            sa.select(SemanticView.id).where(SemanticView.id.in_(self._model_ids))
        )
