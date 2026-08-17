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

from superset.views.custom_tags_api_mixin import CustomTagsOptimizationMixin


class BaseApi:
    list_model_schema: Schema

    def _init_model_schemas(self) -> None:
        self.list_model_schema = Schema.from_dict(
            {"custom_tags": fields.List(fields.String())}
        )()


class CustomTagsApi(CustomTagsOptimizationMixin, BaseApi):
    _custom_tags_only = True


def test_custom_tags_schema_uses_public_tags_name() -> None:
    api = CustomTagsApi()

    api._init_model_schemas()

    assert api.list_model_schema.dump({"custom_tags": ["critical"]}) == {
        "tags": ["critical"]
    }
