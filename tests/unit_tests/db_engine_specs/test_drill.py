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

from flask.ctx import AppContext


def test_odbc_impersonation(app_context: AppContext) -> None:
    """
    Test ``modify_url_for_impersonation`` method when driver == odbc.

    The method adds the parameter ``DelegationUID`` to the query string.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.drill import DrillEngineSpec

    url = URL("drill+odbc")
    username = "DoAsUser"
    DrillEngineSpec.modify_url_for_impersonation(url, True, username)
    assert url.query["DelegationUID"] == username


def test_jdbc_impersonation(app_context: AppContext) -> None:
    """
    Test ``modify_url_for_impersonation`` method when driver == jdbc.

    The method adds the parameter ``impersonation_target`` to the query string.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.drill import DrillEngineSpec

    url = URL("drill+jdbc")
    username = "DoAsUser"
    DrillEngineSpec.modify_url_for_impersonation(url, True, username)
    assert url.query["impersonation_target"] == username


def test_sadrill_impersonation(app_context: AppContext) -> None:
    """
    Test ``modify_url_for_impersonation`` method when driver == sadrill.

    The method changes the username of URL Object.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.drill import DrillEngineSpec

    url = URL("drill+sadrill")
    username = "DoAsUser"
    DrillEngineSpec.modify_url_for_impersonation(url, True, username)
    assert url.username == username
