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
# isort:skip_file

import json
import logging
from typing import Iterator, List, Tuple

import yaml

from superset.commands.base import BaseCommand
from superset.charts.commands.export import ExportChartsCommand
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.dao import DashboardDAO
from superset.models.dashboard import Dashboard
from superset.utils.dict_import_export import IMPORT_EXPORT_VERSION, sanitize

logger = logging.getLogger(__name__)


# keys stored as JSON are loaded and the prefix/suffix removed
JSON_KEYS = {"position_json": "position", "json_metadata": "metadata"}


class ExportDashboardsCommand(BaseCommand):
    def __init__(self, dashboard_ids: List[int]):
        self.dashboard_ids = dashboard_ids

        # this will be set when calling validate()
        self._models: List[Dashboard] = []

    @staticmethod
    def export_dashboard(dashboard: Dashboard) -> Iterator[Tuple[str, str]]:
        dashboard_slug = sanitize(dashboard.dashboard_title)
        file_name = f"dashboards/{dashboard_slug}.yaml"

        payload = dashboard.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        # becomes the default export endpoint
        for key, new_name in JSON_KEYS.items():
            if payload.get(key):
                value = payload.pop(key)
                try:
                    payload[new_name] = json.loads(value)
                except json.decoder.JSONDecodeError:
                    logger.info("Unable to decode `%s` field: %s", key, value)

        payload["version"] = IMPORT_EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content

        chart_ids = [chart.id for chart in dashboard.slices]
        yield from ExportChartsCommand(chart_ids).run()

    def run(self) -> Iterator[Tuple[str, str]]:
        self.validate()

        for dashboard in self._models:
            yield from self.export_dashboard(dashboard)

    def validate(self) -> None:
        self._models = DashboardDAO.find_by_ids(self.dashboard_ids)
        if len(self._models) != len(self.dashboard_ids):
            raise DashboardNotFoundError()
