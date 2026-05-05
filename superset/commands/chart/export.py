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
from collections.abc import Iterator
from typing import Callable

import yaml

from superset.commands.annotation_layer.export import ExportAnnotationLayersCommand
from superset.commands.chart.exceptions import ChartNotFoundError
from superset.daos.chart import ChartDAO
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.commands.export.models import ExportModelsCommand
from superset.commands.tag.export import ExportTagsCommand
from superset.models.annotations import AnnotationLayer
from superset.models.slice import Slice
from superset.tags.models import TagType
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename
from superset.utils import json
from superset.extensions import db, feature_flag_manager

logger = logging.getLogger(__name__)


# keys present in the standard export that are not needed
REMOVE_KEYS = ["datasource_type", "datasource_name", "url_params"]


class ExportChartsCommand(ExportModelsCommand):
    dao = ChartDAO
    not_found = ChartNotFoundError

    @staticmethod
    def _file_name(model: Slice) -> str:
        file_name = get_filename(model.slice_name, model.id)
        return f"charts/{file_name}.yaml"

    @staticmethod
    def _file_content(model: Slice) -> str:
        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        #  becomes the default export endpoint
        payload = {
            key: value for key, value in payload.items() if key not in REMOVE_KEYS
        }

        if payload.get("params"):
            try:
                payload["params"] = json.loads(payload["params"])
            except json.JSONDecodeError:
                logger.info("Unable to decode `params` field: %s", payload["params"])

        payload["version"] = EXPORT_VERSION
        if model.table:
            payload["dataset_uuid"] = str(model.table.uuid)

        # Fetch tags from the database if TAGGING_SYSTEM is enabled
        if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            tags = getattr(model, "tags", [])
            payload["tags"] = [tag.name for tag in tags if tag.type == TagType.custom]

        # Replace annotation layer/chart integer IDs with UUIDs for portability
        if isinstance(payload.get("params"), dict):
            ExportChartsCommand._replace_annotation_layer_uuids(
                payload["params"].get("annotation_layers", [])
            )

        # Also replace annotation IDs with UUIDs in query_context
        if payload.get("query_context"):
            try:
                query_context = json.loads(payload["query_context"])
                for query in query_context.get("queries", []):
                    ExportChartsCommand._replace_annotation_layer_uuids(
                        query.get("annotation_layers", [])
                    )
                form_data = query_context.get("form_data", {})
                ExportChartsCommand._replace_annotation_layer_uuids(
                    form_data.get("annotation_layers", [])
                )
                payload["query_context"] = json.dumps(query_context)
            except json.JSONDecodeError:
                logger.info(
                    "Unable to decode `query_context` field: %s",
                    payload["query_context"],
                )

        file_content = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
        return file_content

    @staticmethod
    def _replace_annotation_layer_uuids(
        annotation_layers: list[dict],  # type: ignore[type-arg]
    ) -> None:
        """Replace integer IDs in annotation_layers with UUIDs for portability."""
        for layer in annotation_layers:
            source_type = layer.get("sourceType")
            value = layer.get("value")
            if not isinstance(value, int):
                continue
            if source_type == "NATIVE":
                ann_layer = (
                    db.session.query(AnnotationLayer).filter_by(id=value).first()
                )
                if ann_layer:
                    layer["value"] = str(ann_layer.uuid)
            elif source_type in ("table", "line"):
                ref_charts = ChartDAO.find_by_ids([value])
                if ref_charts:
                    layer["value"] = str(ref_charts[0].uuid)

    _include_tags: bool = True  # Default to True

    @classmethod
    def disable_tag_export(cls) -> None:
        cls._include_tags = False

    @classmethod
    def enable_tag_export(cls) -> None:
        cls._include_tags = True

    @staticmethod
    def _export(
        model: Slice, export_related: bool = True
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        yield (
            ExportChartsCommand._file_name(model),
            lambda: ExportChartsCommand._file_content(model),
        )

        # Parse params once for deck_multi and annotation layer handling
        try:
            model_params = json.loads(model.params or "{}")
        except json.JSONDecodeError:
            model_params = {}

        if model.viz_type == "deck_multi" and export_related:
            if model_params.get("deck_slices"):
                slice_ids = model_params.get("deck_slices")
                yield from ExportChartsCommand(slice_ids).run()

        if model.table and export_related:
            yield from ExportDatasetsCommand([model.table.id]).run()

        # Export charts referenced as annotation sources (table/line sourceType)
        if export_related:
            annotation_layers = model_params.get("annotation_layers", [])
            chart_annotation_ids = [
                layer["value"]
                for layer in annotation_layers
                if layer.get("sourceType") in ("table", "line")
                and isinstance(layer.get("value"), int)
            ]
            if chart_annotation_ids:
                yield from ExportChartsCommand(chart_annotation_ids).run()

            # Native annotation layers (sourceType == "NATIVE", value = layer ID)
            native_layer_ids = [
                layer["value"]
                for layer in annotation_layers
                if layer.get("sourceType") == "NATIVE"
                and isinstance(layer.get("value"), int)
            ]
            if native_layer_ids:
                yield from ExportAnnotationLayersCommand(native_layer_ids).run()

        # Check if the calling class is ExportDashboardCommands
        if (
            export_related
            and ExportChartsCommand._include_tags
            and feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM")
        ):
            chart_id = model.id
            yield from ExportTagsCommand().export(chart_ids=[chart_id])
