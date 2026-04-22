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
from typing import Any, Optional

from marshmallow import Schema
from sqlalchemy.orm import Session  # noqa: F401

from superset.annotation_layers.schemas import ImportV1AnnotationLayerSchema
from superset.commands.annotation_layer.exceptions import AnnotationLayerImportError
from superset.commands.annotation_layer.importers.v1.utils import (
    import_annotation_layer,
)
from superset.commands.importers.v1 import ImportModelsCommand
from superset.daos.annotation_layer import AnnotationLayerDAO


class ImportAnnotationLayersCommand(ImportModelsCommand):
    """Import Annotation Layers"""

    dao = AnnotationLayerDAO
    model_name = "annotation_layer"
    prefix = "annotation_layers/"
    schemas: dict[str, Schema] = {
        "annotation_layers/": ImportV1AnnotationLayerSchema(),
    }
    import_error = AnnotationLayerImportError

    @staticmethod
    def _import(
        configs: dict[str, Any],
        overwrite: bool = False,
        contents: Optional[dict[str, Any]] = None,
    ) -> None:
        for file_name, config in configs.items():
            if file_name.startswith("annotation_layers/"):
                import_annotation_layer(config, overwrite=overwrite)
