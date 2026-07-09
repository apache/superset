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

"""
Unit tests for MCP dataset schema validation.
"""

from superset.mcp_service.dataset.schemas import (
    GetDatasetInfoRequest,
    ListDatasetsRequest,
)


class TestRequestSchemaAliasChoices:
    """Test that LLM-friendly field name variants are accepted on the
    dataset MCP tool request schemas, so callers sending 'id'/'dataset_id'
    instead of 'identifier' (or 'columns' instead of 'select_columns')
    don't silently have the field dropped."""

    def test_get_dataset_info_identifier_id_alias(self) -> None:
        req = GetDatasetInfoRequest.model_validate({"id": 42})
        assert req.identifier == 42

    def test_get_dataset_info_identifier_dataset_id_alias(self) -> None:
        req = GetDatasetInfoRequest.model_validate({"dataset_id": 42})
        assert req.identifier == 42

    def test_get_dataset_info_identifier_still_works(self) -> None:
        req = GetDatasetInfoRequest.model_validate({"identifier": 42})
        assert req.identifier == 42

    def test_get_dataset_info_select_columns_columns_alias(self) -> None:
        req = GetDatasetInfoRequest.model_validate(
            {"id": 42, "columns": ["id", "table_name"]}
        )
        assert req.select_columns == ["id", "table_name"]

    def test_list_datasets_select_columns_columns_alias(self) -> None:
        req = ListDatasetsRequest.model_validate({"columns": ["id", "table_name"]})
        assert req.select_columns == ["id", "table_name"]
