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
"""Request schemas for the canvas REST API."""

from marshmallow import fields, Schema
from marshmallow.validate import Length

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}

title_description = "The canvas' title."
description_description = "What the canvas shows, for readers and agents."
editors_description = (
    "Subject ids (users, roles or groups) that can edit the canvas. Defaults "
    "to the creating user."
)
viewers_description = "Subject ids (users, roles or groups) that can view the canvas."
definition_description = (
    "Initial canvas definition. Changed afterwards only through the "
    "definition operations endpoint."
)


class CanvasPostSchema(Schema):
    title = fields.String(
        required=True,
        validate=Length(1, 500),
        metadata={"description": title_description},
    )
    description = fields.String(
        allow_none=True, metadata={"description": description_description}
    )
    editors = fields.List(fields.Integer(metadata={"description": editors_description}))
    viewers = fields.List(fields.Integer(metadata={"description": viewers_description}))
    definition = fields.Dict(
        allow_none=True, metadata={"description": definition_description}
    )


class CanvasPutSchema(Schema):
    title = fields.String(
        validate=Length(1, 500), metadata={"description": title_description}
    )
    description = fields.String(
        allow_none=True, metadata={"description": description_description}
    )
    editors = fields.List(fields.Integer(metadata={"description": editors_description}))
    viewers = fields.List(fields.Integer(metadata={"description": viewers_description}))
