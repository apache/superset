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


from typing import Any, Callable, List, Optional, Union
from collections.abc import Iterator

import yaml
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.tag import TagDAO
from superset.extensions import feature_flag_manager
from superset.tags.models import TagType
from superset.commands.export.models import ExportModelsCommand
from superset.commands.tag.exceptions import TagNotFoundError


class ExportTagsCommand(ExportModelsCommand):
    dao = TagDAO
    not_found = TagNotFoundError

    def __init__(
        self,
        model_ids: Optional[list[int]] = None,
        export_related: bool = True,
        *,
        dashboard_ids: Optional[Union[int, List[Union[int, str]]]] = None,
        chart_ids: Optional[Union[int, List[Union[int, str]]]] = None,
    ):
        self.model_ids = model_ids or []
        self.export_related = export_related
        self.dashboard_ids = dashboard_ids
        self.chart_ids = chart_ids
        self._models = []

    def run(self) -> Iterator[tuple[str, Callable[[], str]]]:
        if not feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            return

        yield (
            ExportTagsCommand._file_name(),
            lambda: ExportTagsCommand._file_content(
                self.dashboard_ids, self.chart_ids
            ),
        )

    @staticmethod
    def _file_name() -> str:
        return "tags.yaml"

    @staticmethod
    def _merge_tags(
        dashboard_tags: List[dict[str, Any]], chart_tags: List[dict[str, Any]]
    ) -> List[dict[str, Any]]:
        tags_dict = {tag["tag_name"]: tag for tag in dashboard_tags}

        for tag in chart_tags:
            if tag["tag_name"] not in tags_dict:
                tags_dict[tag["tag_name"]] = tag

        return list(tags_dict.values())

    @staticmethod
    def _file_content(
        dashboard_ids: Optional[Union[int, List[Union[int, str]]]] = None,
        chart_ids: Optional[Union[int, List[Union[int, str]]]] = None,
    ) -> str:
        payload: dict[str, list[dict[str, Any]]] = {"tags": []}

        dashboard_tags = []
        chart_tags = []

        if dashboard_ids:
            if isinstance(dashboard_ids, int):
                dashboard_ids = [dashboard_ids]

            dashboards = [
                dashboard
                for dashboard in (
                    DashboardDAO.find_by_id(dashboard_id)
                    for dashboard_id in dashboard_ids
                )
                if dashboard is not None
            ]

            for dashboard in dashboards:
                tags = dashboard.tags if hasattr(dashboard, "tags") else []
                filtered_tags = [
                    {"tag_name": tag.name, "description": tag.description}
                    for tag in tags
                    if tag.type == TagType.custom
                ]
                dashboard_tags.extend(filtered_tags)

        if chart_ids:
            if isinstance(chart_ids, int):
                chart_ids = [chart_ids]

            charts = [
                chart
                for chart in (ChartDAO.find_by_id(chart_id) for chart_id in chart_ids)
                if chart is not None
            ]

            for chart in charts:
                tags = chart.tags if hasattr(chart, "tags") else []
                filtered_tags = [
                    {"tag_name": tag.name, "description": tag.description}
                    for tag in tags
                    if "type:" not in tag.name and "editor:" not in tag.name
                ]
                chart_tags.extend(filtered_tags)

        merged_tags = ExportTagsCommand._merge_tags(dashboard_tags, chart_tags)
        payload["tags"].extend(merged_tags)

        file_content = yaml.safe_dump(payload, sort_keys=False)
        return file_content

    @staticmethod
    def export(
        dashboard_ids: Optional[Union[int, List[Union[int, str]]]] = None,
        chart_ids: Optional[Union[int, List[Union[int, str]]]] = None,
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        if not feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            return

        yield (
            ExportTagsCommand._file_name(),
            lambda: ExportTagsCommand._file_content(dashboard_ids, chart_ids),
        )
