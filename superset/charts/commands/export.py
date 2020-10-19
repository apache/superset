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
from typing import Iterator, List, Tuple

import yaml

from superset.commands.base import BaseCommand
from superset.charts.commands.exceptions import ChartNotFoundError
from superset.charts.dao import ChartDAO
from superset.datasets.commands.export import ExportDatasetsCommand
from superset.utils.dict_import_export import IMPORT_EXPORT_VERSION, sanitize
from superset.models.slice import Slice


# keys present in the standard export that are not needed
REMOVE_KEYS = ["datasource_type", "datasource_name"]


class ExportChartsCommand(BaseCommand):
    def __init__(self, chart_ids: List[int]):
        self.chart_ids = chart_ids

        # this will be set when calling validate()
        self._models: List[Slice] = []

    @staticmethod
    def export_chart(chart: Slice) -> Iterator[Tuple[str, str]]:
        chart_slug = sanitize(chart.slice_name)
        file_name = f"charts/{chart_slug}.yaml"

        payload = chart.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        # becomes the default export endpoint
        for key in REMOVE_KEYS:
            del payload[key]
        if "params" in payload:
            try:
                payload["params"] = json.loads(payload["params"])
            except json.decoder.JSONDecodeError:
                pass

        payload["version"] = IMPORT_EXPORT_VERSION
        if chart.table:
            payload["dataset_uuid"] = str(chart.table.uuid)

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content

        if chart.table:
            yield from ExportDatasetsCommand([chart.table.id]).run()

    def run(self) -> Iterator[Tuple[str, str]]:
        self.validate()

        for chart in self._models:
            yield from self.export_chart(chart)

    def validate(self) -> None:
        self._models = ChartDAO.find_by_ids(self.chart_ids)
        if len(self._models) != len(self.chart_ids):
            raise ChartNotFoundError()
