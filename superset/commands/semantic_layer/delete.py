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
from superset.subjects.models import chart_editors, dashboard_editors
from superset.subjects.utils import get_user_subject_ids_subquery
from superset.utils import json
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)
_DEPENDENT_LIMIT: int = 20


def _semantic_target_matches(target: object, view_ids: set[int]) -> bool:
    """A missing type denotes a table, even when its integer ID collides."""
    if not isinstance(target, dict) or target.get("datasourceType") != "semantic_view":
        return False
    raw_id: object = target.get("datasetId")
    if isinstance(raw_id, bool) or not (
        isinstance(raw_id, int)
        or (isinstance(raw_id, str) and raw_id.isascii() and raw_id.isdecimal())
    ):
        return False
    try:
        return int(raw_id) in view_ids
    except ValueError:
        return False


def _dashboard_targets_view(
    metadata: str, view_ids: set[int], dashboard_id: int
) -> bool:
    """Match typed semantic targets in native filters or display controls."""
    try:
        decoded: object = json.loads(metadata)
    except (TypeError, ValueError, RecursionError):
        logger.debug("Skipping malformed targets on dashboard %s", dashboard_id)
        return False
    if not isinstance(decoded, dict):
        logger.debug("Skipping non-object targets on dashboard %s", dashboard_id)
        return False
    for key in ("native_filter_configuration", "chart_customization_config"):
        controls: object = decoded.get(key)
        if not isinstance(controls, list):
            continue
        for control in controls:
            if not isinstance(control, dict):
                continue
            targets: object = control.get("targets")
            if isinstance(targets, list) and any(
                _semantic_target_matches(target, view_ids) for target in targets
            ):
                return True
    return False


def _dashboard_target_ids(view_ids: sa.Select) -> set[int]:
    """Find dashboards with semantic targets after a coarse SQL prefilter."""
    selected_ids: set[int] = set(db.session.execute(view_ids).scalars())
    if not selected_ids:
        return set()
    # Core columns bypass the ORM do_orm_execute soft-delete filter so archived
    # dashboards remain deletion blockers, including metadata-only targets.
    candidates: sa.Select = sa.select(
        Dashboard.__table__.c.id, Dashboard.__table__.c.json_metadata
    ).where(
        Dashboard.__table__.c.json_metadata.like("%semantic_view%"),
    )
    matched_ids: set[int] = set()
    for dashboard_id, metadata in db.session.execute(
        candidates.execution_options(yield_per=1000)
    ):
        if _dashboard_targets_view(metadata, selected_ids, dashboard_id):
            matched_ids.add(dashboard_id)
    return matched_ids


def _archived_audience_ids(table: sa.Table, editors: sa.Table, fk: str) -> sa.Select:
    """Archived ids the user could restore from Recently Archived.

    Mirrors ``BaseDeletedStateFilter``: admins see every archived row, others
    only rows they edit. Core tables keep the soft-delete listener out of it.
    """
    # A guest token never restores archived assets, whatever its role.
    if security_manager.is_guest_user():
        return sa.select(table.c.id).where(sa.false())
    if security_manager.is_admin():
        return sa.select(table.c.id)
    user_id: int | None = get_user_id()
    if not user_id:
        return sa.select(table.c.id).where(sa.false())
    return sa.select(editors.c[fk]).where(
        editors.c.subject_id.in_(get_user_subject_ids_subquery(user_id))
    )


def _dependent_assets(
    view_ids: sa.Select,
) -> tuple[int, list[dict[str, str | int]], int, int]:
    """Count dependents, naming only assets visible through their list APIs."""
    # Core table selects bypass the ORM do_orm_execute soft-delete filter:
    # archived charts and dashboards must still block semantic-source deletion.
    chart_ids: sa.Select = sa.select(Slice.__table__.c.id).where(
        Slice.__table__.c.datasource_type == "semantic_view",
        Slice.__table__.c.datasource_id.in_(view_ids),
    )
    chart_dashboard_ids: sa.Select = (
        sa.select(dashboard_slices.c.dashboard_id)
        .join(Slice.__table__, dashboard_slices.c.slice_id == Slice.__table__.c.id)
        .join(
            Dashboard.__table__,
            dashboard_slices.c.dashboard_id == Dashboard.__table__.c.id,
        )
        .where(
            Slice.__table__.c.id.in_(chart_ids),
        )
        .distinct()
    )
    dashboard_target_ids: set[int] = _dashboard_target_ids(view_ids)
    dashboard_ids: sa.Select = sa.select(Dashboard.__table__.c.id).where(
        sa.or_(
            Dashboard.__table__.c.id.in_(chart_dashboard_ids),
            Dashboard.__table__.c.id.in_(dashboard_target_ids),
        ),
    )
    dependents: sa.Subquery = sa.union_all(
        sa.select(
            sa.literal("chart").label("type"),
            Slice.__table__.c.id.label("id"),
            Slice.__table__.c.deleted_at.is_not(None).label("archived"),
            sa.func.coalesce(Slice.__table__.c.slice_name, str(_("Untitled"))).label(
                "name"
            ),
        ).where(Slice.__table__.c.id.in_(chart_ids)),
        sa.select(
            sa.literal("dashboard").label("type"),
            Dashboard.__table__.c.id.label("id"),
            Dashboard.__table__.c.deleted_at.is_not(None).label("archived"),
            sa.func.coalesce(
                Dashboard.__table__.c.dashboard_title, str(_("Untitled"))
            ).label("name"),
        ).where(Dashboard.__table__.c.id.in_(dashboard_ids)),
        sa.select(
            sa.func.lower(ReportSchedule.type).label("type"),
            ReportSchedule.id.label("id"),
            sa.literal(False).label("archived"),
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
            .apply(db.session.query(Slice.id).filter(Slice.deleted_at.is_(None)), None)
            .statement,
        )
        if security_manager.can_access("can_read", "Chart")
        else sa.select(Slice.id).where(sa.false())
    )
    visible_dashboard_ids: sa.Select = (
        cast(
            sa.Select,
            DashboardAccessFilter("id", SQLAInterface(Dashboard, db.session))
            .apply(
                db.session.query(Dashboard.id).filter(Dashboard.deleted_at.is_(None)),
                None,
            )
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
    archived_chart_ids: sa.Select = (
        _archived_audience_ids(Slice.__table__, chart_editors, "chart_id")
        if security_manager.can_access("can_read", "Chart")
        else sa.select(Slice.__table__.c.id).where(sa.false())
    )
    archived_dashboard_ids: sa.Select = (
        _archived_audience_ids(Dashboard.__table__, dashboard_editors, "dashboard_id")
        if security_manager.can_access("can_read", "Dashboard")
        else sa.select(Dashboard.__table__.c.id).where(sa.false())
    )
    visibility: sa.ColumnElement[bool] = sa.or_(
        sa.and_(
            dependents.c.type == "chart",
            sa.or_(
                dependents.c.id.in_(visible_chart_ids),
                dependents.c.archived & dependents.c.id.in_(archived_chart_ids),
            ),
        ),
        sa.and_(
            dependents.c.type == "dashboard",
            sa.or_(
                dependents.c.id.in_(visible_dashboard_ids),
                dependents.c.archived & dependents.c.id.in_(archived_dashboard_ids),
            ),
        ),
        sa.and_(
            dependents.c.type.notin_(("chart", "dashboard")),
            dependents.c.id.in_(visible_schedule_ids),
        ),
    )
    # Both counts come from one statement so READ COMMITTED cannot mix snapshots.
    counts: tuple[int, int | None, int | None] = cast(
        tuple[int, int | None, int | None],
        db.session.execute(
            sa.select(
                sa.func.count(),
                sa.func.sum(sa.case((visibility, 1), else_=0)),
                sa.func.sum(sa.case((dependents.c.archived, 1), else_=0)),
            ).select_from(dependents)
        ).one(),
    )
    total: int = int(counts[0])
    if not total:
        return 0, [], 0, 0
    visible_total: int = int(counts[1] or 0)
    visible: sa.Subquery = sa.select(dependents).where(visibility).subquery()
    rows: list[tuple[str, int, str, bool]] = cast(
        list[tuple[str, int, str, bool]],
        db.session.execute(
            sa.select(visible.c.type, visible.c.id, visible.c.name, visible.c.archived)
            .order_by(
                sa.case(
                    (visible.c.type == "chart", 0),
                    (visible.c.type == "dashboard", 1),
                    else_=2,
                ),
                visible.c.type,
                visible.c.id,
            )
            .limit(_DEPENDENT_LIMIT)
        ).all(),
    )
    return (
        total,
        [
            {"type": asset_type, "id": asset_id, "name": name, "archived": archived}
            for asset_type, asset_id, name, archived in rows
        ],
        total - visible_total,
        int(counts[2] or 0),
    )


def _raise_for_dependents(view_ids: sa.Select) -> None:
    """Best-effort guard; a concurrent chart write can still orphan a view."""
    total: int
    dependents: list[dict[str, str | int]]
    inaccessible_count: int
    archived_count: int
    total, dependents, inaccessible_count, archived_count = _dependent_assets(view_ids)
    if total:
        raise SemanticDeleteDependentsError(
            total, dependents, inaccessible_count, archived_count
        )


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
        try:
            self._model.raise_for_access()
        except SupersetSecurityException as ex:
            raise SemanticViewForbiddenError() from ex

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
            try:
                model.raise_for_access()
            except SupersetSecurityException as ex:
                raise SemanticViewForbiddenError() from ex

            if not current_user_can_modify_object(model):
                raise SemanticViewForbiddenError()
        _raise_for_dependents(
            sa.select(SemanticView.id).where(SemanticView.id.in_(self._model_ids))
        )
