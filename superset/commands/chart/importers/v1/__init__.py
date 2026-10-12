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
from __future__ import annotations

from typing import Any

from marshmallow import Schema

from superset import db
from superset.annotation_layers.schemas import ImportV1AnnotationLayerSchema
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.annotation_layer.importers.v1.utils import (
    import_annotation_layer,
)
from superset.commands.chart.exceptions import ChartImportError
from superset.commands.chart.importers.v1.utils import (
    get_dependency_chart_uuids,
    import_charts,
)
from superset.commands.database.importers.v1.utils import import_database
from superset.commands.dataset.importers.v1.utils import import_dataset
from superset.commands.importers.v1 import ImportModelsCommand
from superset.commands.importers.v1.utils import import_tag
from superset.commands.utils import update_chart_config_dataset
from superset.connectors.sqla.models import SqlaTable
from superset.daos.chart import ChartDAO
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.extensions import feature_flag_manager
from superset.models.slice import Slice
from superset.semantic_layers.import_export import (
    consume_chart_semantic_reference,
    resolve_bundle_references,
)
from superset.subjects.utils import get_default_viewers_for_current_user


class ImportChartsCommand(ImportModelsCommand):
    """Import charts"""

    dao = ChartDAO
    model_name = "chart"
    prefix = "charts/"
    schemas: dict[str, Schema] = {
        "annotation_layers/": ImportV1AnnotationLayerSchema(),
        "charts/": ImportV1ChartSchema(),
        "datasets/": ImportV1DatasetSchema(),
        "databases/": ImportV1DatabaseSchema(),
    }
    import_error = ChartImportError

    def _reused_dependency_uuids(self) -> set[str]:
        return get_dependency_chart_uuids(
            self.contents,
            [
                config
                for file_name, config in self._configs.items()
                if file_name.startswith("charts/")
            ],
        )

    @staticmethod
    # ruff: noqa: C901
    def _import(
        configs: dict[str, Any],
        overwrite: bool = False,
        contents: dict[str, Any] | None = None,
    ) -> None:
        contents = {} if contents is None else contents
        semantic_info: dict[str, dict[str, Any]] = resolve_bundle_references(configs)
        # discover datasets associated with charts
        dataset_uuids: set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("charts/") and "dataset_uuid" in config:
                dataset_uuids.add(config["dataset_uuid"])

        # discover databases associated with datasets
        database_uuids: set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("datasets/") and config["uuid"] in dataset_uuids:
                database_uuids.add(config["database_uuid"])

        # import related databases
        database_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/") and config["uuid"] in database_uuids:
                database = import_database(config, overwrite=False)
                database_ids[str(database.uuid)] = database.id

        # import datasets with the correct parent ref
        datasets: dict[str, SqlaTable] = {}
        for file_name, config in configs.items():
            if (
                file_name.startswith("datasets/")
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                dataset: SqlaTable = import_dataset(config, overwrite=False)
                # Key on the bundle's own uuid, which is what the bundle's
                # charts reference. An import that resolves onto an existing
                # dataset by physical identity returns a row whose uuid
                # differs, and keying on that would strand those charts.
                datasets[str(config["uuid"])] = dataset

        # import annotation layers before charts so UUID→ID maps are ready
        annotation_layer_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("annotation_layers/"):
                layer = import_annotation_layer(config, overwrite=overwrite)
                annotation_layer_ids[str(layer.uuid)] = layer.id

        # Resolve the creator's default viewers once for the whole bundle
        # rather than once per chart (a membership query each).
        default_viewers = get_default_viewers_for_current_user()

        # import charts with the correct parent ref
        chart_configs: list[dict[str, Any]] = []
        for file_name, config in configs.items():
            if file_name.startswith("charts/") and (
                "datasource_ref" in config or config.get("dataset_uuid") in datasets
            ):
                # Ignore obsolete filter-box charts.
                if config["viz_type"] == "filter_box":
                    continue

                # update datasource id, type, and name
                dataset_dict: dict[str, Any] | None = consume_chart_semantic_reference(
                    config, semantic_info
                )
                if dataset_dict is None:
                    dataset = datasets[config["dataset_uuid"]]
                    dataset_dict = {
                        "datasource_id": dataset.id,
                        "datasource_type": "table",
                        "datasource_name": dataset.table_name,
                    }
                chart_configs.append(update_chart_config_dataset(config, dataset_dict))

        # Charts bundled only as annotation sources are reused when they exist,
        # the same way datasets and databases are, and keep their local tags.
        dependency_chart_uuids: set[str] = get_dependency_chart_uuids(
            contents, chart_configs
        )
        reused_chart_uuids: set[str] = (
            {
                str(chart_uuid)
                for (chart_uuid,) in db.session.query(Slice.uuid).filter(
                    # Slice.uuid comes only from the ImportExportMixin/UUIDMixin
                    # chain, so in a full-repo mypy run mypy resolves it through
                    # CoreChart's plain `uuid: UUID | None` annotation instead of
                    # the Column descriptor; same false positive already ignored
                    # in superset/mcp_service/dataset_scope.py.
                    Slice.uuid.in_(dependency_chart_uuids)  # type: ignore[union-attr]
                )
            }
            if dependency_chart_uuids
            else set()
        )

        # annotation source charts are imported before the charts using them
        for config, chart in import_charts(
            chart_configs,
            overwrite=overwrite,
            default_viewers=default_viewers,
            annotation_layer_ids=annotation_layer_ids,
            dependency_chart_uuids=dependency_chart_uuids,
        ):
            if str(config["uuid"]) in reused_chart_uuids:
                continue
            # Handle tags using import_tag function
            if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
                if "tags" in config:
                    import_tag(config["tags"], contents, chart.id, "chart", db.session)
