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
"""Command that restores a dashboard to a previous version."""

from __future__ import annotations

import logging

import sqlalchemy as sa
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardNotFoundError,
    DashboardUpdateFailedError,
)
from superset.commands.version_restore import BaseRestoreVersionCommand
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.versioning.restore import ChartPurgedDuringRestoreError, RestoreResult

logger = logging.getLogger(__name__)


class RestoreDashboardVersionCommand(BaseRestoreVersionCommand):
    """Revert a dashboard to a previous version.

    Restores the dashboard's own fields and its chart *membership* — which
    charts sit on it — reattaching only charts that still exist (snapshot
    members deleted since the snapshot stay deleted and are reported as
    skipped). Member charts' content is never modified; restoring a
    chart's content is the chart restore endpoint's job. See
    :class:`superset.commands.version_restore.BaseRestoreVersionCommand`
    for the general contract.
    """

    model_cls = Dashboard
    not_found_exc = DashboardNotFoundError
    forbidden_exc = DashboardForbiddenError
    failed_exc = DashboardUpdateFailedError

    def run(self) -> RestoreResult:
        """Restore, confirming a reported chart-purge race before surfacing it.

        The transaction has rolled back by the time the race reaches here,
        so a fresh read sees the purge's commit. Only when one of the charts
        whose membership the restore was changing is really gone is the
        retryable :class:`ChartPurgedDuringRestoreError` raised. Otherwise,
        or when the confirming read itself fails, the restore fails the
        ordinary way.
        """
        try:
            return super().run()
        except ChartPurgedDuringRestoreError as ex:
            slices: sa.Table = Slice.__table__
            try:
                remaining: set[int] = set(
                    db.session.execute(
                        sa.select(slices.c.id).where(slices.c.id.in_(ex.chart_ids))
                    ).scalars()
                )
            except SQLAlchemyError as read_ex:
                raise self.failed_exc() from read_ex
            if remaining.issuperset(ex.chart_ids):
                raise self.failed_exc() from ex
            logger.info(
                "versioning: dashboard uuid=%s restore lost a race with a purge "
                "of chart(s) %s",
                self._uuid,
                sorted(set(ex.chart_ids) - remaining),
            )
            raise
