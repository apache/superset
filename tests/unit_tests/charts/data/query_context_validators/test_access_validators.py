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

from typing import Dict, Generator, Set, TYPE_CHECKING
from unittest.mock import call, Mock

import pytest
from pytest import fixture, mark

from tests.unit_tests.charts.data.query_context_validators.conftest import (
    AccessDeninedException,
    MockDatabase,
    MockDatasource,
)

if TYPE_CHECKING:
    from superset.charts.data.query_context_validators.access_validators import (
        SqlDatabaseBasedAccessValidator,
    )
    from superset.common.query_context import QueryContext


class TestSqlDatabaseBasedAccessValidator:
    class Base:
        access_validator: SqlDatabaseBasedAccessValidator
        query_context: QueryContext
        security_manager_mock: Mock
        dataset_dao_mock: Mock
        known_datasoutces: Dict[str, MockDatasource] = {}
        allowed_databases: Set[MockDatabase] = set()
        allowed_datasources: Set[MockDatasource] = set()

        @fixture(autouse=True)
        def set_validator(self, access_validator: SqlDatabaseBasedAccessValidator):
            self.access_validator = access_validator

        @fixture(autouse=True)
        def set_query_context(self, query_context: QueryContext):
            self.query_context = query_context

        @fixture(autouse=True)
        def set_security_manager_mock(self, security_manager_mock: Mock):
            security_manager_mock.can_access_database.side_effect = (
                lambda db: db in self.allowed_databases
            )

            def side_effect(datasource_to_check: MockDatasource) -> None:
                if datasource_to_check not in self.allowed_datasources:
                    raise AccessDeninedException()

            security_manager_mock.raise_for_datasource_access.side_effect = side_effect

            self.security_manager_mock = security_manager_mock

        @fixture(autouse=True)
        def set_dataset_dao_mock(self, dataset_dao_mock: Mock):
            def side_effect(database, table_name, _):
                rv_list = []
                if table_name in self.known_datasoutces:
                    rv_ds = self.known_datasoutces[table_name]
                    if rv_ds.database is database:
                        rv_list.append(rv_ds)
                return rv_list

            dataset_dao_mock.get_by_sql_database_components.side_effect = side_effect
            self.dataset_dao_mock = dataset_dao_mock

        @fixture
        def arrange_database_permission(self, database) -> Generator[None, None, None]:
            yield from self._set_allowed_db(database)

        def _set_allowed_db(self, database) -> Generator[None, None, None]:
            self.allowed_databases.add(database)
            yield
            self.allowed_databases.remove(database)

        @fixture
        def arrange_datasource_permission(
            self, datasource: MockDatasource
        ) -> Generator[None, None, None]:
            yield from self._set_allowed_ds(datasource)

        def _set_allowed_ds(self, datasource) -> Generator[None, None, None]:
            self.allowed_datasources.add(datasource)
            yield
            self.allowed_datasources.remove(datasource)

    class TestWithoutMetric(Base):
        @mark.usefixtures("arrange_all_database_permission")
        def test_when_actor_has_all_database_permission__validation_success(self):
            # act
            self.access_validator.validate(self.query_context)

            # assert
            self.security_manager_mock.can_access_all_databases.assert_called_once()
            self.security_manager_mock.can_access_all_datasources.assert_not_called()
            self.security_manager_mock.can_access_database.assert_not_called()
            self.security_manager_mock.raise_for_access.assert_not_called()
            self.security_manager_mock.raise_for_datasource_access.assert_not_called()
            self.dataset_dao_mock.get_by_sql_database_components.assert_not_called()

        @mark.usefixtures("arrange_all_datasources_permission")
        def test_when_actor_has_all_datasources_permission__validation_success(
            self,
        ):
            # act
            self.access_validator.validate(self.query_context)
            # assert
            self.security_manager_mock.can_access_all_databases.assert_called_once()
            self.security_manager_mock.can_access_all_datasources.assert_called_once()
            self.security_manager_mock.can_access_database.assert_not_called()
            self.security_manager_mock.raise_for_access.assert_not_called()
            self.security_manager_mock.raise_for_datasource_access.assert_not_called()
            self.dataset_dao_mock.get_by_sql_database_components.assert_not_called()

        @mark.usefixtures("arrange_database_permission")
        def test_when_actor_has_database_permission__validation_success(self):
            # act
            self.access_validator.validate(self.query_context)
            # assert
            self.security_manager_mock.can_access_all_databases.assert_called_once()
            self.security_manager_mock.can_access_all_datasources.assert_called_once()
            self.security_manager_mock.can_access_database.assert_called_once_with(
                self.query_context.datasource.database
            )
            self.security_manager_mock.raise_for_access.assert_not_called()
            self.security_manager_mock.raise_for_datasource_access.assert_not_called()
            self.dataset_dao_mock.get_by_sql_database_components.assert_not_called()

        @mark.usefixtures("arrange_datasource_permission")
        def test_when_actor_has_datasource_permission__validation_success(self):
            # act
            self.access_validator.validate(self.query_context)
            # assert
            self.security_manager_mock.can_access_all_databases.assert_called_once()
            self.security_manager_mock.can_access_all_datasources.assert_called_once()
            self.security_manager_mock.can_access_database.assert_called_once_with(
                self.query_context.datasource.database
            )
            self.security_manager_mock.raise_for_access.assert_not_called()
            self.security_manager_mock.raise_for_datasource_access.assert_called_once_with(
                self.query_context.datasource
            )
            self.dataset_dao_mock.get_by_sql_database_components.assert_not_called()

        def test_when_actor_doesnt_have_permissions__exception_is_raised(self):
            # act
            with pytest.raises(AccessDeninedException):
                self.access_validator.validate(self.query_context)
            # assert
            self.security_manager_mock.can_access_all_databases.assert_called_once()
            self.security_manager_mock.can_access_all_datasources.assert_called_once()
            self.security_manager_mock.can_access_database.assert_called_once_with(
                self.query_context.datasource.database
            )
            self.security_manager_mock.raise_for_access.assert_not_called()
            self.security_manager_mock.raise_for_datasource_access.assert_called_once_with(
                self.query_context.datasource
            )
            self.dataset_dao_mock.get_by_sql_database_components.assert_not_called()

    class TestWithSqLMetric(Base):
        @fixture(autouse=True)
        def arrange_datasources_for_dataset_mock(
            self, datasource, metric_datasource
        ) -> None:
            self.known_datasoutces[datasource.name] = datasource
            self.known_datasoutces[metric_datasource.name] = metric_datasource

        @fixture
        def arrange_metric_datasource_permission(
            self, metric_datasource: MockDatasource
        ) -> Generator[None, None, None]:
            yield from self._set_allowed_ds(metric_datasource)

        @fixture(autouse=True)
        def set_query_context(self, metric_query_context: QueryContext) -> None:
            self.query_context = metric_query_context

        @mark.usefixtures("arrange_database_permission")
        def test_when_actor_has_metric_database_permission__validation_success(
            self,
        ):
            # act
            self.access_validator.validate(self.query_context)
            # assert
            self.security_manager_mock.can_access_all_databases.assert_called_once()
            self.security_manager_mock.can_access_all_datasources.assert_called_once()
            self.security_manager_mock.can_access_database.assert_called_once_with(
                self.query_context.datasource.database
            )
            self.security_manager_mock.raise_for_access.assert_not_called()
            self.security_manager_mock.raise_for_datasource_access.assert_not_called()
            self.dataset_dao_mock.get_by_sql_database_components.assert_not_called()

        @mark.usefixtures(
            "arrange_datasource_permission", "arrange_metric_datasource_permission"
        )
        def test_when_actor_has_datasource_permission__validation_success(
            self, metric_datasource
        ):
            # act
            self.access_validator.validate(self.query_context)
            # assert
            self.security_manager_mock.can_access_all_databases.assert_called_once()
            self.security_manager_mock.can_access_all_datasources.assert_called_once()
            self.security_manager_mock.can_access_database.assert_called_once_with(
                self.query_context.datasource.database
            )
            self.security_manager_mock.raise_for_access.assert_not_called()
            assert (
                self.security_manager_mock.raise_for_datasource_access.call_args_list
                == [
                    call(self.query_context.datasource),
                    call(metric_datasource),
                ]
                or self.security_manager_mock.raise_for_datasource_access.call_args_list
                == [
                    call(metric_datasource),
                    call(self.query_context.datasource),
                ]
            )
            self.dataset_dao_mock.get_by_sql_database_components.assert_called_once_with(
                metric_datasource.database, metric_datasource.name, None
            )

        @mark.usefixtures("arrange_datasource_permission")
        def test_when_actor_doesnt_have_permissions__exception_is_raised(
            self, metric_datasource
        ):
            with pytest.raises(AccessDeninedException):
                self.access_validator.validate(self.query_context)
            # assert
            self.security_manager_mock.can_access_all_databases.assert_called_once()
            self.security_manager_mock.can_access_all_datasources.assert_called_once()
            self.security_manager_mock.can_access_database.assert_called_once_with(
                self.query_context.datasource.database
            )
            self.security_manager_mock.raise_for_access.assert_not_called()
            self.dataset_dao_mock.get_by_sql_database_components.assert_called_once_with(
                metric_datasource.database, metric_datasource.name, None
            )
