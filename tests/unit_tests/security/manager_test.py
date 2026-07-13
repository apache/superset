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

# pylint: disable=invalid-name, unused-argument, redefined-outer-name

import json  # noqa: TID251
from types import SimpleNamespace
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import Database, SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.models.slice import Slice
from superset.security.manager import (
    _collect_sortable_identifiers,
    freeze_value,
    query_context_modified,
    SupersetSecurityManager,
)
from superset.sql.parse import Table
from superset.superset_typing import AdhocColumn, AdhocMetric
from superset.utils.core import DatasourceName, override_user


def test_security_manager(app_context: None) -> None:
    """
    Test that the security manager can be built.
    """
    sm = SupersetSecurityManager(appbuilder)
    assert sm


@pytest.fixture
def stored_metrics() -> list[AdhocMetric]:
    """
    Return a list of metrics.
    """
    return [
        {
            "column": None,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 1",
            "sqlExpression": "COUNT(*) + 1",
        },
    ]


@pytest.fixture
def stored_columns() -> list[AdhocColumn]:
    """
    Return a list of columns.
    """
    return [
        {
            "label": "My column",
            "sqlExpression": "UPPER(name)",
        },
    ]


def test_raise_for_access_guest_user_ok(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user can submit an unmodified chart payload.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
        "columns": stored_columns,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
        "columns": stored_columns,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_subset(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user can submit a request of a subset of the metrics/columns.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
        "columns": stored_columns,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": [],
        "columns": [],
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_id(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test that guest user cannot modify the chart ID.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    query_context.form_data = {
        "slice_id": 43,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_form_data_metrics(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test that guest user cannot modify metrics in the form data.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    tampered_metrics = [
        {
            "column": None,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 2",
            "sqlExpression": "COUNT(*) + 2",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "metrics": tampered_metrics,
    }
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_form_data_columns(
    mocker: MockerFixture,
    app_context: None,
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user cannot modify columns in the form data.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": stored_columns,
    }

    tampered_columns = [
        {
            "label": "My column",
            "sqlExpression": "list_secret()",
            "expressionType": "SQL",
        },
    ]

    query_context.form_data = {
        "slice_id": 42,
        "columns": tampered_columns,
    }
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_form_data_groupby(
    mocker: MockerFixture,
    app_context: None,
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user cannot modify groupby in the form data.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "groupby": stored_columns,
    }

    tampered_columns = [
        {
            "label": "My column",
            "sqlExpression": "list_secret()",
            "expressionType": "SQL",
        },
    ]

    query_context.form_data = {
        "slice_id": 42,
        "columns": tampered_columns,
    }
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_queries_metrics(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test that guest user cannot modify metrics in the queries.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    tampered_metrics = [
        {
            "column": None,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 2",
            "sqlExpression": "COUNT(*) + 2",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=tampered_metrics)]  # type: ignore
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_queries_columns(
    mocker: MockerFixture,
    app_context: None,
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user cannot modify columns in the queries.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": stored_columns,
    }

    tampered_columns = [
        {
            "label": "My column",
            "sqlExpression": "list_secret()",
            "expressionType": "SQL",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "columns": stored_columns,
    }
    query_context.queries = [QueryObject(metrics=tampered_columns)]  # type: ignore
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_query_default_schema(
    mocker: MockerFixture,
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
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    query = mocker.MagicMock()
    query.catalog = None
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
        == 'You need access to the following tables: "public.ab_user", '
        "'all_database_access' or 'all_datasource_access' permission"
    )


def test_raise_for_access_jinja_sql(mocker: MockerFixture, app_context: None) -> None:
    """
    Test that Jinja gets rendered to SQL.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "get_schema_perm", return_value="[PostgreSQL].[public]")
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    get_table_access_error_object = mocker.patch.object(
        sm, "get_table_access_error_object"
    )
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    query = mocker.MagicMock()
    query.catalog = None
    query.database = database
    query.sql = "SELECT * FROM {% if True %}ab_user{% endif %} WHERE 1=1"

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(
            database=None,
            datasource=None,
            query=query,
            query_context=None,
            table=None,
            viz=None,
        )

    get_table_access_error_object.assert_called_with({Table("ab_user", "public", None)})


def test_raise_for_access_chart_for_datasource_permission(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that the security manager can raise an exception for chart access,
    when the user does not have access to the chart datasource
    """
    sm = SupersetSecurityManager(appbuilder)
    session = sm.session

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    alpha = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Alpha")],
    )

    dataset = SqlaTable(
        table_name="test_table",
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.flush()

    slice = Slice(
        id=1,
        datasource_id=dataset.id,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
    )
    session.add(slice)
    session.flush()

    mocker.patch.object(sm, "can_access_datasource", return_value=False)
    with override_user(alpha):
        with pytest.raises(SupersetSecurityException) as excinfo:
            sm.raise_for_access(
                chart=slice,
            )
        assert str(excinfo.value) == "You don't have access to this chart."

    mocker.patch.object(sm, "can_access_datasource", return_value=True)
    with override_user(alpha):
        sm.raise_for_access(
            chart=slice,
        )


def test_raise_for_access_chart_on_admin(
    app_context: None,
) -> None:
    """
    Test that the security manager can raise an exception for chart access,
    when the user does not have access to the chart datasource
    """
    from flask_appbuilder.security.sqla.models import Role, User

    from superset.models.slice import Slice
    from superset.utils.core import override_user

    sm = SupersetSecurityManager(appbuilder)
    session = sm.session

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    slice = Slice(
        id=1,
        datasource_id=1,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
    )
    session.add(slice)
    session.flush()

    with override_user(admin):
        sm.raise_for_access(
            chart=slice,
        )


def test_raise_for_access_chart_editor(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that the security manager allows chart access for editors,
    even when the user does not have direct datasource access.
    """
    from tests.integration_tests.base_tests import subjects_from_users

    sm = SupersetSecurityManager(appbuilder)
    session = sm.session

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    # Check if Alpha role already exists
    alpha_role = session.query(Role).filter_by(name="Alpha").first()
    if not alpha_role:
        alpha_role = Role(name="Alpha")
        session.add(alpha_role)
        session.commit()

    # Check if user already exists
    alpha = session.query(User).filter_by(username="test_chart_owner_user").first()
    if not alpha:
        alpha = User(
            first_name="Alice",
            last_name="Doe",
            email="adoe@example.org",
            username="test_chart_owner_user",
            roles=[alpha_role],
        )
        session.add(alpha)
        session.commit()
    else:
        # Ensure the user has the Alpha role
        if alpha_role not in alpha.roles:
            alpha.roles.append(alpha_role)
            session.commit()

    # Sync the Subject row for alpha (same as production hook)
    from superset.subjects.sync import sync_user_subject

    sync_user_subject(alpha)
    session.commit()

    slice = Slice(
        id=1,
        datasource_id=1,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
        editors=subjects_from_users([alpha]),
    )
    session.add(slice)

    with override_user(alpha):
        sm.raise_for_access(
            chart=slice,
        )


def test_query_context_modified(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test the `query_context_modified` function.

    The function is used to ensure guest users are not modifying the request payload on
    embedded dashboard, preventing users from modifying it to access metrics different
    from the ones stored in dashboard charts.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    assert not query_context_modified(query_context)


def test_query_context_modified_tampered(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test the `query_context_modified` function when the request is tampered with.

    The function is used to ensure guest users are not modifying the request payload on
    embedded dashboard, preventing users from modifying it to access metrics different
    from the ones stored in dashboard charts.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    tampered_metrics = [
        {
            "column": None,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 2",
            "sqlExpression": "COUNT(*) + 2",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "metrics": tampered_metrics,
    }
    query_context.queries = [QueryObject(metrics=tampered_metrics)]  # type: ignore
    assert query_context_modified(query_context)


def _native_filter_ctx(
    mocker: MockerFixture,
    queries: list[Any],
    *,
    native_filter_id: str | None = "F1",
    dashboard_id: int | None = 10,
    dataset_id: int = 20,
    targets: list[Any] | None = None,
    control_values: dict[str, Any] | None = None,
) -> Any:
    """Build a native-filter query context (no slice_) + patched dashboard."""
    if targets is None:
        targets = [{"datasetId": dataset_id, "column": {"name": "region"}}]
    qc = mocker.MagicMock()
    qc.slice_ = None
    qc.form_data = {
        "type": "NATIVE_FILTER",
        "native_filter_id": native_filter_id,
        "dashboardId": dashboard_id,
    }
    qc.datasource.data = {"id": dataset_id}
    qc.queries = queries
    dash = mocker.MagicMock()
    dash.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {
                    "id": "F1",
                    "targets": targets,
                    "controlValues": control_values or {},
                }
            ]
        }
    )
    query_chain = mocker.patch("superset.db.session.query")
    query_chain.return_value.filter.return_value.one_or_none.return_value = dash
    return qc


def test_query_context_modified_native_filter_target_column_allowed(
    mocker: MockerFixture,
) -> None:
    """A native-filter request reading only its target column is allowed."""
    query = SimpleNamespace(columns=["region"], metrics=[], groupby=[])
    qc = _native_filter_ctx(mocker, [query])
    assert not query_context_modified(qc)


def test_query_context_modified_native_filter_arbitrary_column_blocked(
    mocker: MockerFixture,
) -> None:
    """A native-filter request reading a non-target column is modified."""
    query = SimpleNamespace(columns=["ssn"], metrics=[], groupby=[])
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_simple_metric_on_target_allowed(
    mocker: MockerFixture,
) -> None:
    """A range-style request (simple aggregate over the target column) is allowed."""
    query = SimpleNamespace(
        columns=[],
        metrics=[
            {
                "expressionType": "SIMPLE",
                "column": {"column_name": "region"},
                "aggregate": "MIN",
            }
        ],
        groupby=[],
    )
    qc = _native_filter_ctx(mocker, [query])
    assert not query_context_modified(qc)


def test_query_context_modified_native_filter_adhoc_metric_blocked(
    mocker: MockerFixture,
) -> None:
    """A free-form SQL metric on the native-filter path is modified."""
    query = SimpleNamespace(
        columns=[],
        metrics=[{"expressionType": "SQL", "sqlExpression": "SUM(salary)"}],
        groupby=[],
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_adhoc_column_blocked(
    mocker: MockerFixture,
) -> None:
    """An adhoc (free-form SQL) column on the native-filter path is modified."""
    query = SimpleNamespace(
        columns=[{"sqlExpression": "ssn", "label": "x"}], metrics=[], groupby=[]
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_no_filter_context_blocked(
    mocker: MockerFixture,
) -> None:
    """Without a native_filter_id / dashboardId the request fails closed."""
    query = SimpleNamespace(columns=["region"], metrics=[], groupby=[])
    qc = _native_filter_ctx(mocker, [query], native_filter_id=None)
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_configured_sort_metric_allowed(
    mocker: MockerFixture,
) -> None:
    """A value lookup sorted by the filter's configured saved metric is allowed."""
    query = SimpleNamespace(
        columns=["region"],
        metrics=["total"],
        groupby=[],
        orderby=[["total", True]],
    )
    qc = _native_filter_ctx(mocker, [query], control_values={"sortMetric": "total"})
    assert not query_context_modified(qc)


def test_query_context_modified_native_filter_arbitrary_saved_metric_blocked(
    mocker: MockerFixture,
) -> None:
    """A saved metric other than the filter's configured sort metric is modified."""
    query = SimpleNamespace(columns=["region"], metrics=["salary_total"], groupby=[])
    qc = _native_filter_ctx(mocker, [query], control_values={"sortMetric": "total"})
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_orderby_arbitrary_column_blocked(
    mocker: MockerFixture,
) -> None:
    """Ordering by a non-target column on the native-filter path is modified."""
    query = SimpleNamespace(
        columns=["region"], metrics=[], groupby=[], orderby=[["ssn", True]]
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_orderby_adhoc_blocked(
    mocker: MockerFixture,
) -> None:
    """Ordering by a free-form SQL expression on the native-filter path is modified."""
    query = SimpleNamespace(
        columns=["region"],
        metrics=[],
        groupby=[],
        orderby=[[{"sqlExpression": "ssn"}, True]],
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_chartless_non_native_filter_allowed(
    mocker: MockerFixture,
) -> None:
    """
    A chartless request that is not a native filter (drill-to-detail, drill-by,
    samples) is validated by the datasource-access checks in raise_for_access and
    is not constrained here.
    """
    qc = mocker.MagicMock()
    qc.slice_ = None
    qc.form_data = {"dashboardId": 10, "slice_id": 0, "groupby": ["ssn"]}
    assert not query_context_modified(qc)


def test_query_context_modified_native_filter_without_type_marker_blocked(
    mocker: MockerFixture,
) -> None:
    """
    A request identified by native_filter_id is constrained even when the
    NATIVE_FILTER type marker is absent.
    """
    query = SimpleNamespace(columns=["ssn"], metrics=[], groupby=[])
    qc = _native_filter_ctx(mocker, [query])
    del qc.form_data["type"]
    assert query_context_modified(qc)


def test_query_context_modified_mixed_chart(mocker: MockerFixture) -> None:
    """
    Test the `query_context_modified` function for a mixed chart request.

    The metrics in the mixed chart are a nested dictionary (due to `columns`), and need
    to be serialized to JSON with the keys sorted in order to compare the request
    metrics with the chart metrics.
    """
    stored_metrics = [
        {
            "optionName": "metric_vgops097wej_g8uff99zhk7",
            "label": "AVG(num)",
            "expressionType": "SIMPLE",
            "column": {"column_name": "num", "type": "BIGINT(20)"},
            "aggregate": "AVG",
        }
    ]
    # different order (remember, dicts have order!)
    requested_metrics = [
        {
            "aggregate": "AVG",
            "column": {"column_name": "num", "type": "BIGINT(20)"},
            "expressionType": "SIMPLE",
            "label": "AVG(num)",
            "optionName": "metric_vgops097wej_g8uff99zhk7",
        }
    ]

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": requested_metrics,
    }
    query_context.queries = [QueryObject(metrics=requested_metrics)]  # type: ignore
    assert not query_context_modified(query_context)


def test_query_context_modified_sankey_tampered(mocker: MockerFixture) -> None:
    """
    Test the `query_context_modified` function for a sankey chart request.
    """
    query_context = mocker.MagicMock()
    query_context.queries = [
        QueryObject(
            apply_fetch_values_predicate=False,
            columns=["bot_id", "channel_id"],
            extras={"having": "", "where": ""},
            filter=[
                {
                    "col": "bot_profile__updated",
                    "op": "TEMPORAL_RANGE",
                    "val": "No filter",
                }
            ],
            from_dttm=None,
            granularity=None,
            inner_from_dttm=None,
            inner_to_dttm=None,
            is_rowcount=False,
            is_timeseries=False,
            metrics=["count"],
            order_desc=True,
            orderby=[],
            row_limit=10000,
            row_offset=0,
            series_columns=[],
            series_limit=0,
            series_limit_metric=None,
            time_shift=None,
            to_dttm=None,
        ),
    ]
    query_context.form_data = {
        "datasource": "12__table",
        "viz_type": "sankey_v2",
        "slice_id": 97,
        "url_params": {},
        "source": "bot_id",
        "target": "channel_id",
        "metric": "count",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "No filter",
                "expressionType": "SIMPLE",
                "operator": "TEMPORAL_RANGE",
                "subject": "bot_profile__updated",
            }
        ],
        "row_limit": 10000,
        "color_scheme": "supersetColors",
        "dashboards": [11],
        "extra_form_data": {},
        "label_colors": {},
        "shared_label_colors": [],
        "map_label_colors": {},
        "extra_filters": [],
        "dashboardId": 11,
        "force": False,
        "result_format": "json",
        "result_type": "full",
    }
    query_context.slice_.id = 97
    query_context.slice_.params_dict = {
        "datasource": "12__table",
        "viz_type": "sankey_v2",
        "slice_id": 97,
        "source": "bot_id",
        "target": "channel_id",
        "metric": "count",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "No filter",
                "expressionType": "SIMPLE",
                "operator": "TEMPORAL_RANGE",
                "subject": "bot_profile__updated",
            }
        ],
        "row_limit": 10000,
        "color_scheme": "supersetColors",
        "extra_form_data": {},
        "dashboards": [11],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "datasource": {"id": 12, "type": "table"},
            "force": False,
            "queries": [
                {
                    "filters": [
                        {
                            "col": "bot_profile__updated",
                            "op": "TEMPORAL_RANGE",
                            "val": "No filter",
                        }
                    ],
                    "extras": {"having": "", "where": ""},
                    "applied_time_extras": {},
                    "columns": [],
                    "metrics": ["count"],
                    "annotation_layers": [],
                    "row_limit": 10000,
                    "series_limit": 0,
                    "order_desc": True,
                    "url_params": {},
                    "custom_params": {},
                    "custom_form_data": {},
                    "groupby": ["bot_id", "channel_id"],
                }
            ],
            "form_data": {
                "datasource": "12__table",
                "viz_type": "sankey_v2",
                "slice_id": 97,
                "source": "bot_id",
                "target": "channel_id",
                "metric": "count",
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "comparator": "No filter",
                        "expressionType": "SIMPLE",
                        "operator": "TEMPORAL_RANGE",
                        "subject": "bot_profile__updated",
                    }
                ],
                "row_limit": 10000,
                "color_scheme": "supersetColors",
                "extra_form_data": {},
                "dashboards": [11],
                "force": False,
                "result_format": "json",
                "result_type": "full",
            },
            "result_format": "json",
            "result_type": "full",
        }
    )
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby(mocker: MockerFixture) -> None:
    """
    Test the `query_context_modified` function when the ORDER BY is modified.
    """
    tampered_groupby: AdhocMetric = {
        "aggregate": "",
        "column": None,
        "expressionType": "SQL",
        "hasCustomLabel": False,
        "label": "random()",
        "sqlExpression": "random()",
    }

    query_context = mocker.MagicMock()
    query_context.queries = [
        QueryObject(
            apply_fetch_values_predicate=False,
            columns=["gender"],
            extras={"having": "", "where": ""},
            filter=[{"col": "ds", "op": "TEMPORAL_RANGE", "val": "No filter"}],
            from_dttm=None,
            granularity=None,
            inner_from_dttm=None,
            inner_to_dttm=None,
            is_rowcount=False,
            is_timeseries=False,
            metrics=["count"],
            order_desc=True,
            orderby=[(tampered_groupby, False)],
            row_limit=1000,
            row_offset=0,
            series_columns=[],
            series_limit=0,
            series_limit_metric=tampered_groupby,
            time_shift=None,
            to_dttm=None,
        ),
    ]
    query_context.form_data = {
        "datasource": "2__table",
        "viz_type": "table",
        "slice_id": 101,
        "url_params": {
            "datasource_id": "2",
            "datasource_type": "table",
            "save_action": "saveas",
            "slice_id": "101",
        },
        "query_mode": "aggregate",
        "groupby": ["gender"],
        "time_grain_sqla": "P1D",
        "temporal_columns_lookup": {"ds": True},
        "metrics": ["count"],
        "all_columns": [],
        "percent_metrics": [],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "No filter",
                "expressionType": "SIMPLE",
                "operator": "TEMPORAL_RANGE",
                "subject": "ds",
            }
        ],
        "timeseries_limit_metric": {
            "aggregate": None,
            "column": None,
            "datasourceWarning": False,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "random()",
            "optionName": "metric_3kwbghgzkv9_wz84h9j1p5d",
            "sqlExpression": "random()",
        },
        "order_by_cols": [],
        "row_limit": 1000,
        "server_page_length": 10,
        "order_desc": True,
        "table_timestamp_format": "smart_date",
        "allow_render_html": True,
        "show_cell_bars": True,
        "color_pn": True,
        "comparison_color_scheme": "Green",
        "comparison_type": "values",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "full",
    }
    query_context.slice_.id = 101
    query_context.slice_.params_dict = {
        "datasource": "2__table",
        "viz_type": "table",
        "query_mode": "aggregate",
        "groupby": ["gender"],
        "time_grain_sqla": "P1D",
        "temporal_columns_lookup": {"ds": True},
        "metrics": ["count"],
        "all_columns": [],
        "percent_metrics": [],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "subject": "ds",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
                "expressionType": "SIMPLE",
            }
        ],
        "order_by_cols": [],
        "row_limit": 1000,
        "server_page_length": 10,
        "order_desc": True,
        "table_timestamp_format": "smart_date",
        "allow_render_html": True,
        "show_cell_bars": True,
        "color_pn": True,
        "comparison_color_scheme": "Green",
        "comparison_type": "values",
        "extra_form_data": {},
        "dashboards": [],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "datasource": {"id": 2, "type": "table"},
            "force": False,
            "queries": [
                {
                    "filters": [
                        {"col": "ds", "op": "TEMPORAL_RANGE", "val": "No filter"}
                    ],
                    "extras": {"having": "", "where": ""},
                    "applied_time_extras": {},
                    "columns": ["gender"],
                    "metrics": ["count"],
                    "orderby": [],
                    "annotation_layers": [],
                    "row_limit": 1000,
                    "series_limit": 0,
                    "order_desc": True,
                    "url_params": {},
                    "custom_params": {},
                    "custom_form_data": {},
                    "post_processing": [],
                    "time_offsets": [],
                }
            ],
            "form_data": {
                "datasource": "2__table",
                "viz_type": "table",
                "query_mode": "aggregate",
                "groupby": ["gender"],
                "time_grain_sqla": "P1D",
                "temporal_columns_lookup": {"ds": True},
                "metrics": ["count"],
                "all_columns": [],
                "percent_metrics": [],
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "subject": "ds",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "No filter",
                        "expressionType": "SIMPLE",
                    }
                ],
                "order_by_cols": [],
                "row_limit": 1000,
                "server_page_length": 10,
                "order_desc": True,
                "table_timestamp_format": "smart_date",
                "allow_render_html": True,
                "show_cell_bars": True,
                "color_pn": True,
                "comparison_color_scheme": "Green",
                "comparison_type": "values",
                "extra_form_data": {},
                "dashboards": [],
                "force": False,
                "result_format": "json",
                "result_type": "full",
            },
            "result_format": "json",
            "result_type": "full",
        }
    )
    assert query_context_modified(query_context)


def _table_sort_query_context(
    mocker: MockerFixture,
    orderby: list[Any],
    *,
    stored_metrics: Optional[list[Any]] = None,
    with_stored_query_context: bool = True,
) -> Any:
    """
    Build a minimal table-chart query context for a guest that sorts by
    ``orderby``. The stored chart groups by ``gender`` and aggregates ``count``.
    """
    metrics: list[Any] = stored_metrics if stored_metrics is not None else ["count"]
    query_context = mocker.MagicMock()
    query_context.queries = [
        QueryObject(columns=["gender"], metrics=metrics, orderby=orderby),
    ]
    query_context.form_data = {"slice_id": 101, "groupby": ["gender"]}
    query_context.slice_.id = 101
    query_context.slice_.params_dict = {"groupby": ["gender"], "metrics": metrics}
    query_context.slice_.query_context = (
        json.dumps({"queries": [{"columns": ["gender"], "metrics": metrics}]})
        if with_stored_query_context
        else None
    )
    return query_context


def _series_limit_metric_query_context(
    mocker: MockerFixture,
    requested_metric: Any,
    *,
    stored_metrics: Optional[list[Any]] = None,
    form_metric_key: str = "series_limit_metric",
) -> Any:
    """
    Build a minimal chart query context with a series-limit metric selector.
    """
    metrics: list[Any] = stored_metrics if stored_metrics is not None else ["count"]
    query_kwargs: dict[str, Any] = {"metrics": metrics}
    if form_metric_key == "series_limit_metric":
        query_kwargs["series_limit_metric"] = requested_metric

    query_context = mocker.MagicMock()
    query_context.queries = [
        QueryObject(**query_kwargs),
    ]
    query_context.form_data = {
        "slice_id": 101,
        "metrics": metrics,
        form_metric_key: requested_metric,
    }
    query_context.slice_.id = 101
    query_context.slice_.params_dict = {
        "metrics": metrics,
    }
    query_context.slice_.query_context = json.dumps({"queries": [{"metrics": metrics}]})
    return query_context


def test_query_context_modified_orderby_sort_by_column(mocker: MockerFixture) -> None:
    """A guest sorting an embedded table by an existing column is allowed."""
    query_context = _table_sort_query_context(mocker, orderby=[("gender", True)])
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_sort_by_metric(mocker: MockerFixture) -> None:
    """A guest sorting by an existing metric is allowed."""
    query_context = _table_sort_query_context(mocker, orderby=[("count", False)])
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_sort_by_adhoc_metric(
    mocker: MockerFixture,
) -> None:
    """A guest sorting by an existing adhoc metric definition is allowed."""
    adhoc_metric: AdhocMetric = {
        "aggregate": "SUM",
        "column": {"column_name": "num"},
        "expressionType": "SIMPLE",
        "hasCustomLabel": False,
        "label": "SUM(num)",
    }
    query_context = _table_sort_query_context(
        mocker,
        orderby=[(adhoc_metric, False)],
        stored_metrics=[adhoc_metric],
    )
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_unknown_column(mocker: MockerFixture) -> None:
    """A guest sorting by a column the chart does not reference is rejected."""
    query_context = _table_sort_query_context(mocker, orderby=[("salary", True)])
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_empty(mocker: MockerFixture) -> None:
    """An empty order-by is not a modification."""
    query_context = _table_sort_query_context(mocker, orderby=[])
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_legacy_singular_metric(
    mocker: MockerFixture,
) -> None:
    """A guest sorting by a legacy ``metric`` (singular) field is allowed."""
    query_context = _table_sort_query_context(
        mocker,
        orderby=[("num_sold", False)],
        stored_metrics=[],
        with_stored_query_context=False,
    )
    query_context.slice_.params_dict = {
        "columns": ["gender"],
        "groupby": ["gender"],
        "metric": "num_sold",
    }
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_malformed_entry(
    mocker: MockerFixture,
) -> None:
    """A malformed order-by entry (not a ``(term, bool)`` pair) is rejected."""
    query_context = _table_sort_query_context(mocker, orderby=[["gender"]])
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_sort_by_stored_qc_only_column(
    mocker: MockerFixture,
) -> None:
    """A column present only in the stored query context is an allowed sort target."""
    query_context = _table_sort_query_context(mocker, orderby=[("age", True)])
    # "age" is absent from params_dict but exposed via the stored query context,
    # so sorting by it must be allowed.
    query_context.slice_.params_dict = {"groupby": ["gender"], "metrics": ["count"]}
    query_context.slice_.query_context = json.dumps(
        {"queries": [{"columns": ["gender", "age"], "metrics": ["count"]}]}
    )
    assert not query_context_modified(query_context)


def test_collect_sortable_identifiers_includes_stored_qc_all_columns(
    mocker: MockerFixture,
) -> None:
    """``all_columns`` exposed via the stored query context is a valid sort target."""
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {"groupby": ["gender"], "metrics": ["count"]}
    allowed = _collect_sortable_identifiers(
        stored_chart,
        {"queries": [{"all_columns": ["gender", "age"], "metrics": ["count"]}]},
    )
    assert freeze_value("age") in allowed


def test_query_context_modified_time_grain_native_filter(
    mocker: MockerFixture,
) -> None:
    """
    Test `query_context_modified` when a guest applies a Time Grain native filter.

    Reproduces https://github.com/apache/superset/issues/32768.

    On a chart that uses a generic x-axis, the selected time grain is baked into the
    ``BASE_AXIS`` adhoc column as a ``timeGrain`` property (see
    ``normalizeTimeColumn`` on the frontend, which copies ``extras.time_grain_sqla``
    onto the column). A Time Grain native filter is a supported, read-only guest
    interaction: it only changes the granularity at which the *same* dimension is
    bucketed, never which metrics or columns are queried.

    Previously, because the changed time grain travels inside the ``columns``
    payload, the subset comparison treated the request as tampering and
    ``query_context_modified`` returned ``True`` -- so guests hit "Guest user cannot
    modify chart payload" whenever they picked a grain other than the chart default.

    ``freeze_value`` now drops the guest-overridable ``timeGrain`` key before
    comparing, so a pure time-grain change is no longer flagged as a modification.
    This test guards that behavior.
    """
    # The chart was saved with a monthly grain on its x-axis column.
    stored_axis_column: AdhocColumn = {
        "label": "order_date",
        "sqlExpression": "order_date",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
    }
    # The guest picked a daily grain via the dashboard Time Grain native filter;
    # `normalizeTimeColumn` rewrote the otherwise-identical column accordingly.
    requested_axis_column: AdhocColumn = {
        **stored_axis_column,
        "timeGrain": "P1D",
    }

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.params_dict = {
        "metrics": ["count"],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "queries": [
                {
                    "columns": [stored_axis_column],
                    "metrics": ["count"],
                }
            ],
        }
    )
    # Native-filter data requests don't carry the mutated columns at the top level;
    # the grain change only shows up inside the query's columns.
    query_context.form_data = {
        "slice_id": 42,
        "metrics": ["count"],
    }
    query_context.queries = [
        QueryObject(
            columns=[requested_axis_column],
            metrics=["count"],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_visible_column_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that guest user can sort by a visible column (whitelist approach).
    """
    query_context: MagicMock = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name", "country"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name", True]],  # Sort by visible column
    }
    query_context.queries = []

    assert not query_context_modified(query_context)


def test_query_context_modified_time_grain_with_tampered_column(
    mocker: MockerFixture,
) -> None:
    """
    Test that relaxing the time grain comparison does not open a tamper hole.

    Only the ``timeGrain`` key is guest-overridable. A request that changes the
    grain *and* also swaps a non-overridable attribute (here ``sqlExpression``,
    which selects which column is queried) must still be flagged as tampering --
    otherwise a guest could query an arbitrary column under cover of a Time Grain
    filter.
    """
    stored_axis_column: AdhocColumn = {
        "label": "order_date",
        "sqlExpression": "order_date",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
    }
    # Guest changes the grain (allowed) but also rewrites the SQL expression to a
    # different column (not allowed) -- this must still read as a modification.
    tampered_axis_column: AdhocColumn = {
        **stored_axis_column,
        "sqlExpression": "secret_column",
        "timeGrain": "P1D",
    }

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.params_dict = {
        "metrics": ["count"],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "queries": [
                {
                    "columns": [stored_axis_column],
                    "metrics": ["count"],
                }
            ],
        }
    )
    query_context.form_data = {
        "slice_id": 42,
        "metrics": ["count"],
    }
    query_context.queries = [
        QueryObject(
            columns=[tampered_axis_column],
            metrics=["count"],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_hidden_column_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that guest user cannot sort by a hidden column (data exfiltration prevention).
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["credit_card_number", True]],  # Hidden column - blocked!
    }
    query_context.queries = []

    assert query_context_modified(query_context)


def test_query_context_modified_time_grain_in_orderby(
    mocker: MockerFixture,
) -> None:
    """
    Test `query_context_modified` when the time grain travels inside `orderby`.

    Each ``orderby`` entry is an ``(column, bool)`` tuple, so a temporal x-axis
    adhoc column carrying the guest-overridable ``timeGrain`` is nested one level
    deep rather than sitting at the top level. The overridable key must still be
    stripped before comparing, otherwise sorting by the temporal axis would make
    a pure time-grain change read as tampering.
    """
    stored_axis_column: AdhocColumn = {
        "label": "order_date",
        "sqlExpression": "order_date",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
    }
    requested_axis_column: AdhocColumn = {
        **stored_axis_column,
        "timeGrain": "P1D",
    }

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.params_dict = {
        "metrics": ["count"],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "queries": [
                {
                    "orderby": [[stored_axis_column, True]],
                    "metrics": ["count"],
                }
            ],
        }
    )
    query_context.form_data = {
        "slice_id": 42,
        "metrics": ["count"],
    }
    query_context.queries = [
        QueryObject(
            orderby=[(requested_axis_column, True)],
            metrics=["count"],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_direction_change_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that changing sort direction (ASC/DESC) is allowed for visible columns.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
        "orderby": [["name", True]],  # Original: ASC
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name", False]],  # Changed to DESC - should be allowed
    }
    query_context.queries = []

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_raw_table_all_columns_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that a raw-records Table chart can be sorted by its `all_columns`.

    The Table plugin's raw "Query mode" stores its selected columns under
    `all_columns` rather than `columns`, so guests must be able to sort by them.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "query_mode": "raw",
        "all_columns": ["name", "country"],
        "orderby": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "orderby": [["country", True]],  # Sort by a raw-mode column
    }
    query_context.queries = []

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_column_config_hidden_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that hidden Table columns cannot be used for guest sorting.

    Table renders only columns whose column_config entry is not visible=false,
    so a manually supplied sort by a hidden-but-selected column must be blocked.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "query_mode": "raw",
        "all_columns": ["name", "secret_column"],
        "column_config": {
            "secret_column": {
                "visible": False,
            },
        },
    }
    query_context.form_data = {
        "slice_id": 42,
        "orderby": [["secret_column", True]],
    }
    query_context.queries = [
        QueryObject(
            orderby=[("secret_column", True)],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_adhoc_metric_without_label_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that guests may sort by a visible adhoc SIMPLE metric without a label.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales", "type": "BIGINT"},
        "aggregate": "SUM",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "metrics": [metric],
        "orderby": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": [metric],
        "orderby": [["SUM(sales)", True]],
    }
    query_context.queries = [
        QueryObject(
            columns=["name"],
            metrics=[metric],
            orderby=[("SUM(sales)", True)],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_simple_metric_reused_metric_label_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that dict-shaped orderby terms cannot pass by reusing a metric label.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "secret_sales"},
        "aggregate": "SUM",
        "label": "count",
    }
    query_context = _table_sort_query_context(
        mocker,
        orderby=[(metric, True)],
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_simple_metric_reused_column_label_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that dict-shaped orderby terms cannot pass by reusing a column label.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "secret_sales"},
        "aggregate": "SUM",
        "label": "name",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [[metric, True]],
    }
    query_context.queries = [
        QueryObject(
            columns=["name"],
            metrics=["count"],
            orderby=[(metric, True)],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_simple_metric_bad_aggregate_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that malformed SIMPLE metric orderby cannot pass through label spoofing.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "secret_sales"},
        "label": "count",
    }
    query_context = _table_sort_query_context(
        mocker,
        orderby=[(metric, True)],
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_adhoc_column_label_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that guests may sort by a visible adhoc column result key.
    """
    column: AdhocColumn = {
        "label": "Full Name",
        "sqlExpression": "CONCAT(first_name, last_name)",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": [column],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": [column],
        "metrics": ["count"],
        "orderby": [["Full Name", True]],
    }
    query_context.queries = [
        QueryObject(
            columns=[column],
            metrics=["count"],
            orderby=[("Full Name", True)],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_hidden_stored_orderby_replay_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that replaying an exact owner-defined orderby is not tampering.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "all_columns": ["name", "secret_column"],
        "column_config": {
            "secret_column": {
                "visible": False,
            },
        },
        "orderby": [["secret_column", True]],
    }
    query_context.form_data = {
        "slice_id": 42,
        "orderby": [["secret_column", True]],
    }
    query_context.queries = [
        QueryObject(
            orderby=[("secret_column", True)],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_hidden_stored_orderby_direction_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that guests cannot change direction on a hidden owner-defined sort.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "all_columns": ["name", "secret_column"],
        "column_config": {
            "secret_column": {
                "visible": False,
            },
        },
        "orderby": [["secret_column", True]],
    }
    query_context.form_data = {
        "slice_id": 42,
        "orderby": [["secret_column", False]],
    }
    query_context.queries = [
        QueryObject(
            orderby=[("secret_column", False)],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_sql_expression_reused_label_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that a new SQL expression object cannot pass by reusing a visible label.
    """
    sql_expression: AdhocColumn = {
        "label": "name",
        "sqlExpression": "random()",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [[sql_expression, True]],
    }
    query_context.queries = [
        QueryObject(
            columns=["name"],
            metrics=["count"],
            orderby=[(sql_expression, True)],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_stored_metric_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that a stored metric can be reused as the series-limit selector.
    """
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric="count",
        stored_metrics=["count"],
    )

    assert not query_context_modified(query_context)


def test_query_context_modified_timeseries_limit_metric_stored_metric_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that the deprecated form-data control name follows the same guard.
    """
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric="count",
        stored_metrics=["count"],
        form_metric_key="timeseries_limit_metric",
    )

    assert not query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_exact_adhoc_metric_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that a stored adhoc metric can be reused as the series-limit selector.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales"},
        "aggregate": "SUM",
        "label": "SUM(sales)",
    }
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric=metric,
        stored_metrics=[metric],
    )

    assert not query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_off_chart_metric_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that a guest cannot introduce an off-chart series-limit metric.
    """
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric="revenue",
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_sql_expression_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that a guest cannot introduce a SQL expression as series-limit metric.
    """
    metric: AdhocMetric = {
        "expressionType": "SQL",
        "sqlExpression": "random()",
        "label": "count",
    }
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric=metric,
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_bad_aggregate_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that malformed series-limit metrics cannot pass through label spoofing.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "secret_sales"},
        "label": "count",
    }
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric=metric,
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_get_catalog_perm() -> None:
    """
    Test the `get_catalog_perm` method.
    """
    sm = SupersetSecurityManager(appbuilder)

    assert sm.get_catalog_perm("my_db", None) is None
    assert sm.get_catalog_perm("my_db", "my_catalog") == "[my_db].[my_catalog]"


def test_get_schema_perm() -> None:
    """
    Test the `get_schema_perm` method.
    """
    sm = SupersetSecurityManager(appbuilder)

    assert sm.get_schema_perm("my_db", None, "my_schema") == "[my_db].[my_schema]"
    assert (
        sm.get_schema_perm("my_db", "my_catalog", "my_schema")
        == "[my_db].[my_catalog].[my_schema]"
    )
    assert sm.get_schema_perm("my_db", None, None) is None
    assert sm.get_schema_perm("my_db", "my_catalog", None) is None


def test_raise_for_access_catalog(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test catalog-level permissions.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(
        sm,
        "get_catalog_perm",
        return_value="[PostgreSQL].[db1]",
    )
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = "db1"
    database.get_default_schema_for_query.return_value = "public"
    query = mocker.MagicMock()
    query.catalog = "db1"
    query.database = database
    query.sql = "SELECT * FROM ab_user"

    can_access = mocker.patch.object(sm, "can_access", return_value=True)
    sm.raise_for_access(query=query)
    can_access.assert_called_with("catalog_access", "[PostgreSQL].[db1]")

    mocker.patch.object(sm, "can_access", return_value=False)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=query)
    assert (
        str(excinfo.value)
        == 'You need access to the following tables: "db1.public.ab_user", '
        "'all_database_access' or 'all_datasource_access' permission"
    )

    query.sql = "SELECT * FROM db2.public.ab_user"
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=query)
    assert (
        str(excinfo.value)
        == 'You need access to the following tables: "db2.public.ab_user", '
        "'all_database_access' or 'all_datasource_access' permission"
    )


def test_get_datasources_accessible_by_user_schema_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that `get_datasources_accessible_by_user` works with schema permissions.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)

    database = mocker.MagicMock()
    database.database_name = "db1"
    database.get_default_catalog.return_value = "catalog2"

    # False for catalog_access, True for schema_access
    can_access = mocker.patch.object(sm, "can_access", side_effect=[False, True])

    datasource_names = [
        DatasourceName("table1", "schema1", "catalog2"),
        DatasourceName("table2", "schema1", "catalog2"),
    ]

    assert sm.get_datasources_accessible_by_user(
        database,
        datasource_names,
        catalog=None,
        schema="schema1",
    ) == [
        DatasourceName("table1", "schema1", "catalog2"),
        DatasourceName("table2", "schema1", "catalog2"),
    ]

    # Even though we passed `catalog=None,` the schema check uses the default catalog
    # when building the schema permission, since the DB supports catalog.
    can_access.assert_has_calls(
        [
            mocker.call("catalog_access", "[db1].[catalog2]"),
            mocker.call("schema_access", "[db1].[catalog2].[schema1]"),
        ]
    )


def test_get_catalogs_accessible_by_user_schema_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that `get_catalogs_accessible_by_user` works with schema permissions.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(
        sm,
        "user_view_menu_names",
        side_effect=[
            set(),  # catalog_access
            {"[db1].[catalog2].[schema1]"},  # schema_access
            set(),  # datasource_access
        ],
    )

    database = mocker.MagicMock()
    database.database_name = "db1"
    database.get_default_catalog.return_value = "catalog2"

    catalogs = {"catalog1", "catalog2"}

    assert sm.get_catalogs_accessible_by_user(database, catalogs) == {"catalog2"}


def test_get_rls_filters_uses_table_id_directly(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that get_rls_filters() uses table.id directly instead of table.data["id"].

    Accessing table.data triggers the full data property chain including select_star,
    which requires a live database engine connection. When the DB is unreachable, this
    causes the entire dashboard GET endpoint to fail with a 500 error.

    This test ensures we use the direct .id attribute and never access .data,
    preventing regressions that would break dashboard loading when DBs are unavailable.
    """
    sm = SupersetSecurityManager(appbuilder)

    # Create a mock table where .data raises an exception if accessed
    table = mocker.MagicMock()
    table.id = 42
    type(table).data = mocker.PropertyMock(
        side_effect=Exception(
            "table.data should not be accessed - use table.id directly"
        )
    )

    # Mock user context
    mock_user = mocker.MagicMock()
    mock_user.id = 1
    mock_user.roles = [mocker.MagicMock(id=1)]
    mocker.patch("superset.security.manager.g", user=mock_user)
    mocker.patch("superset.subjects.utils.get_user_subject_ids", return_value=[1])

    # Call get_rls_filters - if it accesses table.data, the PropertyMock will raise
    # If it uses table.id directly (correct behavior), it will complete successfully
    result = sm.get_rls_filters(table)
    assert isinstance(result, list)


def test_get_rls_filters_returns_cached_result(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that get_rls_filters() returns cached results on subsequent calls
    for the same user and table, avoiding redundant DB queries.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_user = mocker.MagicMock()
    mock_user.id = 1
    mock_user.username = "admin"
    mock_user.roles = [mocker.MagicMock(id=1)]
    mock_g = SimpleNamespace(user=mock_user)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="admin")
    mocker.patch("superset.subjects.utils.get_user_subject_ids", return_value=[1])

    table = mocker.MagicMock()
    table.id = 42

    # First call populates the cache
    result1 = sm.get_rls_filters(table)

    # Verify cache was populated keyed by (username, table_id)
    assert ("admin", 42) in mock_g._rls_filter_cache

    # Replace session query with something that would fail if called
    mocker.patch.object(
        sm.session,
        "query",
        side_effect=AssertionError("DB should not be queried on cache hit"),
    )

    # Second call should return cached result without querying DB
    result2 = sm.get_rls_filters(table)
    assert result1 == result2


def test_prefetch_rls_filters_populates_cache(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that prefetch_rls_filters() populates the cache for all provided
    table_ids, including empty results for tables with no matching filters.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_user = mocker.MagicMock()
    mock_user.id = 1
    mock_user.username = "admin"
    mock_user.roles = [mocker.MagicMock(id=10)]
    mock_g = SimpleNamespace(user=mock_user)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="admin")
    mocker.patch("superset.subjects.utils.get_user_subject_ids", return_value=[10])

    # Mock the batch query to return filters for table 1 but not table 2
    mock_query = mocker.MagicMock()
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = [
        (1, 100, "group_a", "id > 0"),  # table_id=1
        (1, 101, None, "active = 1"),  # table_id=1
    ]
    mocker.patch.object(sm.session, "query", return_value=mock_query)

    sm.prefetch_rls_filters([1, 2])

    # Table 1 should have 2 filters with named attribute access
    cached = mock_g._rls_filter_cache[("admin", 1)]
    assert len(cached) == 2
    assert cached[0].id == 100
    assert cached[0].group_key == "group_a"
    assert cached[0].clause == "id > 0"
    assert cached[1].id == 101
    assert cached[1].group_key is None
    assert cached[1].clause == "active = 1"
    # Table 2 should have empty list
    assert mock_g._rls_filter_cache[("admin", 2)] == []


def test_prefetch_rls_filters_skips_cached_ids(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that prefetch_rls_filters() skips table_ids already in cache
    and returns early when all ids are cached.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_user = mocker.MagicMock()
    mock_user.id = 1
    mock_user.username = "admin"
    mock_user.roles = [mocker.MagicMock(id=10)]
    mock_g = SimpleNamespace(
        user=mock_user,
        _rls_filter_cache={("admin", 1): [(100, "group_a", "id > 0")]},
    )
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="admin")
    mocker.patch.object(sm, "get_user_roles", return_value=mock_user.roles)

    # If it queries the DB, this will fail
    mocker.patch.object(
        sm.session,
        "query",
        side_effect=AssertionError("DB should not be queried for cached ids"),
    )

    # All ids already cached -> should return immediately
    sm.prefetch_rls_filters([1])


def test_prefetch_rls_filters_no_user(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that prefetch_rls_filters() returns early when no user is present.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch("superset.security.manager.g", new=SimpleNamespace())

    # Should not attempt any DB queries
    mocker.patch.object(
        sm.session,
        "query",
        side_effect=AssertionError("DB should not be queried without a user"),
    )
    sm.prefetch_rls_filters([1, 2])


def test_get_rls_filters_cache_works_for_guest_user(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that get_rls_filters() caches results for guest users
    using the same (username, table_id) cache key as regular users.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_guest = mocker.MagicMock()
    mock_guest.id = 1
    mock_guest.username = "guest_user"
    mock_guest.roles = [mocker.MagicMock(id=99)]

    mock_g = SimpleNamespace(user=mock_guest)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="guest_user")
    mocker.patch.object(sm, "get_user_roles", return_value=mock_guest.roles)

    table = mocker.MagicMock()
    table.id = 42

    # First call runs the query
    result1 = sm.get_rls_filters(table)

    # Verify cache was populated with (username, table_id) key
    assert ("guest_user", 42) in mock_g._rls_filter_cache

    # Replace session query to detect if it's called again
    mocker.patch.object(
        sm.session,
        "query",
        side_effect=AssertionError("DB should not be queried on cache hit"),
    )

    # Second call should use cache
    result2 = sm.get_rls_filters(table)
    assert result1 == result2


def test_prefetch_rls_filters_works_for_guest_user(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that prefetch_rls_filters() works for guest users using the
    same (username, table_id) cache key as regular users.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_guest = mocker.MagicMock()
    mock_guest.id = 1
    mock_guest.username = "guest_user"
    mock_guest.roles = [mocker.MagicMock(id=99)]

    mock_g = SimpleNamespace(user=mock_guest)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="guest_user")
    mocker.patch.object(sm, "get_user_roles", return_value=mock_guest.roles)

    # Mock the batch query returning no filters
    mock_query = mocker.MagicMock()
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = []
    mocker.patch.object(sm.session, "query", return_value=mock_query)

    sm.prefetch_rls_filters([10, 20])

    # Cache should be populated with (username, table_id) keys and empty lists
    assert mock_g._rls_filter_cache[("guest_user", 10)] == []
    assert mock_g._rls_filter_cache[("guest_user", 20)] == []


def test_validate_child_in_parent_multilayer_valid(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation succeeds for valid multi-layer child"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps(
        {"viz_type": "deck_multi", "deck_slices": [1, 2, 3]}
    )

    # Child 2 is in parent's deck_slices
    assert sm._validate_child_in_parent_multilayer(
        child_slice_id=2, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_invalid_child(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails for child not in parent config"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps(
        {"viz_type": "deck_multi", "deck_slices": [1, 2, 3]}
    )

    # Child 5 is NOT in parent's deck_slices
    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=5, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_wrong_viz_type(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails for non-multilayer charts"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps(
        {
            "viz_type": "line",  # Not deck_multi
            "deck_slices": [1, 2, 3],
        }
    )

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=2, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_empty_deck_slices(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails when deck_slices is empty"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps({"viz_type": "deck_multi", "deck_slices": []})

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=1, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_no_deck_slices(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails when deck_slices is missing"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps(
        {
            "viz_type": "deck_multi"
            # No deck_slices key
        }
    )

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=1, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_malformed_json(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails gracefully with malformed JSON"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = "not valid json {{"

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=1, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_null_params(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails gracefully with null params"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = None

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=1, parent_slice=parent_slice
    )


def test_user_view_menu_names_for_guest_user(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that user_view_menu_names resolves permissions from the guest
    user's roles instead of querying by user_id (which is None for guests).
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_role = mocker.MagicMock(spec=Role)
    mock_role.id = 99

    mock_guest = mocker.MagicMock()
    mock_guest.is_anonymous = False
    mock_guest.roles = [mock_role]

    mock_g = SimpleNamespace(user=mock_guest)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    # The regression: guest path must NEVER fall through to get_user_id().
    # Patching it as an error means an accidental fall-through fails loudly.
    mock_get_user_id = mocker.patch(
        "superset.security.manager.get_user_id",
        side_effect=AssertionError("get_user_id must not be called for guest users"),
    )

    mock_result = [SimpleNamespace(name="[PostgreSQL].[my_table](id:1)")]
    mock_query = mocker.MagicMock()
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = mock_result
    mocker.patch.object(sm.session, "query", return_value=mock_query)

    result = sm.user_view_menu_names("datasource_access")

    assert result == {"[PostgreSQL].[my_table](id:1)"}
    mock_get_user_id.assert_not_called()
    mock_query.filter.assert_called()


def test_user_view_menu_names_for_guest_user_no_roles(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that user_view_menu_names returns empty set when guest user has
    no roles with valid IDs.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_role = mocker.MagicMock(spec=Role)
    mock_role.id = None

    mock_guest = mocker.MagicMock()
    mock_guest.is_anonymous = False
    mock_guest.roles = [mock_role]

    mock_g = SimpleNamespace(user=mock_guest)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mock_get_user_id = mocker.patch(
        "superset.security.manager.get_user_id",
        side_effect=AssertionError("get_user_id must not be called for guest users"),
    )

    result = sm.user_view_menu_names("datasource_access")

    assert result == set()
    mock_get_user_id.assert_not_called()


def test_reset_password_self_service_clears_flag(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """A user resetting their own password clears the forced-change flag."""
    sm = SupersetSecurityManager(appbuilder)
    # The target user (id 5) is the same as the acting user -> self-service.
    mock_g = SimpleNamespace(user=SimpleNamespace(id=5))
    mocker.patch("superset.security.manager.g", new=mock_g)
    # Avoid touching the real DB in the FAB base implementation.
    mocker.patch(
        "flask_appbuilder.security.manager.BaseSecurityManager.reset_password",
        return_value=None,
    )
    mock_clear = mocker.patch(
        "superset.security.password_change.clear_password_must_change"
    )

    sm.reset_password(5, "new-password")

    mock_clear.assert_called_once_with(5)


def test_reset_password_admin_does_not_clear_flag(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """An admin-initiated reset must preserve the forced-change requirement.

    FAB's ``ResetPasswordView`` passes the target as the ``pk`` request-arg
    string while ``g.user`` remains the admin, so the acting user differs from
    the target and the flag must NOT be cleared.
    """
    sm = SupersetSecurityManager(appbuilder)
    # Acting user is admin (id 1); target is a different user ("5" as a string,
    # as FAB passes it from request args).
    mock_g = SimpleNamespace(user=SimpleNamespace(id=1))
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch(
        "flask_appbuilder.security.manager.BaseSecurityManager.reset_password",
        return_value=None,
    )
    mock_clear = mocker.patch(
        "superset.security.password_change.clear_password_must_change"
    )

    sm.reset_password("5", "temp-password")

    mock_clear.assert_not_called()


def test_reset_password_self_service_pk_string_clears_flag(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """Self-service identity holds even if ids arrive as mixed int/str types."""
    sm = SupersetSecurityManager(appbuilder)
    mock_g = SimpleNamespace(user=SimpleNamespace(id=5))
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch(
        "flask_appbuilder.security.manager.BaseSecurityManager.reset_password",
        return_value=None,
    )
    mock_clear = mocker.patch(
        "superset.security.password_change.clear_password_must_change"
    )

    sm.reset_password("5", "new-password")

    # Coerced to int when clearing, regardless of the inbound id type.
    mock_clear.assert_called_once_with(5)


# -----------------------------------------------------------------------------
# Tests for orderby with invalid formats - unit tests
# -----------------------------------------------------------------------------


def test_query_context_modified_orderby_sql_expression_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that SQL expressions in orderby are blocked.

    Security: prevents SQL injection via sorting.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [[{"expressionType": "SQL", "sqlExpression": "random()"}, True]],
    }
    query_context.queries = []

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_invalid_format_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that invalid orderby formats are blocked (not crash).

    The invalid format {"column": "string"} should be blocked,
    not cause AttributeError.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        # Invalid format - should be blocked, not crash
        "orderby": [[{"column": "country"}, True]],
    }
    query_context.queries = []

    # Should return True (modified/blocked), not raise exception
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_string_instead_of_list_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that orderby as string (instead of list) is blocked.

    Defensive barrier: if orderby is not a list, block (fail-closed).
    Without this barrier, iterating over string would yield characters,
    each would be skipped, and the check would pass (fail-open).
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        # Invalid: string instead of list
        "orderby": "malicious_string",
    }
    query_context.queries = []

    # Should return True (blocked), not pass through
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_element_not_tuple_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that orderby element that is not tuple/list is blocked.

    Defensive barrier: each orderby element must be [column, bool].
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        # Invalid: element is string, not tuple
        "orderby": ["name"],
    }
    query_context.queries = []

    # Should return True (blocked)
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_empty_tuple_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that empty orderby tuple is blocked.

    Defensive barrier: empty tuples are invalid.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        # Invalid: empty tuple
        "orderby": [[]],
    }
    query_context.queries = []

    # Should return True (blocked)
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_missing_direction_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that orderby entries without a direction are blocked.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name"]],
    }
    query_context.queries = []

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_non_bool_direction_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that orderby direction must be a boolean for new guest sort terms.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name", "true"]],
    }
    query_context.queries = []

    assert query_context_modified(query_context)


def test_validate_guest_token_resources_rejects_non_embedded_int_id(
    app_context: None, mocker: MockerFixture
) -> None:
    """A raw int dashboard id must reference an embedded dashboard, else a guest
    token could be scoped to a non-embedded dashboard."""
    from superset.commands.dashboard.embedded.exceptions import (
        EmbeddedDashboardNotFoundError,
    )
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    non_embedded = MagicMock()
    non_embedded.embedded = []  # not embedded
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=non_embedded)

    with pytest.raises(EmbeddedDashboardNotFoundError):
        sm.validate_guest_token_resources(
            [{"type": GuestTokenResourceType.DASHBOARD, "id": 5}]
        )


def test_validate_guest_token_resources_accepts_embedded_int_id(
    app_context: None, mocker: MockerFixture
) -> None:
    """A raw int id for an embedded dashboard is accepted."""
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    embedded_dash = MagicMock()
    embedded_dash.embedded = [MagicMock()]  # embedded
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=embedded_dash)

    sm.validate_guest_token_resources(
        [{"type": GuestTokenResourceType.DASHBOARD, "id": 5}]
    )
