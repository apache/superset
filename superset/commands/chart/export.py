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
from superset.semantic_layers.import_export import export_view_reference
from superset.tags.models import TagType
from superset.utils.dict_import_export import (
    EXPORT_VERSION,
    SELECTED_CHARTS_FILE_NAME,
    SELECTED_CHARTS_KEY,
)
from superset.utils.file import get_filename
from superset.utils import json
from superset.utils.core import (
    ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE,
    get_annotation_layer_lists,
)
from superset.extensions import db, feature_flag_manager, security_manager

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
        if model.datasource_type == "semantic_view":
            if model.semantic_view:
                payload["datasource_ref"] = export_view_reference(model.semantic_view)
        elif model.table:
            payload["dataset_uuid"] = str(model.table.uuid)

        # Fetch tags from the database if TAGGING_SYSTEM is enabled
        if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            tags = getattr(model, "tags", [])
            payload["tags"] = [tag.name for tag in tags if tag.type == TagType.custom]
        if extra_fields := get_extra_export_fields(model, "chart"):
            payload["extra"] = extra_fields

        ExportChartsCommand._export_annotation_references(model, payload)

        file_content = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
        return file_content

    @staticmethod
    def _export_annotation_references(model: Slice, payload: dict[str, Any]) -> None:
        """
        Replace annotation layer/chart integer IDs in ``payload``'s params and
        query_context with UUIDs for portability.
        """
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

    @staticmethod
    def _can_read_annotations() -> bool:
        """
        Match the chart-data path, which only returns native annotation layers
        to users with can_read on Annotation.
        """
        return security_manager.can_access("can_read", "Annotation")

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
                if not ExportChartsCommand._can_read_annotations():
                    logger.warning(
                        "Chart %s references annotation layer %s, which the user "
                        "can't read; dropping it from the export",
                        model.id,
                        value,
                    )
                    continue
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
        is_root = seen is None
        yield from super().run(seen=seen)
        if not self.export_related:
            return

        # Tags are exported once for all requested charts (rather than per
        # chart in `_export`) so a multi-chart export doesn't lose tags to
        # the parent's per-file-name de-duplication of `tags.yaml`.
        export_tags = ExportChartsCommand._include_tags and (
            feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM")
        )
        # Nested exports (a dashboard's charts) write neither file, so skip the
        # annotation source walk for them.
        if not is_root and not export_tags:
            return

        chart_ids = ExportChartsCommand.chart_ids_with_annotation_sources(self._models)

        # When annotation sources were pulled in, record which charts were
        # picked so the importer only reuses the others.
        if is_root and len(chart_ids) > len(self._models):
            selected_chart_uuids = [str(model.uuid) for model in self._models]
            yield (
                SELECTED_CHARTS_FILE_NAME,
                lambda: yaml.safe_dump(
                    {SELECTED_CHARTS_KEY: selected_chart_uuids}, sort_keys=False
                ),
            )

        if export_tags:
            yield from ExportTagsCommand(chart_ids=chart_ids).run()

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
    def chart_ids_with_annotation_sources(charts: list[Slice]) -> list[int | str]:
        """
        Return the IDs of ``charts`` plus, recursively, of the charts they use as
        annotation sources, i.e. every chart a related export writes out.
        """
        chart_ids: list[int | str] = [chart.id for chart in charts]
        visited = {chart.id for chart in charts}
        pending = list(charts)
        while pending:
            source_ids, _ = ExportChartsCommand._annotation_reference_ids(pending.pop())
            new_ids = sorted(source_ids - visited)
            visited.update(new_ids)
            for source_chart in ChartDAO.find_by_ids(new_ids) if new_ids else []:
                chart_ids.append(source_chart.id)
                pending.append(source_chart)
        return chart_ids

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
        if native_layer_ids and ExportChartsCommand._can_read_annotations():
            existing_layer_ids = [
                layer_id
                for (layer_id,) in db.session.query(AnnotationLayer.id)
                .filter(AnnotationLayer.id.in_(native_layer_ids))
                .order_by(AnnotationLayer.id)
            ]
            if existing_layer_ids:
                yield from ExportAnnotationLayersCommand(existing_layer_ids).run()
