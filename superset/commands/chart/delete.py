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
import logging
from collections import defaultdict
from functools import partial
from typing import Optional

from flask_babel import lazy_gettext as _

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.chart.exceptions import (
    ChartDeleteFailedError,
    ChartDeleteFailedReportsExistError,
    ChartForbiddenError,
    ChartNotFoundError,
)
from superset.daos.chart import ChartDAO
from superset.daos.report import ReportScheduleDAO
from superset.exceptions import SupersetSecurityException
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


def build_blocked_by_reports_message(
    charts: list[Slice],
    reports: list[ReportSchedule],
    single_target: bool,
) -> str:
    """Build the user-facing message naming the alerts/reports that block deletion.

    Groups the blocking reports per chart, sorted by chart name (chart id as
    the tie-breaker) and then report name so the message is deterministic
    across database backends, and appends the remedy sentence. When the
    command targets a single chart id the group prefix is dropped — in the
    single-delete endpoint the surrounding toast already names the chart, and
    in a one-chart bulk selection the user's own selection provides the
    context. A multi-id command keeps the prefix on every group because the
    bulk toast is generic, so the prefix is the only chart identification the
    user gets.
    """
    sentences: list[str] = []
    if single_target:
        names = sorted(report.name for report in reports)
        sentences.append(
            str(
                _(
                    "This chart is used by alerts or reports: %(names)s.",
                    names=", ".join(names),
                )
            )
        )
    else:
        report_names_by_chart_id: dict[int, list[str]] = defaultdict(list)
        for report in reports:
            report_names_by_chart_id[report.chart_id].append(report.name)
        charts_by_id = {chart.id: chart for chart in charts}
        for chart_id, names in sorted(
            report_names_by_chart_id.items(),
            key=lambda item: (charts_by_id[item[0]].slice_name or "", item[0]),
        ):
            sentences.append(
                str(
                    _(
                        'Chart "%(chart)s" is used by alerts or reports: %(names)s.',
                        chart=charts_by_id[chart_id].slice_name or str(chart_id),
                        names=", ".join(sorted(names)),
                    )
                )
            )
    sentences.append(str(_("Detach or delete them first.")))
    return " ".join(sentences)


class DeleteChartCommand(BaseCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._models: Optional[list[Slice]] = None

    @transaction(on_error=partial(on_error, reraise=ChartDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._models
        ChartDAO.delete(self._models)

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = ChartDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise ChartNotFoundError()
        # Check there are no associated ReportSchedules
        if reports := ReportScheduleDAO.find_by_chart_ids(self._model_ids):
            raise ChartDeleteFailedReportsExistError(
                build_blocked_by_reports_message(
                    self._models,
                    reports,
                    single_target=len(self._model_ids) == 1,
                )
            )
        # Check editorship
        for model in self._models:
            try:
                security_manager.raise_for_editorship(model)
            except SupersetSecurityException as ex:
                raise ChartForbiddenError() from ex
