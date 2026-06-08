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
"""Marshmallow schemas for the extensions REST API."""

from marshmallow import fields, Schema
from marshmallow.validate import Length

from superset.extensions.models import EXTENSION_ID_MAX_LENGTH


class ExtensionSettingsPutSchema(Schema):
    """Validate the partial update body for the extension settings PUT route.

    Both fields are optional so the update is a partial patch: keys absent from
    the payload are left untouched. An empty-string ``active_chatbot_id`` is a
    valid "clear" signal that the command normalises to ``None``.
    """

    active_chatbot_id = fields.String(
        allow_none=True,
        validate=Length(max=EXTENSION_ID_MAX_LENGTH),
        metadata={"description": "Id of the chatbot to render, or null to clear."},
    )
    enabled = fields.Dict(
        keys=fields.String(validate=Length(min=1, max=EXTENSION_ID_MAX_LENGTH)),
        # Strict booleans: reject non-bool values (e.g. "yes") rather than
        # coercing them, so a malformed toggle map is a 400, not a silent write.
        values=fields.Boolean(truthy={True}, falsy={False}),
        metadata={"description": "Per-extension enabled flags keyed by extension id."},
    )
