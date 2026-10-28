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

from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Callable

import yaml

from superset import security_manager
from superset.commands.annotation_layer.export import ExportAnnotationLayersCommand
from superset.commands.base import BaseCommand
from superset.commands.chart.export import ExportChartsCommand
from superset.commands.dashboard.export import (
    dashboard_dataset_ids,
    ExportDashboardsCommand,
)
from superset.commands.database.export import ExportDatabasesCommand
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.commands.export.models import ExportModelsCommand
from superset.commands.query.export import ExportSavedQueriesCommand
from superset.commands.tag.export import ExportTagsCommand
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.dataset import DatasetDAO
from superset.utils import json
from superset.utils.core import DatasourceType
from superset.utils.dict_import_export import EXPORT_VERSION

METADATA_FILE_NAME = "metadata.yaml"


class ExportAssetsCommand(BaseCommand):
    """
    Command that exports all databases, datasets, charts, dashboards, saved queries
    and annotation layers.
    """

    def run(self) -> Iterator[tuple[str, Callable[[], str]]]:
        metadata = {
            "version": EXPORT_VERSION,
            "type": "assets",
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }
        yield METADATA_FILE_NAME, lambda: yaml.safe_dump(metadata, sort_keys=False)
        seen = {METADATA_FILE_NAME}

        commands: list[type[ExportModelsCommand]] = [
            ExportDatabasesCommand,
            ExportDatasetsCommand,
            ExportChartsCommand,
            ExportDashboardsCommand,
            ExportSavedQueriesCommand,
        ]
        # Charts reference native annotation layers by UUID, so the layers must
        # be in the bundle too. They are only readable with can_read on
        # Annotation, and chart files leave those references out otherwise.
        if security_manager.can_access("can_read", "Annotation"):
            commands.append(ExportAnnotationLayersCommand)

        dashboard_ids: list[int | str] = []
        chart_ids: list[int | str] = []
        dataset_ids: list[int | str] = []
        for command in commands:
            ids = [model.id for model in command.dao.find_all()]
            for file_name, file_content in command(ids, export_related=False).run():
                if file_name not in seen:
                    yield file_name, file_content
                    seen.add(file_name)

            if command == ExportDashboardsCommand:
                dashboard_ids = ids
            elif command == ExportChartsCommand:
                chart_ids = ids
            elif command == ExportDatasetsCommand:
                dataset_ids = ids

        yield from self._export_referenced_trashed_datasets(
            chart_ids, dashboard_ids, dataset_ids, seen
        )

        yield from ExportTagsCommand(
            dashboard_ids=dashboard_ids,
            chart_ids=chart_ids,
        ).run()

    @classmethod
    def _export_referenced_trashed_datasets(
        cls,
        chart_ids: list[int | str],
        dashboard_ids: list[int | str],
        dataset_ids: list[int | str],
        seen: set[str],
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        if trashed_ids := cls._referenced_trashed_dataset_ids(
            chart_ids, dashboard_ids, dataset_ids
        ):
            for file_name, file_content in ExportDatasetsCommand(
                trashed_ids, export_related=False, include_deleted=True
            ).run():
                if file_name not in seen:
                    yield file_name, file_content
                    seen.add(file_name)

    @staticmethod
    def _referenced_trashed_dataset_ids(
        chart_ids: list[int | str],
        dashboard_ids: list[int | str],
        dataset_ids: list[int | str],
    ) -> list[int]:
        """Datasets in the trash that the exported charts and native filters name.

        Datasets are exported from the visibility-filtered ``find_all()``, which
        leaves the trash out. A chart or a native filter whose dataset is in the
        trash still writes its ``dataset_uuid`` / ``datasetUuid``, and the import
        resolves those from the bundle, so those datasets are exported as well.

        Every id goes through one lookup with the DAO base filter. A chart's
        ``Slice.table`` relationship is loaded without it, and a dataset the user
        cannot read would make ``ExportDatasetsCommand.validate()`` fail the whole
        export.
        """
        candidate_ids = {
            chart.datasource_id
            for chart in ChartDAO.find_by_ids(chart_ids)
            if chart.datasource_type == DatasourceType.TABLE
            and chart.datasource_id is not None
        }
        for dashboard in DashboardDAO.find_by_ids(dashboard_ids):
            try:
                metadata = json.loads(dashboard.json_metadata or "{}")
            except (TypeError, json.JSONDecodeError):
                continue
            # A stored null or list parses, but names no targets
            if isinstance(metadata, dict):
                candidate_ids |= dashboard_dataset_ids(metadata)
        referenced = {
            dataset.id
            for dataset in DatasetDAO.find_by_ids(
                list(candidate_ids), skip_visibility_filter=True
            )
        }
        return sorted(referenced.difference(dataset_ids))

    def validate(self) -> None:
        pass
