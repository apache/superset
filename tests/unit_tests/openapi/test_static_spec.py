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

from pathlib import Path

from superset.utils import json


def test_documented_dashboard_list_schema_matches_public_contract() -> None:
    """The published dashboard list contract must use generated relationships."""
    spec_path = (
        Path(__file__).parents[3] / "docs" / "static" / "resources" / "openapi.json"
    )
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    schemas = spec["components"]["schemas"]
    schema_name = "DashboardRestApi.get_list"
    properties = schemas[schema_name]["properties"]

    result_items = spec["paths"]["/api/v1/dashboard/"]["get"]["responses"]["200"][
        "content"
    ]["application/json"]["schema"]["properties"]["result"]["items"]
    assert result_items == {"$ref": f"#/components/schemas/{schema_name}"}

    assert "description" in properties
    assert {"owners", "roles", "thumbnail_url"}.isdisjoint(properties)

    relationship_refs = {
        "editors": "DashboardRestApi.get_list.Subject",
        "tags": "DashboardRestApi.get_list.Tag",
        "viewers": "DashboardRestApi.get_list.Subject1",
    }
    for field_name, component_name in relationship_refs.items():
        assert properties[field_name] == {
            "items": {"$ref": f"#/components/schemas/{component_name}"},
            "type": "array",
        }
        assert component_name in schemas

    assert f"{schema_name}.Role" not in schemas
    assert f"{schema_name}.User2" not in schemas
