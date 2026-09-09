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
from flask_appbuilder.security.sqla.models import User
from jinja2.exceptions import TemplateSyntaxError
from pytest import raises  # noqa: PT013
from pytest_mock import MockerFixture

from superset.commands.chart.exceptions import (
    ChartAccessDeniedError,
    ChartNotFoundError,
)
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    QueryNotFoundValidationError,
)
from superset.common.db_query_status import QueryStatus
from superset.exceptions import SupersetSecurityException, SupersetTemplateException
from superset.extensions import appbuilder
from superset.utils.core import DatasourceType, override_user

dataset_find_by_id = "superset.daos.dataset.DatasetDAO.find_by_id"
query_find_by_id = "superset.daos.query.QueryDAO.find_by_id"
chart_find_by_id = "superset.daos.chart.ChartDAO.find_by_id"
is_admin = "superset.security.SupersetSecurityManager.is_admin"
is_editor = "superset.security.SupersetSecurityManager.is_editor"
can_access_datasource = (
    "superset.security.SupersetSecurityManager.can_access_datasource"
)
can_access = "superset.security.SupersetSecurityManager.can_access"
raise_for_access = "superset.security.SupersetSecurityManager.raise_for_access"
query_datasources_by_name = (
    "superset.connectors.sqla.models.SqlaTable.query_datasources_by_name"
)


def test_unsaved_chart_no_dataset_id() -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasourceNotFoundValidationError):
        with override_user(User()):
            check_chart_access(
                datasource_id=0,
                chart_id=0,
                datasource_type=DatasourceType.TABLE,
            )


def test_unsaved_chart_unknown_dataset_id(mocker: MockerFixture) -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetNotFoundError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=None)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=0,
                datasource_type=DatasourceType.TABLE,
            )


def test_unsaved_chart_unknown_query_id(mocker: MockerFixture) -> None:
    from superset.explore.utils import check_access as check_chart_access

    with raises(QueryNotFoundValidationError):  # noqa: PT012
        mocker.patch(query_find_by_id, return_value=None)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=0,
                datasource_type=DatasourceType.QUERY,
            )


def test_unsaved_chart_unauthorized_dataset(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetAccessDeniedError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=False)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=0,
                datasource_type=DatasourceType.TABLE,
            )


def test_unsaved_chart_authorized_dataset(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)

    with override_user(User()):
        check_chart_access(
            datasource_id=1,
            chart_id=0,
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_unknown_chart_id(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(ChartNotFoundError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(chart_find_by_id, return_value=None)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )


def test_saved_chart_unauthorized_dataset(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access

    with raises(DatasetAccessDeniedError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=False)

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )


def test_saved_chart_is_admin(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with override_user(User()):
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_is_editor(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with override_user(User()):
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_has_access(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, return_value=True)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with override_user(User()):
        check_chart_access(
            datasource_id=1,
            chart_id=1,
            datasource_type=DatasourceType.TABLE,
        )


def test_saved_chart_no_access(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    with raises(ChartAccessDeniedError):  # noqa: PT012
        mocker.patch(dataset_find_by_id, return_value=SqlaTable())
        mocker.patch(can_access_datasource, return_value=True)
        mocker.patch(is_admin, return_value=False)
        mocker.patch(is_editor, return_value=False)
        mocker.patch(can_access, return_value=False)
        mocker.patch(chart_find_by_id, return_value=Slice())

        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )


def test_drill_by_access_without_can_explore(mocker: MockerFixture) -> None:
    """
    Regression for #27900: performing Drill By (and Drill to Detail) must not
    require the broad ``can explore on Superset`` permission.

    ``check_access`` is the backend access gate for the Drill By flow: it is
    invoked by ``CreateFormDataCommand`` when the client stores the drill
    ``form_data`` via ``ExploreFormDataRestApi`` (the endpoint commenters on the
    issue identified as drill-by-specific). This test grants the granular
    ``can read on Chart`` permission while *explicitly denying*
    ``can explore on Superset`` and asserts that access is still granted.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    def can_access_side_effect(permission: str, view_menu: str) -> bool:
        # The broad explore permission is denied; only the granular chart-read
        # permission is granted.
        if (permission, view_menu) == ("can_explore", "Superset"):
            return False
        return (permission, view_menu) == ("can_read", "Chart")

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, side_effect=can_access_side_effect)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with override_user(User()):
        assert (
            check_chart_access(  # noqa: E712
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )
            is True
        )


def test_drill_by_access_can_explore_is_not_the_gate(mocker: MockerFixture) -> None:
    """
    Regression for #27900: ``can explore on Superset`` is neither necessary nor
    sufficient for Drill By access. Here the user holds *only*
    ``can explore on Superset`` (the granular ``can read on Chart`` is denied and
    the user is not an owner/admin) and access must be refused, proving the gate
    is governed by the granular chart permission rather than ``can explore``.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.slice import Slice

    def can_access_side_effect(permission: str, view_menu: str) -> bool:
        # Only the broad explore permission is granted; the granular chart-read
        # permission is denied.
        return (permission, view_menu) == ("can_explore", "Superset")

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, side_effect=can_access_side_effect)
    mocker.patch(chart_find_by_id, return_value=Slice())

    with raises(ChartAccessDeniedError):  # noqa: PT012
        with override_user(User()):
            check_chart_access(
                datasource_id=1,
                chart_id=1,
                datasource_type=DatasourceType.TABLE,
            )


def test_dataset_has_access(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_datasource_access

    mocker.patch(dataset_find_by_id, return_value=SqlaTable())
    mocker.patch(can_access_datasource, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, return_value=True)
    assert (
        check_datasource_access(  # noqa: E712
            datasource_id=1,
            datasource_type=DatasourceType.TABLE,
        )
        is True
    )


def test_query_has_access(mocker: MockerFixture) -> None:
    from superset.explore.utils import check_datasource_access
    from superset.models.sql_lab import Query

    mocker.patch(query_find_by_id, return_value=Query())
    mocker.patch(raise_for_access, return_value=True)
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, return_value=True)
    assert (
        check_datasource_access(  # noqa: E712
            datasource_id=1,
            datasource_type=DatasourceType.QUERY,
        )
        is True
    )


def test_query_malformed_jinja_template(mocker: MockerFixture) -> None:
    """
    ``raise_for_access(query=...)`` Jinja-renders the query's SQL to resolve
    the tables it touches. A malformed template must surface as a
    ``SupersetTemplateException``, not the raw ``jinja2`` exception.
    """
    from superset.explore.utils import check_datasource_access
    from superset.models.sql_lab import Query

    mocker.patch(query_find_by_id, return_value=Query())
    mocker.patch(
        raise_for_access,
        side_effect=TemplateSyntaxError("unexpected end of template", lineno=1),
    )

    with raises(SupersetTemplateException):  # noqa: PT012
        check_datasource_access(
            datasource_id=1,
            datasource_type=DatasourceType.QUERY,
        )


def test_query_no_access(mocker: MockerFixture, client) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_datasource_access
    from superset.models.sql_lab import Query

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    mocker.patch(
        query_find_by_id,
        return_value=Query(database=database, sql="select * from foo"),
    )
    mocker.patch(query_datasources_by_name, return_value=[SqlaTable()])
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    mocker.patch(can_access, return_value=False)

    with raises(SupersetSecurityException):
        check_datasource_access(
            datasource_id=1,
            datasource_type=DatasourceType.QUERY,
        )


def test_unsaved_query_explore_allows_the_query_author(
    mocker: MockerFixture, client
) -> None:
    """
    Regression for #39296: clicking "Create Chart" straight from a SQL Lab
    query (no "Save dataset" step first) sends ``DatasourceType.QUERY`` into
    ``CreateFormDataCommand``, which is the command backing that button (see
    ``superset/commands/explore/form_data/create.py``). That command calls
    this exact ``check_access`` function with ``chart_id=None``.

    Unlike the TABLE path (``check_access`` -> ``can_access_datasource`` ->
    ``raise_for_access(datasource=...)``), which grants access to a
    dataset's *owners* via ``is_editor`` regardless of catalog/schema/table
    permissions, the QUERY path had no equivalent "you authored this"
    bypass: ``raise_for_access``'s ``query=`` branch
    (``superset/security/manager.py``) only ever checked catalog/schema/
    table-level ``datasource_access``, and never looked at ``Query.user_id``
    at all. So a user who just ran this exact query in SQL Lab themselves
    (and therefore has execution rights on the connection) but lacks that
    dataset-level permission was denied here, even though the identical
    underlying data becomes explorable to them the moment it's saved as a
    dataset, since ``populate_owners()`` (``superset/commands/utils.py``)
    would make them an owner at that point. That inconsistency, not a
    missing owner field, was the crux of #39296.

    This test sets the query's ``user_id`` to match the current user (i.e.
    the user IS the query's own author) and asserts access is granted.
    ``raise_for_access`` now grants a bypass for query authorship,
    mirroring the ``is_editor`` bypass the TABLE path already had.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.explore.utils import check_access as check_chart_access
    from superset.models.sql_lab import Query

    current_user = User(id=1)

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    mocker.patch(
        query_find_by_id,
        return_value=Query(
            database=database,
            sql="select * from foo",
            user_id=current_user.id,
            # The authorship bypass only covers a query that actually
            # succeeded -- see raise_for_access in
            # superset/security/manager.py.
            status=QueryStatus.SUCCESS,
        ),
    )
    mocker.patch(query_datasources_by_name, return_value=[SqlaTable()])
    mocker.patch(is_admin, return_value=False)
    mocker.patch(is_editor, return_value=False)
    # No catalog/schema/dataset-level datasource_access grant of any kind:
    # the only thing that should let this through is query authorship.
    mocker.patch(can_access, return_value=False)

    with override_user(current_user):
        # A user exploring a query they themselves just ran in SQL Lab
        # should not be denied for lack of an unrelated dataset grant.
        check_chart_access(
            datasource_id=1,
            chart_id=None,
            datasource_type=DatasourceType.QUERY,
        )


def test_query_authorship_bypass_does_not_cover_chart_data_fetch(
    mocker: MockerFixture,
) -> None:
    """
    The authorship bypass above is deliberately opt-in
    (``allow_query_authorship_bypass``) and only set by the one-time
    explore/create-chart transition (``check_query_access`` above). A
    query-backed chart's *data*, fetched on every dashboard/chart view or
    export via ``QueryContextProcessor.raise_for_access`` (see
    ``superset/common/query_context_processor.py``), calls
    ``raise_for_access(query=...)`` without that flag, and must keep going
    through the regular catalog/schema/datasource_access checks on every
    call -- authorship alone does not track whether the author still holds
    that access.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.sql_lab import Query
    from superset.security.manager import SupersetSecurityManager

    sm = SupersetSecurityManager(appbuilder)
    current_user = User(id=1)

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    query = Query(
        database=database,
        sql="select * from foo",
        user_id=current_user.id,
        status=QueryStatus.SUCCESS,
    )

    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "is_admin", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch(query_datasources_by_name, return_value=[SqlaTable()])

    with override_user(current_user):
        # Same query, same author, same SUCCESS status as the explore-path
        # bypass test above -- but with no allow_query_authorship_bypass
        # (the chart-data/export call shape), so it must still be denied.
        with raises(SupersetSecurityException):
            sm.raise_for_access(query=query)
