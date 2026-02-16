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

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import Database, SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.models.slice import Slice
from superset.security.manager import (
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
        == """You need access to the following tables: `public.ab_user`,
            `all_database_access` or `all_datasource_access` permission"""
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


def test_raise_for_access_chart_owner(
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

    slice = Slice(
        id=1,
        datasource_id=1,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
        owners=[alpha],
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


def test_query_context_modified_native_filter(mocker: MockerFixture) -> None:
    """
    Test the `query_context_modified` function with a native filter request.

    A native filter request has no chart (slice) associated with it.
    """
    query_context = mocker.MagicMock()
    query_context.slice_ = None

    assert not query_context_modified(query_context)


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
        == """You need access to the following tables: `db1.public.ab_user`,
            `all_database_access` or `all_datasource_access` permission"""
    )

    query.sql = "SELECT * FROM db2.public.ab_user"
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=query)
    assert (
        str(excinfo.value)
        == """You need access to the following tables: `db2.public.ab_user`,
            `all_database_access` or `all_datasource_access` permission"""
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
    mock_user.roles = [mocker.MagicMock(id=1)]
    mocker.patch("superset.security.manager.g", user=mock_user)
    mocker.patch.object(sm, "get_user_roles", return_value=mock_user.roles)

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
    mocker.patch.object(sm, "get_user_roles", return_value=mock_user.roles)

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
    mocker.patch.object(sm, "get_user_roles", return_value=mock_user.roles)

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
