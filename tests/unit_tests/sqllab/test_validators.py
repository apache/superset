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
from unittest.mock import patch, Mock, MagicMock
from pytest import fixture, raises, mark
from superset.sqllab.validators import CanAccessQueryValidatorImpl

from superset.security.manager import SupersetSecurityManager

@fixture
def can_access_query_validator() -> CanAccessQueryValidatorImpl:
    return CanAccessQueryValidatorImpl()

@fixture
def query() -> Mock:
    return Mock()


@mark.ofek
@patch("superset.sqllab.validators.security_manager")
class TestCanAccessQueryValidatorImpl:
    def test_when_security_manager_raise_error(self, mocked_security_manager: Mock, query: Mock,
                                               can_access_query_validator: CanAccessQueryValidatorImpl):
        def raise_exception(query):
            raise Exception()
        mocked_security_manager.raise_for_access.side_effect = raise_exception

        with raises(Exception):
            can_access_query_validator.validate(query)

        mocked_security_manager.raise_for_access.assert_called_once_with(query=query)


    def test_when_security_manager_does_not_raise_error(self, security_manager: Mock,
                                                query: Mock,
                                               can_access_query_validator: CanAccessQueryValidatorImpl):

        can_access_query_validator.validate(query)

        security_manager.raise_for_access.assert_called_once_with(query=query)


from flask_appbuilder import AppBuilder

@fixture
def appbuilder() -> Mock:
    return MagicMock(AppBuilder)


@fixture
def security_manager(appbuilder) -> SupersetSecurityManager:
    return SupersetSecurityManager(appbuilder)


class TestSecurityManagerRaiseForAccess:
    def test_when_user_is_admin__can_access_all(self, security_manager: SupersetSecurityManager):
        security_manager.raise_for_access("")

    def test_when_user_has_only_all_database_permission__can_access_all(self):
        pass

    def test_when_user_has_only_specific_database_permission__can_access_specific(self):
        pass

    def test_when_user_has_only_all_schemas_permission__can_access_all(self):
        pass

    def test_when_user_has_only_specific_schema_permission__can_access_specific(
        self):
        pass

    def test_when_user_has_only_all_datasources_permission__can_access_all(self):
        pass

    def test_when_user_has_only_specific_datasource_permission__can_access_specific(
        self):
        pass
