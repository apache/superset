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
"""Command that restores a chart to a previous version."""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartNotFoundError,
    ChartUpdateFailedError,
)
from superset.daos.version import VersionDAO
from superset.exceptions import SupersetSecurityException
from superset.models.slice import Slice
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class RestoreChartVersionCommand(BaseCommand):
    """Revert a chart to a previous version.

    The restore is non-destructive: it produces a new version row (authored by
    the restoring user), so prior versions remain in the history and the
    change is itself reversible. ``@transaction`` wraps :meth:`run` so the
    commit that fires Continuum's ``after_flush`` hook — the one that writes
    the new version row — is bound to this command's lifecycle.
    """

    def __init__(self, chart_uuid: UUID, version_uuid: UUID) -> None:
        self._uuid = chart_uuid
        self._version_uuid = version_uuid
        self._chart: Slice | None = None

    @transaction(on_error=partial(on_error, reraise=ChartUpdateFailedError))
    def run(self) -> Slice:
        self.validate()
        version_number = VersionDAO.resolve_version_uuid(
            Slice, self._uuid, self._version_uuid
        )
        if version_number is None:
            raise ChartNotFoundError()
        chart = VersionDAO.restore_version(Slice, self._uuid, version_number)
        if chart is None:
            # Race: entity deleted between validate() and now.
            raise ChartNotFoundError()
        return chart

    def validate(self) -> None:
        chart = VersionDAO._find_active_entity_by_uuid(  # pylint: disable=protected-access
            Slice, self._uuid
        )
        if chart is None:
            raise ChartNotFoundError()
        try:
            security_manager.raise_for_ownership(chart)
        except SupersetSecurityException as ex:
            raise ChartForbiddenError() from ex
        self._chart = chart
