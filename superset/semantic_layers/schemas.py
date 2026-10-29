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


class SemanticViewPutSchema(Schema):
    description = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)


class SemanticLayerPostSchema(Schema):
    name = fields.String(required=True)
    description = fields.String(allow_none=True)
    type = fields.String(required=True)
    configuration = fields.Dict(required=True)
    cache_timeout = fields.Integer(allow_none=True)


class SemanticLayerPutSchema(Schema):
    name = fields.String()
    description = fields.String(allow_none=True)
    configuration = fields.Dict()
    cache_timeout = fields.Integer(allow_none=True)


class SemanticViewPostSchema(Schema):
    name = fields.String(required=True)
    semantic_layer_uuid = fields.String(required=True)
    configuration = fields.Dict(load_default=dict)
    description = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
