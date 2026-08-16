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

import logging
from collections.abc import Iterator
from typing import Callable

import yaml

from superset.commands.annotation_layer.exceptions import AnnotationLayerNotFoundError
from superset.commands.export.models import ExportModelsCommand
from superset.daos.annotation_layer import AnnotationLayerDAO
from superset.models.annotations import AnnotationLayer
from superset.utils import json
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename

logger = logging.getLogger(__name__)


class ExportAnnotationLayersCommand(ExportModelsCommand):
    """Export annotation layers and nested annotations as versioned YAML files."""

    dao = AnnotationLayerDAO
    not_found = AnnotationLayerNotFoundError

    @staticmethod
    def _file_name(model: AnnotationLayer) -> str:
        """Return annotation layer export path as annotation_layers/<slug>-<id>.yaml."""

        file_name = get_filename(model.name, model.id)
        return f"annotation_layers/{file_name}.yaml"

    @staticmethod
    def _file_content(model: AnnotationLayer) -> str:
        """Build export payload, normalize annotation fields, and serialize as YAML."""

        payload = model.export_to_dict(
            recursive=True,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        payload["version"] = EXPORT_VERSION

        # Convert annotation datetime fields to ISO format strings for YAML
        # and parse json_metadata from JSON string to dict
        for annotation in payload.get("annotation", []):
            for dt_field in ("start_dttm", "end_dttm"):
                if dt_field in annotation and annotation[dt_field] is not None:
                    annotation[dt_field] = annotation[dt_field].isoformat()
            json_meta = annotation.get("json_metadata")
            if json_meta:
                try:
                    parsed_json_meta = json.loads(json_meta)
                    if isinstance(parsed_json_meta, dict):
                        annotation["json_metadata"] = parsed_json_meta
                    else:
                        logger.info(
                            "`json_metadata` must be a JSON object. Value: %s",
                            json_meta,
                        )
                        annotation["json_metadata"] = None
                except json.JSONDecodeError:
                    logger.info("Unable to decode `json_metadata` field: %s", json_meta)
                    annotation["json_metadata"] = None
            else:
                # Normalize empty string to null
                annotation["json_metadata"] = None

        return yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)

    @staticmethod
    def _export(
        model: AnnotationLayer, export_related: bool = True
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        """
        Yield (path, content_factory) for the layer export; export_related is unused.
        """

        yield (
            ExportAnnotationLayersCommand._file_name(model),
            lambda: ExportAnnotationLayersCommand._file_content(model),
        )
