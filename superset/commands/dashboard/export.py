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

import logging
import random
import string
from typing import Any, Optional, Callable
from collections.abc import Iterator

import yaml

from superset.commands.chart.export import ExportChartsCommand
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dashboard.importers.v1.utils import find_chart_uuids
from superset.daos.dashboard import DashboardDAO
from superset.commands.export.models import ExportModelsCommand
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.daos.dataset import DatasetDAO
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename
from superset.utils import json

logger = logging.getLogger(__name__)


# keys stored as JSON are loaded and the prefix/suffix removed
JSON_KEYS = {"position_json": "position", "json_metadata": "metadata"}
DEFAULT_CHART_HEIGHT = 50
DEFAULT_CHART_WIDTH = 4


def suffix(length: int = 8) -> str:
    return "".join(
        random.SystemRandom().choice(string.ascii_uppercase + string.digits)
        for _ in range(length)
    )


def get_default_position(title: str) -> dict[str, Any]:
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": [],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {"id": "HEADER_ID", "meta": {"text": title}, "type": "HEADER"},
    }


def append_charts(position: dict[str, Any], charts: set[Slice]) -> dict[str, Any]:
    chart_hashes = [f"CHART-{suffix()}" for _ in charts]

    # if we have ROOT_ID/GRID_ID, append orphan charts to a new row inside the grid
    row_hash = None
    if "ROOT_ID" in position and "GRID_ID" in position["ROOT_ID"]["children"]:
        row_hash = f"ROW-N-{suffix()}"
        position["GRID_ID"]["children"].append(row_hash)
        position[row_hash] = {
            "children": chart_hashes,
            "id": row_hash,
            "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
            "type": "ROW",
            "parents": ["ROOT_ID", "GRID_ID"],
        }

    for chart_hash, chart in zip(chart_hashes, charts):
        position[chart_hash] = {
            "children": [],
            "id": chart_hash,
            "meta": {
                "chartId": chart.id,
                "height": DEFAULT_CHART_HEIGHT,
                "sliceName": chart.slice_name,
                "uuid": str(chart.uuid),
                "width": DEFAULT_CHART_WIDTH,
            },
            "type": "CHART",
        }
        if row_hash:
            position[chart_hash]["parents"] = ["ROOT_ID", "GRID_ID", row_hash]

    return position


class ExportDashboardsCommand(ExportModelsCommand):
    dao = DashboardDAO
    not_found = DashboardNotFoundError

    @staticmethod
    def _file_name(model: Dashboard) -> str:
        file_name = get_filename(model.dashboard_title, model.id)
        return f"dashboards/{file_name}.yaml"

    @staticmethod
    def _file_content(model: Dashboard) -> str:
        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        #  becomes the default export endpoint
        for key, new_name in JSON_KEYS.items():
            value: Optional[str] = payload.pop(key, None)
            if value:
                try:
                    payload[new_name] = json.loads(value)
                except (TypeError, json.JSONDecodeError):
                    logger.info("Unable to decode `%s` field: %s", key, value)
                    payload[new_name] = {}

        # the mapping between dashboard -> charts is inferred from the position
        # attribute, so if it's not present we need to add a default config
        if not payload.get("position"):
            payload["position"] = get_default_position(model.dashboard_title)

        # if any charts or not referenced in position, we need to add them
        # in a new row
        referenced_charts = find_chart_uuids(payload["position"])
        orphan_charts = {
            chart for chart in model.slices if str(chart.uuid) not in referenced_charts
        }

        if orphan_charts:
            payload["position"] = append_charts(payload["position"], orphan_charts)

        payload["version"] = EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        return file_content

    @staticmethod
    def _export(
        model: Dashboard, export_related: bool = True
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        yield (
            ExportDashboardsCommand._file_name(model),
            lambda: ExportDashboardsCommand._file_content(model),
        )

        if export_related:
            chart_ids = [chart.id for chart in model.slices]
            yield from ExportChartsCommand(chart_ids).run()

        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        #  becomes the default export endpoint
        for key, new_name in JSON_KEYS.items():
            value: Optional[str] = payload.pop(key, None)
            if value:
                try:
                    payload[new_name] = json.loads(value)
                except (TypeError, json.JSONDecodeError):
                    logger.info("Unable to decode `%s` field: %s", key, value)
                    payload[new_name] = {}

        # Extract all native filter datasets and replace native
        # filter dataset references with uuid
        for native_filter in payload.get("metadata", {}).get(
            "native_filter_configuration", []
        ):
            for target in native_filter.get("targets", []):
                dataset_id = target.pop("datasetId", None)
                if dataset_id is not None:
                    dataset = DatasetDAO.find_by_id(dataset_id)
                    if dataset:
                        target["datasetUuid"] = str(dataset.uuid)
                        if export_related:
                            yield from ExportDatasetsCommand([dataset_id]).run()
