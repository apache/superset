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

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import Database, SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.models.slice import Slice
from superset.security.manager import (
    _extract_orderby_column_name,
    _get_visible_columns,
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


def test_query_context_modified_orderby_visible_column_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that guest user can sort by a visible column (whitelist approach).
    """
    query_context = mocker.MagicMock()
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
        "orderby": [["name", True]],  # Original: DESC
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name", False]],  # Changed to ASC - should be allowed
    }
    query_context.queries = []

    assert not query_context_modified(query_context)


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


# -----------------------------------------------------------------------------
# Tests for _extract_orderby_column_name() - defensive barrier tests
# -----------------------------------------------------------------------------
# These tests verify that the function handles all valid formats correctly
# and gracefully returns None (block) for invalid formats instead of crashing.
#
# Why barriers are needed:
# 1. Security-critical code should be fail-closed (block unknown, not pass)
# 2. Schema accepts fields.Raw() which doesn't validate structure
# 3. Defensive coding prevents 500 errors on malformed input
# -----------------------------------------------------------------------------


def test_extract_orderby_column_name_string() -> None:
    """
    Test extraction from a simple string column name.

    This is the most common case: orderby = [["country", True]]
    """
    assert _extract_orderby_column_name("country") == "country"
    assert _extract_orderby_column_name("name") == "name"


def test_extract_orderby_column_name_adhoc_column_with_label() -> None:
    """
    Test extraction from an adhoc column (dict with label).

    Format: {"label": "My Column", "sqlExpression": "UPPER(name)"}
    """
    adhoc_column = {
        "label": "My Column",
        "sqlExpression": "UPPER(name)",
        "expressionType": "SQL",
    }
    # Note: expressionType=SQL should block, but label takes precedence
    # Actually no - SQL is blocked first
    assert _extract_orderby_column_name(adhoc_column) is None

    # Without expressionType=SQL, label should work
    adhoc_column_no_sql = {
        "label": "My Column",
        "sqlExpression": "UPPER(name)",
    }
    assert _extract_orderby_column_name(adhoc_column_no_sql) == "My Column"


def test_extract_orderby_column_name_adhoc_metric_simple() -> None:
    """
    Test extraction from an adhoc SIMPLE metric.

    Format: {"expressionType": "SIMPLE", "column": {"column_name": "sales"}, ...}
    The label should be extracted, not column.column_name.
    """
    adhoc_metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales", "type": "BIGINT"},
        "aggregate": "SUM",
        "label": "SUM(sales)",
    }
    assert _extract_orderby_column_name(adhoc_metric) == "SUM(sales)"


def test_extract_orderby_column_name_adhoc_metric_simple_no_label() -> None:
    """
    Test extraction from an adhoc SIMPLE metric without label.

    Should fall back to column.column_name.
    """
    adhoc_metric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales", "type": "BIGINT"},
        "aggregate": "SUM",
    }
    assert _extract_orderby_column_name(adhoc_metric) == "sales"


def test_extract_orderby_column_name_sql_expression_blocked() -> None:
    """
    Test that SQL expressions are blocked for security.

    Format: {"expressionType": "SQL", "sqlExpression": "random()", ...}
    Returns None to block - prevents SQL injection via sorting.
    """
    adhoc_sql = {
        "expressionType": "SQL",
        "sqlExpression": "random()",
        "label": "random()",
    }
    assert _extract_orderby_column_name(adhoc_sql) is None


def test_extract_orderby_column_name_invalid_column_string() -> None:
    """
    Test that invalid format {"column": "string"} is blocked.

    This format does NOT exist in Superset's type system:
    - AdhocMetric.column is AdhocMetricColumn (dict) or None, never str
    - The codeant-ai bot suggested supporting this, but it's INCORRECT

    The barrier (isinstance check) ensures this returns None (block)
    instead of raising AttributeError.
    """
    # This is the format the bot incorrectly claimed could exist
    invalid_format = {"column": "country"}
    # With barrier: returns None (blocked)
    # Without barrier: would raise AttributeError on "country".get("column_name")
    assert _extract_orderby_column_name(invalid_format) is None


def test_extract_orderby_column_name_invalid_nested_types() -> None:
    """
    Test that other invalid nested structures are blocked.

    Defensive tests - ensure no crashes on unexpected input.
    """
    # column as list (invalid)
    assert _extract_orderby_column_name({"column": ["a", "b"]}) is None

    # column as number (invalid)
    assert _extract_orderby_column_name({"column": 123}) is None

    # Empty dict
    assert _extract_orderby_column_name({}) is None

    # None
    assert _extract_orderby_column_name(None) is None

    # List (invalid - orderby_item should be unpacked from tuple first)
    assert _extract_orderby_column_name(["country", True]) is None

    # Number
    assert _extract_orderby_column_name(42) is None


# -----------------------------------------------------------------------------
# Tests for _get_visible_columns() - defensive barrier tests
# -----------------------------------------------------------------------------


def test_get_visible_columns_string_columns(mocker: MockerFixture) -> None:
    """
    Test extraction of visible columns from string column names.

    Format: {"columns": ["name", "country"]}
    """
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {
        "columns": ["name", "country"],
        "groupby": [],
        "metrics": [],
    }
    visible = _get_visible_columns(stored_chart)
    assert visible == {"name", "country"}


def test_get_visible_columns_adhoc_columns(mocker: MockerFixture) -> None:
    """
    Test extraction of visible columns from adhoc column dicts.

    Format: {"columns": [{"label": "My Column", "sqlExpression": "..."}]}
    """
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {
        "columns": [
            {"label": "Full Name", "sqlExpression": "CONCAT(first, last)"},
            {"label": "Upper Country", "sqlExpression": "UPPER(country)"},
        ],
        "groupby": [],
        "metrics": [],
    }
    visible = _get_visible_columns(stored_chart)
    assert visible == {"Full Name", "Upper Country"}


def test_get_visible_columns_mixed(mocker: MockerFixture) -> None:
    """
    Test extraction from mixed string and adhoc columns.
    """
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {
        "columns": [
            "name",
            {"label": "Custom", "sqlExpression": "..."},
        ],
        "groupby": [],
        "metrics": [],
    }
    visible = _get_visible_columns(stored_chart)
    assert visible == {"name", "Custom"}


def test_get_visible_columns_includes_metrics(mocker: MockerFixture) -> None:
    """
    Test that metrics are included in visible columns.

    Guest users can sort by metrics too.
    """
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count", "sum_amount"],
    }
    visible = _get_visible_columns(stored_chart)
    assert visible == {"name", "count", "sum_amount"}


def test_get_visible_columns_includes_groupby(mocker: MockerFixture) -> None:
    """
    Test that deprecated groupby field is included.

    groupby is deprecated but still used in some charts.
    """
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {
        "columns": [],
        "groupby": ["category", "region"],
        "metrics": [],
    }
    visible = _get_visible_columns(stored_chart)
    assert visible == {"category", "region"}


def test_get_visible_columns_adhoc_metrics(mocker: MockerFixture) -> None:
    """
    Test extraction from adhoc metric dicts.
    """
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {
        "columns": [],
        "groupby": [],
        "metrics": [
            "count",
            {"label": "Total Sales", "expressionType": "SIMPLE"},
        ],
    }
    visible = _get_visible_columns(stored_chart)
    assert visible == {"count", "Total Sales"}


def test_get_visible_columns_empty(mocker: MockerFixture) -> None:
    """
    Test with empty/missing fields.
    """
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {}
    visible = _get_visible_columns(stored_chart)
    assert visible == set()


def test_get_visible_columns_ignores_invalid(mocker: MockerFixture) -> None:
    """
    Test that invalid column formats are ignored (not crash).

    Defensive test - columns that don't match expected format
    should be skipped, not cause errors.
    """
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {
        "columns": [
            "valid_string",
            {"label": "valid_dict"},
            {"no_label_key": "ignored"},  # dict without label - ignored
            123,  # number - ignored
            None,  # None - ignored
            ["list"],  # list - ignored
        ],
        "groupby": [],
        "metrics": [],
    }
    visible = _get_visible_columns(stored_chart)
    assert visible == {"valid_string", "valid_dict"}


# -----------------------------------------------------------------------------
# Tests for orderby with invalid formats - integration tests
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
