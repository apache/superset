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
"""Authoritative dependency snapshots for archived dataset purges."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

import sqlalchemy as sa
from sqlalchemy.orm import Session

from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.helpers import skip_visibility_filter
from superset.models.slice import Slice


@dataclass(frozen=True)
class DatasetImpactObject:
    """Scalar identity and display data for one dependent object."""

    id: int
    uuid: str
    name: str | None
    archived: bool


@dataclass(frozen=True)
class DatasetPurgeImpact:
    """Complete dependent identities at one point in time."""

    impact_token: str
    charts: tuple[DatasetImpactObject, ...]
    dashboards: tuple[DatasetImpactObject, ...]


class PurgeImpactChangedError(Exception):
    """Raised when a dataset's dependencies differ from those confirmed."""

    def __init__(self, impact: DatasetPurgeImpact) -> None:
        super().__init__("Dataset dependencies changed; review them before deleting")
        self.impact: DatasetPurgeImpact = impact


def _impact_token(
    charts: tuple[DatasetImpactObject, ...],
    dashboards: tuple[DatasetImpactObject, ...],
) -> str:
    """Return a deterministic, versioned fingerprint of dependent identities."""
    canonical: str = "\n".join(
        sorted(f"chart:{chart.uuid}" for chart in charts)
        + sorted(f"dashboard:{dashboard.uuid}" for dashboard in dashboards)
    )
    digest: str = hashlib.sha256(canonical.encode()).hexdigest()
    return f"v1:{digest}"


def collect_dataset_purge_impact(
    session: Session, dataset_id: int
) -> DatasetPurgeImpact:
    """Collect live and archived charts and distinct dashboards for a dataset."""
    with skip_visibility_filter(session, Slice, Dashboard):
        chart_rows: list[tuple[int, object, str | None, object | None]] = list(
            session.execute(
                sa.select(Slice.id, Slice.uuid, Slice.slice_name, Slice.deleted_at)
                .where(Slice.datasource_type == "table")
                .where(Slice.datasource_id == dataset_id)
                .order_by(Slice.uuid)
            ).tuples()
        )
        dashboard_rows: list[tuple[int, object, str | None, object | None]] = list(
            session.execute(
                sa.select(
                    Dashboard.id,
                    Dashboard.uuid,
                    Dashboard.dashboard_title,
                    Dashboard.deleted_at,
                )
                .join(
                    dashboard_slices,
                    dashboard_slices.c.dashboard_id == Dashboard.id,
                )
                .join(Slice, Slice.id == dashboard_slices.c.slice_id)
                .where(Slice.datasource_type == "table")
                .where(Slice.datasource_id == dataset_id)
                .distinct()
                .order_by(Dashboard.uuid)
            ).tuples()
        )

    charts: tuple[DatasetImpactObject, ...] = tuple(
        DatasetImpactObject(
            id=chart_id,
            uuid=str(chart_uuid),
            name=chart_name,
            archived=deleted_at is not None,
        )
        for chart_id, chart_uuid, chart_name, deleted_at in chart_rows
    )
    dashboard_by_uuid: dict[str, DatasetImpactObject] = {
        str(dashboard_uuid): DatasetImpactObject(
            id=dashboard_id,
            uuid=str(dashboard_uuid),
            name=dashboard_name,
            archived=deleted_at is not None,
        )
        for dashboard_id, dashboard_uuid, dashboard_name, deleted_at in dashboard_rows
    }
    dashboards: tuple[DatasetImpactObject, ...] = tuple(dashboard_by_uuid.values())
    return DatasetPurgeImpact(
        impact_token=_impact_token(charts, dashboards),
        charts=charts,
        dashboards=dashboards,
    )
