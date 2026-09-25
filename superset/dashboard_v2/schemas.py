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
from marshmallow import fields, Schema
from marshmallow.validate import Length

_document_description = (
    "Dashboard v2 document: {version, nodes: {<id>: {type, layout, children, "
    "props, style}}}. A node with children is a container; any other node is a "
    "block addressed by its id."
)


class DashboardV2PostSchema(Schema):
    dashboard_title = fields.String(required=True, validate=Length(1, 500))
    document = fields.Dict(
        required=True, metadata={"description": _document_description}
    )


class DashboardV2PutSchema(Schema):
    dashboard_title = fields.String(validate=Length(1, 500))
    document = fields.Dict(
        required=True, metadata={"description": _document_description}
    )


class EmbeddedConfigSummarySchema(Schema):
    uuid = fields.String()
    allowed_domains = fields.List(fields.String())


class DashboardV2ResponseSchema(Schema):
    id = fields.Integer()
    uuid = fields.String()
    dashboard_title = fields.String()
    changed_on = fields.DateTime(allow_none=True)
    document = fields.Dict(metadata={"description": _document_description})
    embedded = fields.Nested(EmbeddedConfigSummarySchema, allow_none=True)
