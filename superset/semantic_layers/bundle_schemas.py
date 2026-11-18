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
"""ORM-free serialized references for semantic-view bundles."""

from typing import Any

from marshmallow import fields, Schema, validate


class SemanticViewReferenceSchema(Schema):
    """A semantic reference never carries configuration or an environment-local ID."""

    type: fields.String = fields.String(
        required=True, validate=validate.Equal("semantic_view")
    )
    uuid: fields.UUID = fields.UUID(required=True)


def reference_uuid(reference: Any) -> str:
    """Validate the closed reference shape and canonicalize its UUID."""
    parsed: dict[str, Any] = SemanticViewReferenceSchema().load(reference)
    return str(parsed["uuid"])
