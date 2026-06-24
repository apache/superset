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
from sqlalchemy.orm import Session  # noqa: F401

from superset import db
from superset.annotation_layers.schemas import ImportV1AnnotationLayerSchema
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.annotation_layer.importers.v1.utils import (
    import_annotation_layer,
)
from superset.commands.chart.exceptions import ChartImportError
from superset.commands.chart.importers.v1.utils import (
    import_chart,
    topological_sort_charts,
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

    @staticmethod
    def _import_chart_with_tags(
        config: dict[str, Any],
        overwrite: bool,
        contents: dict[str, Any],
        imported_chart_ids: dict[str, int],
        annotation_layer_ids: dict[str, int] | None = None,
    ) -> None:
        chart = import_chart(
            config,
            overwrite=overwrite,
            annotation_layer_ids=annotation_layer_ids,
            chart_ids=imported_chart_ids,
        )
        imported_chart_ids[str(chart.uuid)] = chart.id

        if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            if "tags" in config:
                import_tag(config["tags"], contents, chart.id, "chart", db.session)

    @staticmethod
    # ruff: noqa: C901
    def _import(
        configs: dict[str, Any],
        overwrite: bool = False,
        contents: dict[str, Any] | None = None,
    ) -> None:
        contents = {} if contents is None else contents
        # discover datasets and referenced chart UUIDs from chart configs
        dataset_uuids: set[str] = set()
        referenced_chart_uuids: set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("charts/"):
                dataset_uuids.add(config["dataset_uuid"])
                for annotation in config.get("params", {}).get("annotation_layers", []):
                    if annotation.get("sourceType") in (
                        "table",
                        "line",
                    ) and isinstance(annotation.get("value"), str):
                        referenced_chart_uuids.add(annotation["value"])

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
                dataset = import_dataset(config, overwrite=False)
                datasets[str(dataset.uuid)] = dataset

        # import annotation layers before charts so UUID→ID maps are ready
        annotation_layer_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("annotation_layers/"):
                layer = import_annotation_layer(config, overwrite=False)
                annotation_layer_ids[str(layer.uuid)] = layer.id

        # categorize chart configs: referenced charts first, then dependents
        referenced_chart_configs: list[dict[str, Any]] = []
        dependent_chart_configs: list[dict[str, Any]] = []
        # import charts with the correct parent ref
        for file_name, config in configs.items():
            if file_name.startswith("charts/") and config["dataset_uuid"] in datasets:
                # Ignore obsolete filter-box charts.
                if config["viz_type"] == "filter_box":
                    continue

                # update datasource id, type, and name
                dataset = datasets[config["dataset_uuid"]]
                dataset_dict = {
                    "datasource_id": dataset.id,
                    "datasource_type": "table",
                    "datasource_name": dataset.table_name,
                }
                config = update_chart_config_dataset(config, dataset_dict)

                if config.get("uuid") in referenced_chart_uuids:
                    referenced_chart_configs.append(config)
                else:
                    dependent_chart_configs.append(config)

        # topologically sort referenced charts for multi-level deps (A→B→C)
        referenced_chart_configs = topological_sort_charts(referenced_chart_configs)

        # import referenced charts first, then charts that depend on them
        imported_chart_ids: dict[str, int] = {}
        for config in referenced_chart_configs + dependent_chart_configs:
            ImportChartsCommand._import_chart_with_tags(
                config, overwrite, contents, imported_chart_ids, annotation_layer_ids
            )
