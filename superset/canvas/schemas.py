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
from marshmallow.validate import Length, Regexp

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}

title_description = "The canvas' title."
description_description = "What the canvas shows, for readers and agents."
editors_description = (
    "Subject ids (users, roles or groups) that can edit the canvas. Defaults "
    "to the creating user."
)
viewers_description = "Subject ids (users, roles or groups) that can view the canvas."
slug_description = (
    "Readable key for the canvas URL, e.g. /canvas/sales-overview/. Unique, not "
    "all digits, and not 'list'."
)
css_description = "Custom CSS applied to the canvas page."
theme_id_description = "Theme applied to the canvas; the default theme when unset."
certified_by_description = "Person or group that has certified this canvas."
certification_details_description = "Details of the certification."
is_managed_externally_description = (
    "Whether the canvas is managed by an external system, e.g. as code."
)
external_url_description = "Where the canvas is managed when managed externally."
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
    slug = fields.String(
        allow_none=True,
        validate=[
            Length(1, 255),
            Regexp(
                r"^(?!\d+$)(?!list$)[\w-]+$",
                error="Use letters, digits, - and _; not all digits, not 'list'.",
            ),
        ],
        metadata={"description": slug_description},
    )
    css = fields.String(allow_none=True, metadata={"description": css_description})
    theme_id = fields.Integer(
        allow_none=True, metadata={"description": theme_id_description}
    )
    certified_by = fields.String(
        allow_none=True, metadata={"description": certified_by_description}
    )
    certification_details = fields.String(
        allow_none=True, metadata={"description": certification_details_description}
    )
    is_managed_externally = fields.Boolean(
        allow_none=True, metadata={"description": is_managed_externally_description}
    )
    external_url = fields.String(
        allow_none=True, metadata={"description": external_url_description}
    )
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
    slug = fields.String(
        allow_none=True,
        validate=[
            Length(1, 255),
            Regexp(
                r"^(?!\d+$)(?!list$)[\w-]+$",
                error="Use letters, digits, - and _; not all digits, not 'list'.",
            ),
        ],
        metadata={"description": slug_description},
    )
    css = fields.String(allow_none=True, metadata={"description": css_description})
    theme_id = fields.Integer(
        allow_none=True, metadata={"description": theme_id_description}
    )
    certified_by = fields.String(
        allow_none=True, metadata={"description": certified_by_description}
    )
    certification_details = fields.String(
        allow_none=True, metadata={"description": certification_details_description}
    )
    is_managed_externally = fields.Boolean(
        allow_none=True, metadata={"description": is_managed_externally_description}
    )
    external_url = fields.String(
        allow_none=True, metadata={"description": external_url_description}
    )
