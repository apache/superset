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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access

from pytest import raises


def test_odbc_impersonation() -> None:
    """
    Test ``get_url_for_impersonation`` method when driver == odbc.

    The method adds the parameter ``DelegationUID`` to the query string.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.drill import DrillEngineSpec

    url = URL("drill+odbc")
    username = "DoAsUser"
    url = DrillEngineSpec.get_url_for_impersonation(url, True, username)
    assert url.query["DelegationUID"] == username


def test_jdbc_impersonation() -> None:
    """
    Test ``get_url_for_impersonation`` method when driver == jdbc.

    The method adds the parameter ``impersonation_target`` to the query string.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.drill import DrillEngineSpec

    url = URL("drill+jdbc")
    username = "DoAsUser"
    url = DrillEngineSpec.get_url_for_impersonation(url, True, username)
    assert url.query["impersonation_target"] == username


def test_sadrill_impersonation() -> None:
    """
    Test ``get_url_for_impersonation`` method when driver == sadrill.

    The method adds the parameter ``impersonation_target`` to the query string.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.drill import DrillEngineSpec

    url = URL("drill+sadrill")
    username = "DoAsUser"
    url = DrillEngineSpec.get_url_for_impersonation(url, True, username)
    assert url.query["impersonation_target"] == username


def test_invalid_impersonation() -> None:
    """
    Test ``get_url_for_impersonation`` method when driver == foobar.

    The method raises an exception because impersonation is not supported
    for drill+foobar.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.drill import DrillEngineSpec
    from superset.db_engine_specs.exceptions import SupersetDBAPIProgrammingError

    url = URL("drill+foobar")
    username = "DoAsUser"

    with raises(SupersetDBAPIProgrammingError):
        DrillEngineSpec.get_url_for_impersonation(url, True, username)
