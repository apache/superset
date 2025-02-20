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

from pytest import fixture  # noqa: PT013

from tests.example_data.data_loading.pandas.pandas_data_loader import PandasDataLoader
from tests.example_data.data_loading.pandas.pands_data_loading_conf import (
    PandasLoaderConfigurations,
)
from tests.example_data.data_loading.pandas.table_df_convertor import (
    TableToDfConvertorImpl,
)
from tests.integration_tests.dashboard_utils import (
    create_dashboard as create_dashboard_fixture,
    create_slice as create_slice_fixture,
    create_table_metadata as create_table_metadata_fixture,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices as load_birth_names_dash_with_slices_fixture,
    load_birth_names_data as load_birth_names_data_fixture,
)
from tests.integration_tests.fixtures.dashboard_with_tabs import (
    load_mutltiple_tabs_dashboard as load_mutltiple_tabs_dashboard_fixture,
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data as load_energy_table_data_fixture,
    load_energy_table_with_slice as load_energy_table_with_slice_fixture,
)
from tests.integration_tests.fixtures.public_role import (
    public_role_like_gamma as public_role_like_gamma_fixture,
)
from tests.integration_tests.fixtures.tabbed_dashboard import (
    tabbed_dashboard as tabbed_dashboard_fixture,
)
from tests.integration_tests.fixtures.unicode_dashboard import (
    load_unicode_dashboard_with_position as load_unicode_dash_with_position_fixture,
    load_unicode_data as load_unicode_data_fixture,
)
from tests.integration_tests.fixtures.users import (
    create_gamma_sqllab_no_data as create_gamma_sqllab_no_data_fixture,
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices as load_world_bank_dash_with_slices_fixture,
    load_world_bank_data as load_world_bank_data_fixture,
)
from tests.integration_tests.test_app import app
from tests.unit_tests.fixtures.common import (
    admin_user as admin_user_fixture,
    after_each as after_each_fixture,
    dttm as dttm_fixture,
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
def tabbed_dashboard():
    return tabbed_dashboard_fixture


@fixture(scope="session")
def load_mutltiple_tabs_dashboard():
    return load_mutltiple_tabs_dashboard_fixture


@fixture(scope="session")
def create_dashboard():
    return create_dashboard_fixture


@fixture(scope="session")
def create_slice():
    return create_slice_fixture


@fixture(scope="session")
def create_table_metadata():
    return create_table_metadata_fixture


@fixture(scope="session")
def create_gamma_sqllab_no_data():
    return create_gamma_sqllab_no_data_fixture


@fixture(scope="session")
def public_role_like_gamma():
    return public_role_like_gamma_fixture


@fixture(scope="session")
def load_unicode_dashboard_with_position():
    return load_unicode_dash_with_position_fixture


@fixture(scope="session")
def load_unicode_data():
    return load_unicode_data_fixture


@fixture(scope="session")
def load_birth_names_dashboard_with_slices():
    return load_birth_names_dash_with_slices_fixture


@fixture(scope="session")
def load_birth_names_data():
    return load_birth_names_data_fixture


@fixture(scope="session")
def load_world_bank_dashboard_with_slices():
    return load_world_bank_dash_with_slices_fixture


@fixture(scope="session")
def load_world_bank_data():
    return load_world_bank_data_fixture


@fixture(scope="session")
def load_energy_table_with_slice():
    return load_energy_table_with_slice_fixture


@fixture(scope="session")
def load_energy_table_data():
    return load_energy_table_data_fixture


@fixture(scope="session")
def dttm():
    return dttm_fixture


@fixture(scope="session")
def after_each():
    return after_each_fixture


@fixture(scope="session")
def admin_user():
    return admin_user_fixture


@fixture(scope="session")
def example_db_provider() -> Callable[[], Database]:
    def mock_provider() -> Mock:
        mock = MagicMock()
        type(mock).backend = PropertyMock(return_value=BACKEND_PROPERTY_VALUE)
        return mock

    return mock_provider


@fixture(scope="session")
def example_db_engine(example_db_provider: Callable[[], Database]) -> Engine:
    with app.app_context():
        with example_db_provider().get_sqla_engine() as engine:
            return engine


@fixture(scope="session")
def pandas_loader_configuration(
    support_datetime_type,
) -> PandasLoaderConfigurations:
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
