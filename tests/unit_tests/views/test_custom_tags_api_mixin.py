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
"""Tests for both renaming mechanisms in ``CustomTagsOptimizationMixin``.

The schema-level ``data_key`` rename only applies to the API's default list
schema; requests that pass ``select_columns`` make FAB build a fresh schema
on the fly, so for those the ``pre_get_list`` response rewrite is what keeps
the public ``tags`` name. Both paths need coverage.
"""

from typing import Any

from marshmallow import fields, Schema

from superset.views.custom_tags_api_mixin import CustomTagsOptimizationMixin


class BaseApi:
    """Stub for the FAB ``ModelRestApi`` base. The mixin chains via
    ``super()``, so the stub must define the hooks the mixin overrides."""

    list_model_schema: Schema
    pre_get_list_calls: int = 0

    def _init_model_schemas(self) -> None:
        self.list_model_schema = Schema.from_dict(
            {"custom_tags": fields.List(fields.String())}
        )()

    def pre_get_list(self, _data: dict[str, Any]) -> None:
        self.pre_get_list_calls += 1


class CustomTagsApi(CustomTagsOptimizationMixin, BaseApi):
    _custom_tags_only = True


class UnoptimizedTagsApi(CustomTagsOptimizationMixin, BaseApi):
    _custom_tags_only = False


def test_custom_tags_schema_uses_public_tags_name() -> None:
    api = CustomTagsApi()

    api._init_model_schemas()

    assert api.list_model_schema.dump({"custom_tags": ["critical"]}) == {
        "tags": ["critical"]
    }


def test_custom_tags_schema_keeps_name_when_optimization_disabled() -> None:
    api = UnoptimizedTagsApi()

    api._init_model_schemas()

    assert api.list_model_schema.dump({"custom_tags": ["critical"]}) == {
        "custom_tags": ["critical"]
    }


def test_pre_get_list_renames_custom_tags_when_enabled() -> None:
    api = CustomTagsApi()
    data: dict[str, Any] = {
        "result": [
            {"id": 1, "custom_tags": [{"name": "critical"}]},
            {"id": 2},
        ]
    }

    api.pre_get_list(data)

    assert data["result"][0] == {"id": 1, "tags": [{"name": "critical"}]}
    assert data["result"][1] == {"id": 2}
    assert api.pre_get_list_calls == 1


def test_pre_get_list_keeps_custom_tags_when_disabled() -> None:
    api = UnoptimizedTagsApi()
    data: dict[str, Any] = {"result": [{"id": 1, "custom_tags": []}]}

    api.pre_get_list(data)

    assert data["result"][0] == {"id": 1, "custom_tags": []}
    assert api.pre_get_list_calls == 1


def test_pre_get_list_tolerates_missing_result_key() -> None:
    api = CustomTagsApi()
    data: dict[str, Any] = {"count": 0}

    api.pre_get_list(data)

    assert data == {"count": 0}
    assert api.pre_get_list_calls == 1
