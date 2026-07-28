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

from typing import Any

from superset import db
from superset.models.annotations import AnnotationLayer
from superset.utils import json


def import_annotation_layer(
    config: dict[str, Any], overwrite: bool = False
) -> AnnotationLayer:
    existing = db.session.query(AnnotationLayer).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite:
            return existing
        config["id"] = existing.id

    # remove version key before passing to import_from_dict
    config.pop("version", None)

    # Convert json_metadata dicts back to JSON strings for the database column
    for annotation in config.get("annotation", []):
        if isinstance(annotation.get("json_metadata"), dict):
            annotation["json_metadata"] = json.dumps(annotation["json_metadata"])

    layer = AnnotationLayer.import_from_dict(config, recursive=True)
    if layer.id is None:
        db.session.flush()

    return layer
