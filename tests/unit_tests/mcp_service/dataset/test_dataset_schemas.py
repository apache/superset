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

import pytest

from superset.mcp_service.dataset.schemas import (
    DatasetFilter,
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

    def test_list_datasets_search_and_filters_conflict_validation(self) -> None:
        """search and filters are mutually exclusive on ListDatasetsRequest,
        inherited from PaginatedListRequest.validate_search_and_filters."""
        with pytest.raises(
            ValueError,
            match="Cannot use both 'search' and 'filters' parameters simultaneously",
        ):
            ListDatasetsRequest(
                search="sample",
                filters=[DatasetFilter(col="table_name", opr="sw", value="test")],
            )


class TestPartitionMappingFieldsAreServed:
    """Schema discovery enumerates the dataset model's own columns, so the two
    partition references are advertised as selectable automatically. They have
    to come back when a client selects them."""

    def test_discovery_advertises_them(self) -> None:
        from superset.connectors.sqla.models import SqlaTable
        from superset.mcp_service.common.schema_discovery import (
            DATASET_DEFAULT_COLUMNS,
            get_columns_from_model,
        )

        names = {
            column.name
            for column in get_columns_from_model(SqlaTable, DATASET_DEFAULT_COLUMNS)
        }

        assert {"partition_column", "partition_mapped_column"} <= names

    def test_the_serializer_returns_them(self) -> None:
        """
        A client that follows discovery and selects these got neither field
        back and no error, because `DatasetInfo` and the serializer did not
        carry them.
        """
        from types import SimpleNamespace

        from superset.mcp_service.dataset.schemas import serialize_dataset_object

        dataset = SimpleNamespace(
            id=1,
            table_name="orders",
            schema="main",
            database=SimpleNamespace(database_name="examples"),
            description=None,
            certified_by=None,
            certification_details=None,
            changed_on=None,
            created_on=None,
            tags=[],
            editors=[],
            is_virtual=False,
            database_id=1,
            uuid=None,
            deleted_at=None,
            schema_perm=None,
            sql=None,
            main_dttm_col="event_time",
            partition_column="dt_epoch",
            partition_mapped_column="event_time",
            offset=0,
            cache_timeout=0,
            params=None,
            template_params=None,
            extra=None,
            columns=[],
            metrics=[],
        )

        info = serialize_dataset_object(dataset)

        assert info is not None
        assert info.partition_column == "dt_epoch"
        assert info.partition_mapped_column == "event_time"

    def test_a_dataset_without_a_mapping_reports_neither(self) -> None:
        """Both are null on any dataset that has no mapping, which is most."""
        from types import SimpleNamespace

        from superset.mcp_service.dataset.schemas import serialize_dataset_object

        dataset = SimpleNamespace(
            id=1,
            table_name="orders",
            schema="main",
            database=SimpleNamespace(database_name="examples"),
            description=None,
            certified_by=None,
            certification_details=None,
            changed_on=None,
            created_on=None,
            tags=[],
            editors=[],
            is_virtual=False,
            database_id=1,
            uuid=None,
            deleted_at=None,
            schema_perm=None,
            sql=None,
            main_dttm_col=None,
            partition_column=None,
            partition_mapped_column=None,
            offset=0,
            cache_timeout=0,
            params=None,
            template_params=None,
            extra=None,
            columns=[],
            metrics=[],
        )

        info = serialize_dataset_object(dataset)

        assert info is not None
        assert info.partition_column is None
        assert info.partition_mapped_column is None
