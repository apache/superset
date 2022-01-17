#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from __future__ import annotations

from typing import Callable, TYPE_CHECKING
from unittest.mock import MagicMock, Mock, PropertyMock

from pytest import fixture

from tests.example_data.data_loading.pandas.pandas_data_loader import PandasDataLoader
from tests.example_data.data_loading.pandas.pands_data_loading_conf import (
    PandasLoaderConfigurations,
)
from tests.example_data.data_loading.pandas.table_df_convertor import (
    TableToDfConvertorImpl,
)

SUPPORT_DATETIME_TYPE = "support_datetime_type"

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine

    from superset.connectors.sqla.models import Database
    from tests.example_data.data_loading.base_data_loader import DataLoader
    from tests.example_data.data_loading.pandas.pandas_data_loader import (
        TableToDfConvertor,
    )

pytest_plugins = "tests.fixtures"

PRESTO = "presto"
BACKEND_PROPERTY_VALUE = "sqlite"


@fixture(scope="session")
def example_db_provider() -> Callable[[], Database]:
    def mock_provider() -> Mock:
        mock = MagicMock()
        type(mock).backend = PropertyMock(return_value=BACKEND_PROPERTY_VALUE)
        return mock

    return mock_provider


@fixture(scope="session")
def example_db_engine(example_db_provider: Callable[[], Database]) -> Engine:
    return example_db_provider().get_sqla_engine()


@fixture(scope="session")
def pandas_loader_configuration(support_datetime_type,) -> PandasLoaderConfigurations:
    return PandasLoaderConfigurations.make_from_dict(
        {SUPPORT_DATETIME_TYPE: support_datetime_type}
    )


@fixture(scope="session")
def support_datetime_type(example_db_provider: Callable[[], Database]) -> bool:
    return example_db_provider().backend != PRESTO


@fixture(scope="session")
def table_to_df_convertor(
    pandas_loader_configuration: PandasLoaderConfigurations,
) -> TableToDfConvertor:
    return TableToDfConvertorImpl(
        not pandas_loader_configuration.support_datetime_type,
        pandas_loader_configuration.strftime,
    )


@fixture(scope="session")
def data_loader(
    example_db_engine: Engine,
    pandas_loader_configuration: PandasLoaderConfigurations,
    table_to_df_convertor: TableToDfConvertor,
) -> DataLoader:
    return PandasDataLoader(
        example_db_engine, pandas_loader_configuration, table_to_df_convertor
    )
