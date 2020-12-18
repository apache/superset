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
import random
import string
from typing import Any, Dict, Iterator, List, Optional, Tuple

import yaml
from werkzeug.utils import secure_filename

from superset.charts.commands.export import ExportChartsCommand
from superset.dashboards.commands.exceptions import DashboardNotFoundError
from superset.dashboards.dao import DashboardDAO
from superset.commands.export import ExportModelsCommand
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.dict_import_export import EXPORT_VERSION

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


def default_position(title: str, charts: List[Slice]) -> Dict[str, Any]:
    chart_hashes = [f"CHART-{suffix()}" for _ in charts]
    row_hash = f"ROW-N-{suffix()}"
    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": [row_hash],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {"id": "HEADER_ID", "meta": {"text": title}, "type": "HEADER"},
        row_hash: {
            "children": chart_hashes,
            "id": row_hash,
            "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
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
            "parents": ["ROOT_ID", "GRID_ID", row_hash],
            "type": "CHART",
        }

    return position


class ExportDashboardsCommand(ExportModelsCommand):

    dao = DashboardDAO
    not_found = DashboardNotFoundError

    @staticmethod
    def _export(model: Dashboard) -> Iterator[Tuple[str, str]]:
        dashboard_slug = secure_filename(model.dashboard_title)
        file_name = f"dashboards/{dashboard_slug}.yaml"

        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        # becomes the default export endpoint
        for key, new_name in JSON_KEYS.items():
            value: Optional[str] = payload.pop(key, None)
            if value:
                try:
                    payload[new_name] = json.loads(value)
                except (TypeError, json.decoder.JSONDecodeError):
                    logger.info("Unable to decode `%s` field: %s", key, value)
                    payload[new_name] = {}

        # the mapping between dashboard -> charts is inferred from the position
        # attributes, so if it's not present we need to add a default config
        if not payload.get("position"):
            payload["position"] = default_position(model.dashboard_title, model.slices)

        payload["version"] = EXPORT_VERSION

        file_content = yaml.safe_dump(payload, sort_keys=False)
        yield file_name, file_content

        chart_ids = [chart.id for chart in model.slices]
        yield from ExportChartsCommand(chart_ids).run()
