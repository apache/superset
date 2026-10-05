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
"""Create a canvas."""

from __future__ import annotations

from functools import partial
from typing import Any

from marshmallow import ValidationError

from superset.canvas.definition.registry import get_instance_resolver
from superset.canvas.definition.schemas import empty_definition
from superset.canvas.definition.validation import (
    DefinitionValidationError,
    normalize_definition,
)
from superset.canvas.definition.versions import (
    check_definition_version,
    DefinitionVersionError,
)
from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.canvas.exceptions import (
    CanvasCreateFailedError,
    CanvasInvalidError,
)
from superset.commands.canvas.utils import validate_metadata
from superset.commands.utils import populate_subjects
from superset.daos.canvas import CanvasDAO
from superset.models.canvas import Canvas
from superset.utils import json
from superset.utils.decorators import on_error, transaction


class CreateCanvasCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=CanvasCreateFailedError))
    def run(self) -> Canvas:
        self.validate()
        return CanvasDAO.create(attributes=self._properties)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        # Defaults the editors to the requesting user, and resolves viewers.
        populate_subjects(self._properties, exceptions)
        validate_metadata(self._properties, exceptions)
        self._validate_definition(exceptions)
        if exceptions:
            raise CanvasInvalidError(exceptions=exceptions)

    def _validate_definition(self, exceptions: list[ValidationError]) -> None:
        raw = self._properties.pop("definition", None) or empty_definition()
        try:
            definition = normalize_definition(check_definition_version(raw))
        except DefinitionVersionError as ex:
            exceptions.append(
                ValidationError({"/version": [str(ex)]}, field_name="definition")
            )
            return
        except DefinitionValidationError as ex:
            exceptions.append(
                ValidationError(
                    {issue.path: [issue.message] for issue in ex.issues},
                    field_name="definition",
                )
            )
            return
        instances = {
            node["instance"]
            for node in definition["nodes"].values()
            if "instance" in node
        }
        if hidden := instances - get_instance_resolver().placeable(instances):
            exceptions.append(
                ValidationError(
                    {
                        f"/nodes/{node_id}/instance": [
                            "unknown widget instance, or no access to it"
                        ]
                        for node_id, node in definition["nodes"].items()
                        if node.get("instance") in hidden
                    },
                    field_name="definition",
                )
            )
            return
        self._properties["definition"] = json.dumps(definition)
        self._properties["definition_version"] = definition["version"]
        self._properties["revision"] = 1
