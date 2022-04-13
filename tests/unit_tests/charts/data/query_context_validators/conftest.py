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
from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any, Dict, Generator, TYPE_CHECKING
from unittest.mock import Mock

from pytest import fixture

from superset.charts.data.query_context_validators import QueryContextValidator
from superset.charts.data.query_context_validators.access_validators import (
    SqlDatabaseBasedAccessValidator,
)
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from tests.common.query_context_generator import QueryContextGenerator

if TYPE_CHECKING:
    from superset import SupersetSecurityManager
    from superset.datasets.dao import DatasetDAO


@dataclass(unsafe_hash=True)
class MockDatabase:
    id: int


class MockDatasource:
    id: int
    type: str
    name: str
    database: MockDatabase

    def __init__(self, id: int, name: str, type: str, database: MockDatabase) -> None:
        self.id = id
        self.name = name
        self.type = type
        self.database = database

    @staticmethod
    def create(
        datasource_dict: Dict[str, Any], database: MockDatabase
    ) -> MockDatasource:
        return MockDatasource(
            datasource_dict["id"],
            datasource_dict["datasource_name"],
            datasource_dict["type"],
            database,
        )


@fixture
def datasource_id() -> int:
    return 1


@fixture
def metric_datasource_id(datasource_id: int) -> int:
    return datasource_id + 1


@fixture
def database_id() -> int:
    return 1


@fixture
def metric_database_id(database_id: int) -> int:
    return database_id + 1


@fixture
def datasource_name() -> str:
    return "table"


@fixture
def metric_datasource_name(datasource_name) -> str:
    return "metric_" + datasource_name


@fixture
def datasource_type() -> str:
    return "table"


@fixture
def database(database_id: int) -> MockDatabase:
    return MockDatabase(database_id)


@fixture
def datasource_dict(
    datasource_id: int, datasource_name: str, datasource_type: str
) -> Dict[str, Any]:
    return {
        "id": datasource_id,
        "datasource_name": datasource_name,
        "type": datasource_type,
    }


@fixture
def metric_datasource_dict(
    metric_datasource_id: int, metric_datasource_name: str, datasource_type: str
) -> Dict[str, Any]:
    return {
        "id": metric_datasource_id,
        "datasource_name": metric_datasource_name,
        "type": datasource_type,
    }


@fixture
def datasource(
    datasource_dict: Dict[str, Any], database: MockDatabase
) -> MockDatasource:
    return MockDatasource.create(datasource_dict, database)


@fixture
def metric_datasource(
    metric_datasource_dict: Dict[str, Any], database: MockDatabase
) -> MockDatasource:
    return MockDatasource.create(metric_datasource_dict, database)


@fixture
def processor() -> Mock:
    return Mock()


@fixture
def query_context(datasource: MockDatasource, processor: Mock) -> QueryContext:
    return create_query_context(datasource, [], processor)


def create_query_context(
    datasource: MockDatasource, queries, processor: Mock
) -> QueryContext:
    qc = QueryContext(
        datasource=datasource,  # type: ignore
        queries=queries,
        form_data=None,
        result_format=ChartDataResultFormat.JSON,
        result_type=ChartDataResultType.FULL,
        cache_values={},
    )
    qc.set_processor(processor)
    return qc


@fixture
def metric_query_context(
    datasource: MockDatasource, metric_datasource: MockDatasource, processor: Mock
) -> QueryContext:
    generator = QueryContextGenerator()
    query_obj = generator.generate_query_object(datasource.name, False, False)
    query_obj["metrics"].append(
        generator.generate_sql_expression_metric("name", metric_datasource.name)
    )
    return create_query_context(
        datasource,
        [QueryObject(datasource=metric_datasource, **query_obj)],  # type: ignore
        processor,
    )


class AccessDeninedException(Exception):
    def __init__(self, *args, **kwargs):
        super().__init__()


@fixture
def dataset_dao_mock() -> DatasetDAO:
    return Mock(spec=["get_by_sql_database_components"])


@fixture
def security_manager_mock() -> Mock:
    mock = Mock()
    mock.can_access_all_databases.return_value = False
    mock.can_access_all_datasources.return_value = False
    mock.can_access_database.return_value = False
    mock.raise_for_access.side_effect = AccessDeninedException
    mock.raise_when_there_is_no_access_to.side_effect = AccessDeninedException
    return mock


@fixture
def access_validator(
    dataset_dao_mock: DatasetDAO, security_manager_mock: SupersetSecurityManager
) -> QueryContextValidator:
    return SqlDatabaseBasedAccessValidator(security_manager_mock, dataset_dao_mock)


@fixture
def arrange_all_database_permission(
    security_manager_mock: Mock,
) -> Generator[None, None, None]:
    security_manager_mock.can_access_all_databases.return_value = True
    yield
    security_manager_mock.can_access_all_databases.return_value = False


@fixture
def arrange_all_datasources_permission(
    security_manager_mock: Mock,
) -> Generator[None, None, None]:
    security_manager_mock.can_access_all_datasources.return_value = True
    yield
    security_manager_mock.can_access_all_datasources.return_value = False


def set_can_access_database_mock(
    security_manager_mock, database: MockDatabase
) -> Generator[None, None, None]:
    security_manager_mock.can_access_database.side_effect = lambda db: db is database
    yield
    security_manager_mock.can_access_database.return_value = False
