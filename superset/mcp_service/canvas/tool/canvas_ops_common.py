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

"""Applying canvas operations for the canvas MCP tools."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from superset.canvas.definition.schemas import ApplyOperationsRequest
from superset.canvas.definition.validation import request_pointer
from superset.canvas.definition.versions import DefinitionVersionError
from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasNotFoundError,
    DefinitionConflictError,
    DefinitionInvalidError,
)


def _apply_canvas_ops_impl(
    canvas_id: int | str, base_revision: int, ops: list[dict[str, Any]]
) -> dict[str, Any]:
    try:
        request = ApplyOperationsRequest.model_validate(
            {"base_revision": base_revision, "ops": ops}
        )
    except ValidationError as ex:
        return {
            "error": "Invalid operations",
            "errors": [
                {"path": request_pointer(error["loc"]), "message": error["msg"]}
                for error in ex.errors()
            ],
        }
    try:
        result = ApplyCanvasOperationsCommand(
            canvas_id, request.base_revision, request.ops
        ).run()
    except CanvasNotFoundError:
        return {"error": f"Canvas {canvas_id} not found, or no access to it"}
    except CanvasForbiddenError:
        return {"error": "Only the canvas' editors can change it"}
    except DefinitionVersionError as ex:
        return {"error": str(ex)}
    except (DefinitionConflictError, DefinitionInvalidError) as ex:
        payload = ex.to_payload()
        return {"error": payload.pop("message"), **payload}
    return {"revision": result.revision, "ops": result.ops}
