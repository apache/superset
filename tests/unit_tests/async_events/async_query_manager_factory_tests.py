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
from unittest import mock

from flask import current_app
from pytest import fixture

from superset.async_events.async_query_manager import AsyncQueryManager
from superset.async_events.async_query_manager_factory import AsyncQueryManagerFactory

JWT_TOKEN_SECRET = "some_secret"
JWT_TOKEN_COOKIE_NAME = "superset_async_jwt"


@fixture
def async_query_manager():
    query_manager = AsyncQueryManager()
    query_manager._jwt_secret = JWT_TOKEN_SECRET
    query_manager._jwt_cookie_name = JWT_TOKEN_COOKIE_NAME

    return query_manager


def test_init_app():
    # mock a secret lenght larger than 32
    current_app.config["GLOBAL_ASYNC_QUERIES_JWT_SECRET"] = "test_secret" * 10
    query_manager_factory = AsyncQueryManagerFactory()
    query_manager_factory.init_app(current_app)
    assert query_manager_factory._async_query_manager is not None


@mock.patch("superset.is_feature_enabled", return_value=False)
def test_get_instance_with_feature_flag_off(mock_is_feature_enabled):
    query_manager_factory = AsyncQueryManagerFactory()
    manager_instance = query_manager_factory.instance()
    assert manager_instance is None


@mock.patch("superset.is_feature_enabled", return_value=True)
def test_get_instance_with_feature_flag_on(mock_is_feature_enabled):
    current_app.config["GLOBAL_ASYNC_QUERIES_JWT_SECRET"] = "test_secret" * 10
    query_manager_factory = AsyncQueryManagerFactory()
    manager_instance = query_manager_factory.instance()
    assert manager_instance is not None
