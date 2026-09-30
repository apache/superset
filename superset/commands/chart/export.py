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
from typing import Any, Callable

import yaml

from superset.commands.annotation_layer.export import ExportAnnotationLayersCommand
from superset.commands.chart.exceptions import ChartNotFoundError
from superset.daos.chart import ChartDAO
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.commands.export.models import (
    ExportModelsCommand,
    get_extra_export_fields,
)
from superset.commands.tag.export import ExportTagsCommand
from superset.models.annotations import AnnotationLayer
from superset.models.slice import Slice
from superset.tags.models import TagType
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename
from superset.utils import json
from superset.utils.core import (
    ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE,
    get_annotation_layer_lists,
)
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
        if extra_fields := get_extra_export_fields(model, "chart"):
            payload["extra"] = extra_fields

        # Replace annotation layer/chart integer IDs with UUIDs for portability
        query_context = None
        if payload.get("query_context"):
            try:
                query_context = json.loads(payload["query_context"])
            except json.JSONDecodeError:
                logger.info(
                    "Unable to decode `query_context` field: %s",
                    payload["query_context"],
                )
        for annotation_layers in get_annotation_layer_lists(
            payload.get("params"), query_context
        ):
            ExportChartsCommand._replace_annotation_layer_uuids(
                model, annotation_layers
            )
        if query_context is not None:
            payload["query_context"] = json.dumps(query_context)

        file_content = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
        return file_content

    @staticmethod
    def _replace_annotation_layer_uuids(
        model: Slice,
        annotation_layers: list[dict[str, Any]],
    ) -> None:
        """
        Replace integer IDs in annotation_layers with UUIDs for portability.

        References that cannot be resolved (the layer or chart was deleted, or
        the source chart is not visible to the exporting user) are dropped from
        the exported copy, so they cannot bind to unrelated rows on import.
        """
        resolved: list[dict[str, Any]] = []
        for layer in annotation_layers:
            source_type = layer.get("sourceType")
            value = layer.get("value")
            if isinstance(value, int) and source_type == "NATIVE":
                ann_layer = (
                    db.session.query(AnnotationLayer).filter_by(id=value).one_or_none()
                )
                if not ann_layer:
                    logger.warning(
                        "Chart %s references missing annotation layer %s; "
                        "dropping it from the export",
                        model.id,
                        value,
                    )
                    continue
                layer["value"] = str(ann_layer.uuid)
            elif (
                isinstance(value, int)
                and source_type in ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE
            ):
                ref_charts = ChartDAO.find_by_ids([value])
                if not ref_charts:
                    logger.warning(
                        "Chart %s references annotation source chart %s, which is "
                        "missing or not accessible; dropping it from the export",
                        model.id,
                        value,
                    )
                    continue
                layer["value"] = str(ref_charts[0].uuid)
            resolved.append(layer)
        annotation_layers[:] = resolved

    _include_tags: bool = True  # Default to True

    @classmethod
    def disable_tag_export(cls) -> None:
        cls._include_tags = False

    @classmethod
    def enable_tag_export(cls) -> None:
        cls._include_tags = True

    def run(
        self, seen: set[str] | None = None
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        yield from super().run(seen=seen)

        # Tags are exported once for all requested charts (rather than per
        # chart in `_export`) so a multi-chart export doesn't lose tags to
        # the parent's per-file-name de-duplication of `tags.yaml`.
        if (
            self.export_related
            and ExportChartsCommand._include_tags
            and feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM")
        ):
            yield from ExportTagsCommand(
                chart_ids=[model.id for model in self._models]
            ).run()

    @staticmethod
    def _export(
        model: Slice,
        export_related: bool = True,
        seen: set[str] | None = None,
        _chart_seen: set[int] | None = None,
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        # Initialize seen set if not provided
        if seen is None:
            seen = set()

        # Guard against circular annotation references (A→B→A).
        # _chart_seen is passed down the call stack so no class-level state
        # is needed.
        if _chart_seen is None:
            _chart_seen = set()
        if model.id in _chart_seen:
            return
        _chart_seen.add(model.id)

        yield (
            ExportChartsCommand._file_name(model),
            lambda: ExportChartsCommand._file_content(model),
        )

        if model.table and export_related:
            # Pass the shared seen set to the dataset export command
            yield from ExportDatasetsCommand([model.table.id]).run(seen=seen)

        if export_related:
            yield from ExportChartsCommand._export_annotation_layers(
                model, seen=seen, _chart_seen=_chart_seen
            )

    @staticmethod
    def _annotation_reference_ids(model: Slice) -> tuple[set[int], set[int]]:
        """
        Return the ``(chart_ids, native_layer_ids)`` referenced as annotation
        sources by ``model``'s params and query_context.
        """
        try:
            model_params = json.loads(model.params or "{}")
        except json.JSONDecodeError:
            model_params = {}
        try:
            query_context = json.loads(model.query_context or "{}")
        except json.JSONDecodeError:
            query_context = {}

        chart_ids: set[int] = set()
        native_layer_ids: set[int] = set()
        for annotation_layers in get_annotation_layer_lists(
            model_params, query_context
        ):
            for layer in annotation_layers:
                value = layer.get("value")
                if not isinstance(value, int):
                    continue
                source_type = layer.get("sourceType")
                if source_type in ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE:
                    chart_ids.add(value)
                elif source_type == "NATIVE":
                    native_layer_ids.add(value)
        return chart_ids, native_layer_ids

    @staticmethod
    def _export_annotation_layers(
        model: Slice,
        seen: set[str],
        _chart_seen: set[int],
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        """
        Export annotation layers/charts referenced by ``model``'s params and
        query_context. Unresolvable references are skipped, matching
        ``_replace_annotation_layer_uuids``.
        """
        chart_annotation_ids, native_layer_ids = (
            ExportChartsCommand._annotation_reference_ids(model)
        )

        # Export charts referenced as annotation sources (table/line sourceType)
        if chart_annotation_ids:
            # Call _export directly (not .run()) to share seen/_chart_seen
            # across the recursion and prevent infinite loops on circular
            # references.
            for ref_chart in ChartDAO.find_by_ids(sorted(chart_annotation_ids)):
                yield from ExportChartsCommand._export(
                    ref_chart,
                    export_related=True,
                    seen=seen,
                    _chart_seen=_chart_seen,
                )

        # Native annotation layers (sourceType == "NATIVE", value = layer ID)
        if native_layer_ids:
            existing_layer_ids = [
                layer_id
                for (layer_id,) in db.session.query(AnnotationLayer.id)
                .filter(AnnotationLayer.id.in_(native_layer_ids))
                .order_by(AnnotationLayer.id)
            ]
            if existing_layer_ids:
                yield from ExportAnnotationLayersCommand(existing_layer_ids).run()
