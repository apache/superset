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
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask_appbuilder import Model
from jinja2.exceptions import TemplateError
from pytest_mock import MockerFixture
from sqlalchemy.dialects import sqlite

from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetParseError,
    SupersetSecurityException,
    SupersetTemplateException,
)
from superset.models import sql_lab as sql_lab_module
from superset.models.core import Database
from superset.models.sql_lab import Query, SavedQuery
from superset.superset_typing import AdhocColumn


@pytest.mark.parametrize(
    "klass",
    [
        Query,
        SavedQuery,
    ],
)
@pytest.mark.parametrize(
    ("exception", "should_warn"),
    [
        # Original silent handler — security/parse/template errors are
        # expected during list rendering and produce no log noise.
        (
            SupersetSecurityException(
                SupersetError(
                    error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
                    message="",
                    level=ErrorLevel.ERROR,
                )
            ),
            False,
        ),
        (
            SupersetParseError(
                sql="INVALID SQL",
                message="Invalid SQL syntax",
            ),
            False,
        ),
        (TemplateError, False),
        # ``{{ dataset(id) }}`` referencing a deleted dataset previously
        # bubbled up through ``sql_tables`` and broke saved-query list
        # endpoints (see issue #32771). The new handler swallows it but
        # logs a warning so the underlying breakage is still observable —
        # pinned here so a future refactor that collapses the case into
        # the silent handler fails this test.
        (DatasetNotFoundError("Dataset 1 not found!"), True),
        (SupersetTemplateException("Template rendering failed"), True),
    ],
)
def test_sql_tables_mixin_sql_tables_exception(
    klass: type[Model],
    exception: Exception,
    should_warn: bool,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.models.sql_lab.process_jinja_sql",
        side_effect=exception,
    )
    warning_spy = mocker.spy(sql_lab_module.logger, "warning")

    assert klass(sql="SELECT 1", database=MagicMock()).sql_tables == []

    if should_warn:
        assert warning_spy.call_count == 1, (
            f"{type(exception).__name__} should hit the warning-logging "
            "handler; if this fails, the case was likely collapsed into "
            "the silent first-handler clause."
        )
    else:
        warning_spy.assert_not_called()


@pytest.mark.parametrize(
    "klass",
    [
        Query,
        SavedQuery,
    ],
)
@pytest.mark.parametrize(
    "invalid_sql",
    [
        "SELECT * FROM table WHERE invalid syntax",
        "INVALID SQL STATEMENT",
        "SELECT * FROM; DROP TABLE users;",
        "",
        None,
    ],
)
def test_sql_tables_mixin_invalid_sql_returns_empty_list(
    klass: type[Model],
    invalid_sql: str,
    mocker: MockerFixture,
) -> None:
    """Test that SqlTablesMixin returns empty list when SQL parsing fails."""
    mocker.patch(
        "superset.models.sql_lab.process_jinja_sql",
        side_effect=SupersetParseError(
            sql=invalid_sql or "INVALID SQL",
            message=f"Failed to parse SQL: {invalid_sql}",
        ),
    )

    instance = (
        klass(sql=invalid_sql, database=MagicMock())
        if invalid_sql is not None
        else klass(database=MagicMock())
    )
    assert instance.sql_tables == []


def _query_with_column(column: dict[str, Any]) -> Query:
    """Build an unsaved-dataset ``Query`` exposing a single result column."""
    query = Query(
        database=Database(database_name="db", sqlalchemy_uri="sqlite://"),
        database_id=1,
        sql="SELECT ds FROM t",
    )
    query.extra = {"columns": [column]}
    return query


def _compile(column_element) -> str:
    return str(
        column_element.compile(
            dialect=sqlite.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


@pytest.mark.parametrize(
    (
        "catalog",
        "schema",
        "database_name",
        "default_catalog",
        "expected",
    ),
    [
        (None, "s1", "db", None, "[db].[s1]"),
        ("cat", "s1", "db", None, "[db].[cat].[s1]"),
        (None, "s1", "db", "defcat", "[db].[defcat].[s1]"),
        (None, None, "db", None, ""),
    ],
)
def test_query_schema_perm(
    catalog,
    schema,
    database_name,
    default_catalog,
    expected,
) -> None:
    """Query.schema_perm yields the canonical bracketed permission string.

    Regression test for the schema_access explore fix: the property must
    delegate to security_manager.get_schema_perm (which produces the format
    created by sync_permissions) so that can_access_schema can match granted
    schema_access, and must not raise when the schema is unset. When the
    query's catalog is unset, the database default catalog is used so the
    produced perm agrees with the catalog-qualified form granted by
    sync_permissions.
    """
    database = MagicMock()
    database.database_name = database_name
    database.get_default_catalog.return_value = default_catalog
    query = Query(sql="SELECT * FROM t1", schema=schema, catalog=catalog)
    query.database = database
    with patch.object(
        sql_lab_module.security_manager,
        "get_schema_perm",
        return_value=expected or None,
    ) as mock_get_schema_perm:
        result = query.schema_perm
        assert result == expected
        effective_catalog = catalog if catalog is not None else default_catalog
        mock_get_schema_perm.assert_called_once_with(
            database_name, effective_catalog, schema
        )


def test_query_schema_perm_guards_unset_database() -> None:
    """schema_perm returns "" instead of raising when the database is unset.

    Transient queries may be built from just a database_id with the relationship
    never loaded; accessing database.database_name would raise AttributeError.
    """
    query = Query(sql="SELECT * FROM t1", schema="s1", database_id=1)
    assert query.schema_perm == ""


@pytest.mark.parametrize(
    (
        "catalog",
        "schema",
        "database_name",
        "default_catalog",
        "expected",
    ),
    [
        (None, "s1", "db", None, "[db].[s1]"),
        ("cat", "s1", "db", None, "[db].[cat].[s1]"),
        (None, "s1", "db", "defcat", "[db].[defcat].[s1]"),
    ],
)
def test_saved_query_schema_perm(
    catalog,
    schema,
    database_name,
    default_catalog,
    expected,
) -> None:
    """SavedQuery.schema_perm mirrors Query.schema_perm's default-catalog
    fallback.

    Regression test: a saved query against a database with a default
    catalog can leave ``catalog`` unset (same as a raw SQL Lab ``Query``),
    so this must fall back to ``database.get_default_catalog()`` -- not
    building a ``[db].[schema]`` permission string that never matches the
    ``[db].[catalog].[schema]`` grant a schema-authorized user actually
    holds.
    """
    database = MagicMock()
    database.database_name = database_name
    database.get_default_catalog.return_value = default_catalog
    saved_query = SavedQuery(label="q", schema=schema, catalog=catalog)
    saved_query.database = database
    with patch.object(
        sql_lab_module.security_manager,
        "get_schema_perm",
        return_value=expected or None,
    ) as mock_get_schema_perm:
        result = saved_query.schema_perm
        assert result == expected
        effective_catalog = catalog if catalog is not None else default_catalog
        mock_get_schema_perm.assert_called_once_with(
            database_name, effective_catalog, schema
        )


def test_saved_query_schema_perm_guards_unset_database() -> None:
    """schema_perm returns None instead of raising when the database is
    unset, mirroring Query.schema_perm_guards_unset_database.
    """
    saved_query = SavedQuery(label="q", schema="s1", db_id=1)
    assert saved_query.schema_perm is None


def test_saved_query_before_update_syncs_dependent_slice_perms(app: Any) -> None:
    """Moving a saved query to a new schema also updates dependent charts'
    denormalized perm/catalog_perm/schema_perm.

    ``SavedQuery`` has no persisted perm columns of its own and gets no
    ``datasource_access`` PVM (unlike ``SqlaTable``/``SemanticView``), but
    ``Slice``'s ``set_related_perm`` listener still copies its computed
    perm strings onto the chart at save time. Without a ``before_update``
    listener on ``SavedQuery`` to re-copy them, a chart would keep matching
    a stale schema/catalog grant after the saved query moves -- the
    no-viewer chart-list fallback matches on ``Slice.schema_perm``/
    ``catalog_perm`` (see ``ChartFilter._apply_viewers``).
    """
    from superset.extensions import db
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.utils.core import DatasourceType

    database = Database(database_name="syncdb", sqlalchemy_uri="sqlite://")
    saved_query = SavedQuery(label="Sync Query", schema="old_schema", database=database)

    db.session.add(database)
    db.session.add(saved_query)
    db.session.flush()

    chart = Slice(
        slice_name="On the saved query",
        datasource_type=DatasourceType.SAVEDQUERY,
        datasource_id=saved_query.id,
        datasource_name="Sync Query",
        viz_type="table",
        params="{}",
    )
    db.session.add(chart)
    db.session.flush()

    try:
        assert chart.schema_perm == saved_query.schema_perm
        old_schema_perm = chart.schema_perm

        saved_query.schema = "new_schema"
        db.session.flush()
        db.session.expire(chart)
        db.session.expire(saved_query)

        new_schema_perm = saved_query.schema_perm
        assert new_schema_perm != old_schema_perm
        assert chart.schema_perm == new_schema_perm
        assert chart.catalog_perm == saved_query.catalog_perm
        assert chart.perm == saved_query.perm
    finally:
        db.session.rollback()


def test_saved_query_before_update_syncs_perms_when_database_changes(
    app: Any,
) -> None:
    """Moving a saved query to a different database re-copies the new
    database's name into dependent charts' perm/schema_perm, which only works
    when ``before_update`` reloads ``database`` from the changed ``db_id``.
    """
    from superset.extensions import db
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.utils.core import DatasourceType

    database_a = Database(database_name="move_db_a", sqlalchemy_uri="sqlite://")
    database_b = Database(database_name="move_db_b", sqlalchemy_uri="sqlite://")
    saved_query = SavedQuery(label="Move Query", schema="s1", database=database_a)

    db.session.add_all([database_a, database_b, saved_query])
    db.session.flush()

    chart = Slice(
        slice_name="On the moving saved query",
        datasource_type=DatasourceType.SAVEDQUERY,
        datasource_id=saved_query.id,
        datasource_name="Move Query",
        viz_type="table",
        params="{}",
    )
    db.session.add(chart)
    db.session.flush()

    try:
        assert "move_db_a" in chart.perm

        saved_query.db_id = database_b.id
        db.session.flush()
        db.session.expire(chart)

        assert "move_db_b" in chart.perm
        assert "move_db_a" not in chart.perm
        assert "move_db_b" in (chart.schema_perm or "")
    finally:
        db.session.rollback()


def test_saved_query_before_update_syncs_catalog_perm(app: Any) -> None:
    """Moving a saved query between catalogs replaces, not just preserves,
    the dependent chart's ``catalog_perm`` and the catalog part of its
    ``schema_perm``.
    """
    from superset.extensions import db
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.utils.core import DatasourceType

    database = Database(database_name="catdb", sqlalchemy_uri="sqlite://")
    saved_query = SavedQuery(
        label="Catalog Query", catalog="cat_a", schema="s1", database=database
    )
    db.session.add_all([database, saved_query])
    db.session.flush()

    chart = Slice(
        slice_name="On the catalog-hopping saved query",
        datasource_type=DatasourceType.SAVEDQUERY,
        datasource_id=saved_query.id,
        datasource_name="Catalog Query",
        viz_type="table",
        params="{}",
    )
    db.session.add(chart)
    db.session.flush()

    try:
        assert chart.catalog_perm == "[catdb].[cat_a]"
        assert chart.schema_perm == "[catdb].[cat_a].[s1]"

        saved_query.catalog = "cat_b"
        db.session.flush()
        db.session.expire(chart)

        assert chart.catalog_perm == "[catdb].[cat_b]"
        assert chart.schema_perm == "[catdb].[cat_b].[s1]"
    finally:
        db.session.rollback()


def test_database_rename_syncs_saved_query_chart_perms(app: Any) -> None:
    """Renaming a database rewrites the perm strings on charts backed by its
    saved queries, not only on dataset-backed charts.

    ``database_after_update`` historically only walked ``SqlaTable`` rows, so
    a saved-query chart kept ``[old].[...]`` strings after the rename and
    would match a schema/catalog grant on an unrelated connection that later
    took the old name.
    """
    from superset.extensions import db
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.utils.core import DatasourceType

    database = Database(database_name="rename_old", sqlalchemy_uri="sqlite://")
    saved_query = SavedQuery(
        label="Rename Query", catalog="c1", schema="s1", database=database
    )
    db.session.add_all([database, saved_query])
    db.session.flush()

    chart = Slice(
        slice_name="On the renamed database's saved query",
        datasource_type=DatasourceType.SAVEDQUERY,
        datasource_id=saved_query.id,
        datasource_name="Rename Query",
        viz_type="table",
        params="{}",
    )
    db.session.add(chart)
    db.session.flush()

    try:
        saved_query_id = saved_query.id
        assert chart.perm == f"[rename_old].[Rename Query](id:{saved_query_id})"
        assert chart.catalog_perm == "[rename_old].[c1]"
        assert chart.schema_perm == "[rename_old].[c1].[s1]"

        database.database_name = "rename_new"
        db.session.flush()
        db.session.expire(chart)

        assert chart.perm == f"[rename_new].[Rename Query](id:{saved_query_id})"
        assert chart.catalog_perm == "[rename_new].[c1]"
        assert chart.schema_perm == "[rename_new].[c1].[s1]"
    finally:
        db.session.rollback()


def test_saved_query_after_delete_detaches_dependent_slices(app: Any) -> None:
    """Deleting a saved query clears its charts' datasource reference and
    denormalized perm columns.

    ``slices`` has no foreign key to ``saved_query``, so without an
    ``after_delete`` listener the chart would keep the dead ``datasource_id``
    and the saved query's perm strings: a surviving schema/catalog grant
    would still list it (``ChartFilter._apply_viewers``) even though it can
    no longer resolve, and a later saved query reusing the id would be
    silently adopted. Mirrors ``_detach_dataset_charts`` in the dataset
    purge. A table-backed chart sharing the numeric id must be left alone.
    """
    from superset.extensions import db
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.utils.core import DatasourceType

    database = Database(database_name="del_db", sqlalchemy_uri="sqlite://")
    saved_query = SavedQuery(
        label="Doomed Query", catalog="c1", schema="s1", database=database
    )

    db.session.add_all([database, saved_query])
    db.session.flush()

    chart = Slice(
        slice_name="On the doomed saved query",
        datasource_type=DatasourceType.SAVEDQUERY,
        datasource_id=saved_query.id,
        datasource_name="Doomed Query",
        viz_type="table",
        params="{}",
    )
    same_id_table_chart = Slice(
        slice_name="Unrelated table chart with the same id",
        datasource_type=DatasourceType.TABLE,
        datasource_id=saved_query.id,
        datasource_name="unrelated",
        viz_type="table",
        params="{}",
    )
    db.session.add_all([chart, same_id_table_chart])
    db.session.flush()

    try:
        saved_query_id = saved_query.id
        assert chart.datasource_id == saved_query_id
        assert chart.perm == saved_query.perm
        assert chart.catalog_perm == "[del_db].[c1]"
        assert chart.schema_perm == "[del_db].[c1].[s1]"

        db.session.delete(saved_query)
        db.session.flush()
        db.session.expire(chart)
        db.session.expire(same_id_table_chart)

        assert chart.datasource_id is None
        assert chart.perm is None
        assert chart.catalog_perm is None
        assert chart.schema_perm is None

        assert same_id_table_chart.datasource_id == saved_query_id
    finally:
        db.session.rollback()


def test_adhoc_column_to_sqla_applies_time_grain_for_unsaved_dataset() -> None:
    """
    Selecting a time grain on a chart backed by an unsaved SQL Lab query must
    wrap the temporal column in the engine's time-grain expression.

    Regression test for issue #38529: the ``Query`` datasource previously
    emitted the raw column without applying the requested grain because the
    temporal metadata from the query result columns was never consulted.
    """
    query = _query_with_column(
        {"column_name": "ds", "is_dttm": True, "type": "TIMESTAMP"}
    )

    col: AdhocColumn = {
        "sqlExpression": "ds",
        "label": "ds",
        "isColumnReference": True,
        "timeGrain": "P1D",
        "columnType": "BASE_AXIS",
    }

    result, _ = query.adhoc_column_to_sqla(col)

    # SQLite's P1D (DAY) grain wraps the column in ``DATETIME(..., 'start of day')``.
    compiled = _compile(result)
    assert "DATETIME" in compiled
    assert "start of day" in compiled
    assert "ds" in compiled


def test_adhoc_column_to_sqla_skips_time_grain_without_base_axis() -> None:
    """
    The grain must only be applied for the base axis column; a temporal column
    with a ``timeGrain`` but no ``BASE_AXIS`` type is emitted as the raw column.
    """
    query = _query_with_column(
        {"column_name": "ds", "is_dttm": True, "type": "TIMESTAMP"}
    )

    col: AdhocColumn = {
        "sqlExpression": "ds",
        "label": "ds",
        "isColumnReference": True,
        "timeGrain": "P1D",
    }

    result, _ = query.adhoc_column_to_sqla(col)

    assert "start of day" not in _compile(result)


def test_adhoc_column_to_sqla_skips_time_grain_for_non_temporal_column() -> None:
    """
    A non-temporal column must not be wrapped in a time-grain expression even
    when a ``timeGrain`` is requested for the base axis.
    """
    query = _query_with_column(
        {"column_name": "ds", "is_dttm": False, "type": "VARCHAR"}
    )

    col: AdhocColumn = {
        "sqlExpression": "ds",
        "label": "ds",
        "isColumnReference": True,
        "timeGrain": "P1D",
        "columnType": "BASE_AXIS",
    }

    result, _ = query.adhoc_column_to_sqla(col)

    assert "start of day" not in _compile(result)
