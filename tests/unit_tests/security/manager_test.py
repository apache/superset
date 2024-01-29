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

import pytest
from pytest_mock import MockFixture

from superset.common.query_object import QueryObject
from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.security.manager import SupersetSecurityManager


def test_security_manager(app_context: None) -> None:
    """
    Test that the security manager can be built.
    """
    sm = SupersetSecurityManager(appbuilder)
    assert sm


def test_raise_for_access_guest_user(
    mocker: MockFixture,
    app_context: None,
) -> None:
    """
    Test that guest user can't modify chart payload.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    stored_metrics = [
        {
            "aggregate": None,
            "column": None,
            "datasourceWarning": False,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 1",
            "optionName": "metric_ssa1gwimio_cxpyjc7vj3s",
            "sqlExpression": "COUNT(*) + 1",
        }
    ]
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    # normal request
    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    sm.raise_for_access(query_context=query_context)

    # tampered requests
    query_context.form_data = {
        "slice_id": 43,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)

    tampered_metrics = [
        {
            "aggregate": None,
            "column": None,
            "datasourceWarning": False,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 2",
            "optionName": "metric_ssa1gwimio_cxpyjc7vj3s",
            "sqlExpression": "COUNT(*) + 2",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "metrics": tampered_metrics,
    }
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)

    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=tampered_metrics)]  # type: ignore
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_query_default_schema(
    mocker: MockFixture,
    app_context: None,
) -> None:
    """
    Test that the DB default schema is used in non-qualified table names.

    For example, in Postgres, for the following query:

        > SELECT * FROM foo;

    We should check that the user has access to the `public` schema, regardless of the
    schema set in the query.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "get_schema_perm", return_value="[PostgreSQL].[public]")
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")
    SqlaTable.query_datasources_by_name.return_value = []

    database = mocker.MagicMock()
    database.get_default_schema_for_query.return_value = "public"
    query = mocker.MagicMock()
    query.database = database
    query.sql = "SELECT * FROM ab_user"

    # user has access to `public` schema
    mocker.patch.object(sm, "can_access", return_value=True)
    assert (
        sm.raise_for_access(  # type: ignore
            database=None,
            datasource=None,
            query=query,
            query_context=None,
            table=None,
            viz=None,
        )
        is None
    )
    sm.can_access.assert_called_with("schema_access", "[PostgreSQL].[public]")  # type: ignore

    # user has only access to `secret` schema
    mocker.patch.object(sm, "can_access", return_value=False)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(
            database=None,
            datasource=None,
            query=query,
            query_context=None,
            table=None,
            viz=None,
        )
    assert (
        str(excinfo.value)
        == """You need access to the following tables: `public.ab_user`,
            `all_database_access` or `all_datasource_access` permission"""
    )
