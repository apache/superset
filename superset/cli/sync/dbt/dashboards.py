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

import json
import logging
from pathlib import Path
from typing import List, TYPE_CHECKING

import yaml

from superset.utils.urls import get_url_path

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard

_logger = logging.getLogger(__name__)


def get_depends_on(dashboard: "Dashboard") -> List[str]:
    """
    Get all the DBT dependencies for a given dashboard.
    """
    depends_on = []
    for chart in dashboard.slices:
        extra = json.loads(chart.table.extra or "{}")
        if "depends_on" in extra:
            depends_on.append(extra["depends_on"])

    return depends_on


def sync_dashboards(exposures_path: Path, datasets: List["SqlaTable"],) -> None:
    """
    Write dashboard back to DBT as exposures.
    """
    # collect charts using datasets
    charts = {chart for dataset in datasets for chart in dataset.slices}

    exposures = []
    for chart in charts:
        for dashboard in chart.dashboards:
            first_owner = dashboard.owners[0]

            exposure = {
                "name": dashboard.dashboard_title,
                "type": "dashboard",
                "maturity": "high" if dashboard.published else "low",
                "url": get_url_path(
                    "Superset.dashboard", dashboard_id_or_slug=dashboard.id
                ),
                "description": dashboard.description or "",
                "depends_on": get_depends_on(dashboard),
                "owner": {
                    "name": first_owner.first_name + " " + first_owner.last_name,
                    "email": first_owner.email,
                },
            }
            exposures.append(exposure)

    with open(exposures_path, "w", encoding="utf-8") as output:
        yaml.safe_dump({"version": 2, "exposures": exposures}, output, sort_keys=False)
