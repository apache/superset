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
"""
Tests that a virtual dataset's rendered SQL has any table introduced by a
request-time template value access-checked against the caller, consistent with
the per-table authorization SQL Lab applies to raw queries.

A virtual dataset's stored SQL is re-rendered with the caller's Jinja context at
query time (e.g. ``url_param`` reads live request args), so the tables the
rendered FROM/JOIN resolves to can differ from those the dataset author
declared. The dataset-level grant only covers the dataset itself, so a table
that only appears because of a request-time value must be authorized separately.

The "declared" table set is computed by rendering the stored SQL with only the
request-controllable macros stubbed to a sentinel while identity macros
(``current_username`` and siblings) render with their real value, so a table
keyed off identity (the per-tenant ``tenant_{{ current_username() }}.sales``
pattern) resolves identically on both sides and is not mistaken for a
request-introduced table.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from flask import Flask
from pytest_mock import MockerFixture
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql.elements import TextClause

from superset.models.helpers import ExploreMixin
from superset.sql.parse import SQLScript


@pytest.fixture
def virtual_datasource() -> MagicMock:
    """A mock datasource that behaves like a virtual (query-backed) dataset."""
    datasource = MagicMock(spec=ExploreMixin)

    # Bind the real instance methods under test.
    for name in (
        "get_from_clause",
        "_authorize_request_resolved_tables",
        "_declared_tables",
        "_parse_qualified_tables",
        "_render_declared_sql",
    ):
        setattr(datasource, name, getattr(ExploreMixin, name).__get__(datasource))
    # Static methods need no binding.
    datasource._neutralize_jinja = ExploreMixin._neutralize_jinja
    datasource._qualified_tables = ExploreMixin._qualified_tables

    datasource.text = lambda sql: TextClause(sql)
    datasource.db_engine_spec.engine = "postgresql"
    datasource.db_engine_spec.get_cte_query.return_value = None
    datasource.db_engine_spec.cte_alias = "__cte"
    datasource.database.get_default_schema.return_value = "public"
    datasource.catalog = None
    datasource.schema = "public"
    # By default no template processor is available, so the declared-table set
    # falls back to static neutralization of the stored SQL.
    datasource.get_template_processor.side_effect = NotImplementedError
    return datasource


def _use_real_template_processor(
    datasource: MagicMock, mocker: MockerFixture, *, username: str = "alice"
) -> None:
    """Give the datasource a real Jinja processor so the declared-table set is
    computed by rendering the stored SQL (identity macros live, request macros
    stubbed) rather than by static neutralization."""
    from superset.jinja_context import JinjaTemplateProcessor

    mock_g = mocker.patch("superset.utils.core.g")
    mock_g.user.username = username

    database = MagicMock()
    database.get_dialect.return_value = postgresql.dialect()

    def factory(**_kwargs: Any) -> JinjaTemplateProcessor:
        return JinjaTemplateProcessor(database=database)

    datasource.get_template_processor.side_effect = factory


def _configure(datasource: MagicMock, *, stored_sql: str, rendered_sql: str) -> None:
    datasource.sql = stored_sql
    datasource.get_rendered_sql.return_value = rendered_sql


def _run(datasource: MagicMock) -> Any:
    return datasource.get_from_clause(template_processor=None)


def test_static_virtual_dataset_skips_table_authorization(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """A non-templated virtual dataset resolves to exactly the declared tables,
    which the dataset-level grant already covers, so no per-table check runs."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    sql = "SELECT a, b FROM public.sales"
    _configure(virtual_datasource, stored_sql=sql, rendered_sql=sql)

    _run(virtual_datasource)

    raise_for_access.assert_not_called()


def test_templated_value_only_skips_table_authorization(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """Templating that only affects a filter value (not the resolved tables)
    introduces no new table, so no per-table check runs."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    _configure(
        virtual_datasource,
        stored_sql="SELECT * FROM public.sales WHERE r = '{{ url_param('r') }}'",
        rendered_sql="SELECT * FROM public.sales WHERE r = 'emea'",
    )

    _run(virtual_datasource)

    raise_for_access.assert_not_called()


def test_request_introduced_table_is_authorized(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """A table that only appears because a request-time value was substituted
    into the FROM clause is access-checked with the strict SQL Lab semantics."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    _configure(
        virtual_datasource,
        stored_sql="SELECT * FROM {{ url_param('tbl') }}",
        rendered_sql="SELECT * FROM public.secret",
    )

    _run(virtual_datasource)

    raise_for_access.assert_called_once()
    kwargs = raise_for_access.call_args.kwargs
    assert kwargs["force_dataset_match"] is True
    assert kwargs["database"] is virtual_datasource.database
    assert kwargs["table"].table == "secret"
    assert kwargs["table"].schema == "public"


def test_only_request_introduced_table_is_checked(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """A statically declared table (covered by the dataset grant) is left alone;
    only the table a request-time value adds to the rendered SQL is checked."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    _configure(
        virtual_datasource,
        stored_sql=(
            "SELECT * FROM public.base JOIN {{ url_param('t') }} AS x ON x.id = base.id"
        ),
        rendered_sql=(
            "SELECT * FROM public.base JOIN public.secret AS x ON x.id = base.id"
        ),
    )

    _run(virtual_datasource)

    raise_for_access.assert_called_once()
    assert raise_for_access.call_args.kwargs["table"].table == "secret"


def test_every_request_introduced_join_target_is_checked(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """Two distinct tables introduced by request values are each checked, so an
    implementation that authorized only the first would not pass."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    _configure(
        virtual_datasource,
        stored_sql=(
            "SELECT * FROM {{ url_param('a') }} "
            "JOIN {{ url_param('b') }} AS y ON y.id = 1"
        ),
        rendered_sql=(
            "SELECT * FROM public.secret_a JOIN public.secret_b AS y ON y.id = 1"
        ),
    )

    _run(virtual_datasource)

    # Each request-introduced JOIN target must be checked individually: an
    # implementation that walked only the first FROM target and skipped the
    # additional JOIN target would make exactly one call, so assert on both the
    # per-table set and the call count.
    checked = [call.kwargs["table"].table for call in raise_for_access.call_args_list]
    assert raise_for_access.call_count == 2
    assert sorted(checked) == ["secret_a", "secret_b"]


def test_undetermined_declared_set_checks_every_rendered_table(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """When the declared-table set cannot be determined (both the render and the
    static fallback fail to parse, so ``_declared_tables`` returns ``None``),
    every rendered table is treated as request-resolved and access-checked. A
    regression that read an unknown declared set as "authorize nothing" would
    leave the rendered tables unchecked, so assert each one is checked and that
    the count matches the rendered tables (fail closed, not fail open)."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")

    # Force the declared-table set to be undeterminable.
    virtual_datasource._declared_tables = MagicMock(return_value=None)
    virtual_datasource.sql = (
        "SELECT * FROM {{ url_param('a') }} JOIN {{ url_param('b') }} AS y ON y.id = 1"
    )
    # The rendered statement itself parses cleanly into two tables; only the
    # declared set is unknown, which alone must trip the fail-closed path.
    parsed_script = SQLScript(
        "SELECT * FROM public.secret_a JOIN public.secret_b AS y ON y.id = 1",
        engine="postgresql",
    )
    assert parsed_script.has_unparseable_statement is False
    assert parsed_script.changes_default_schema() is False

    virtual_datasource._authorize_request_resolved_tables(parsed_script)

    checked = [call.kwargs["table"].table for call in raise_for_access.call_args_list]
    assert raise_for_access.call_count == 2
    assert sorted(checked) == ["secret_a", "secret_b"]


def test_unauthorized_request_table_is_rejected(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """When the caller cannot access the request-introduced table, the strict
    check raises and the query is not built (fail closed)."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    error = SupersetError(
        error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
        message="denied",
        level=ErrorLevel.ERROR,
    )
    mocker.patch(
        "superset.security_manager.raise_for_access",
        side_effect=SupersetSecurityException(error),
    )
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    _configure(
        virtual_datasource,
        stored_sql="SELECT * FROM {{ url_param('tbl') }}",
        rendered_sql="SELECT * FROM public.secret",
    )

    with pytest.raises(SupersetSecurityException):
        _run(virtual_datasource)


def test_authorized_request_table_is_allowed(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """When the caller can access the request-introduced table, the query is
    built normally."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)

    _configure(
        virtual_datasource,
        stored_sql="SELECT * FROM {{ url_param('tbl') }}",
        rendered_sql="SELECT * FROM public.granted",
    )

    from_clause, _cte = _run(virtual_datasource)

    raise_for_access.assert_called_once()
    assert from_clause is not None


def test_identity_parameterized_table_is_not_flagged(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """The per-tenant pattern ``tenant_{{ current_username() }}.sales`` resolves
    to the same table on both the live render and the declared render (identity
    macros are not request-controllable), so it is covered by the dataset grant
    and no extra per-table check runs."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)
    _use_real_template_processor(virtual_datasource, mocker, username="alice")

    _configure(
        virtual_datasource,
        stored_sql="SELECT * FROM tenant_{{ current_username() }}.sales",
        rendered_sql="SELECT * FROM tenant_alice.sales",
    )

    from_clause, _cte = _run(virtual_datasource)

    raise_for_access.assert_not_called()
    assert from_clause is not None


def test_request_macro_still_flagged_with_real_processor(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """With a real processor, an attacker-controllable macro in a FROM position
    stubs to a sentinel in the declared render, so the live table it resolves to
    is still isolated and access-checked (the identity handling does not open a
    hole for request-controllable macros)."""
    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")
    mocker.patch("superset.models.helpers.apply_rls", return_value=False)
    _use_real_template_processor(virtual_datasource, mocker, username="alice")

    _configure(
        virtual_datasource,
        stored_sql="SELECT * FROM {{ url_param('t') }}",
        rendered_sql="SELECT * FROM public.secret",
    )

    _run(virtual_datasource)

    raise_for_access.assert_called_once()
    assert raise_for_access.call_args.kwargs["table"].table == "secret"


def test_unparseable_rendered_statement_fails_closed(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """A rendered statement sqlglot cannot fully model (an ``exp.Command`` from
    dynamic SQL) hides its tables from both parses, so it is rejected rather
    than silently skipping the per-table check."""
    from superset.exceptions import SupersetSecurityException

    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")

    virtual_datasource.sql = "SELECT * FROM {{ url_param('t') }}"
    # A statement sqlglot falls back to parsing as a Command; its table
    # references are not enumerable.
    parsed_script = SQLScript("SHOW TABLES FROM secret_schema", engine="postgresql")
    assert parsed_script.has_unparseable_statement is True

    with pytest.raises(SupersetSecurityException):
        virtual_datasource._authorize_request_resolved_tables(parsed_script)

    raise_for_access.assert_not_called()


def test_default_schema_change_fails_closed(
    virtual_datasource: MagicMock,
    app: Flask,
    mocker: MockerFixture,
) -> None:
    """A rendered statement that rebinds how unqualified names resolve (e.g.
    ``search_path``) makes the declared-vs-rendered qualification unsound, so it
    is rejected rather than compared with the dataset's schema."""
    from superset.exceptions import SupersetSecurityException

    raise_for_access = mocker.patch("superset.security_manager.raise_for_access")

    virtual_datasource.sql = "SET search_path TO {{ url_param('s') }}"
    parsed_script = SQLScript("SET search_path TO secret_schema", engine="postgresql")
    assert parsed_script.changes_default_schema() is True

    with pytest.raises(SupersetSecurityException):
        virtual_datasource._authorize_request_resolved_tables(parsed_script)

    raise_for_access.assert_not_called()
