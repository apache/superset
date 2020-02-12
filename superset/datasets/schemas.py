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


class DatasetPostSchema(Schema):
    database = fields.Integer(required=True)
    schema = fields.String(validate=Length(0, 250))
    table_name = fields.String(required=True, allow_none=False, validate=Length(1, 250))
    owners = fields.List(fields.Integer())


class DatasetPutSchema(Schema):
    table_name = fields.String(allow_none=True, validate=Length(1, 250))
    sql = fields.String(allow_none=True)
    filter_select_enabled = fields.Boolean(allow_none=True)
    fetch_values_predicate = fields.String(allow_none=True, validate=Length(0, 1000))
    schema = fields.String(allow_none=True, validate=Length(1, 255))
    description = fields.String(allow_none=True)
    main_dttm_col = fields.String(allow_none=True)
    offset = fields.Integer(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
    is_sqllab_view = fields.Boolean(allow_none=True)
    template_params = fields.String(allow_none=True)
    owners = fields.List(fields.Integer())
