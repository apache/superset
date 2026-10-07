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

from marshmallow import fields

from superset import db, security_manager
from superset.commands.exceptions import ImportFailedError
from superset.models.annotations import AnnotationLayer
from superset.utils import json

DATETIME_FIELD = fields.DateTime(allow_none=True)


def import_annotation_layer(
    config: dict[str, Any],
    overwrite: bool = False,
    ignore_permissions: bool = False,
) -> AnnotationLayer:
    """Upsert annotation layer config and return persisted layer.

    An existing layer is returned unchanged unless ``overwrite`` is set and the
    caller has ``can_write`` on Annotation; creating a layer requires
    ``can_write``.
    """
    can_write = ignore_permissions or security_manager.can_access(
        "can_write", "Annotation"
    )

    existing = db.session.query(AnnotationLayer).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite or not can_write:
            return existing
        config["id"] = existing.id
    elif not can_write:
        raise ImportFailedError(
            "Annotation layer import requires can_write permission on Annotation"
        )

    # remove version key before passing to import_from_dict
    config.pop("version", None)

    # Convert json_metadata dicts back to JSON strings for the database column
    for annotation in config.get("annotation", []):
        # Convert exported ISO strings into Python datetimes for ORM DateTime columns.
        for key in ("start_dttm", "end_dttm"):
            if isinstance(annotation.get(key), str):
                annotation[key] = DATETIME_FIELD.deserialize(annotation[key])
        if isinstance(annotation.get("json_metadata"), dict):
            annotation["json_metadata"] = json.dumps(annotation["json_metadata"])

    layer = AnnotationLayer.import_from_dict(
        config, recursive=True, sync=["annotation"]
    )
    if layer.id is None:
        db.session.flush()

    return layer
