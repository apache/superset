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
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import pytest

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.cockroachdb import CockroachDbEngineSpec
from superset.db_engine_specs.greenplum import GreenplumEngineSpec
from superset.db_engine_specs.netezza import NetezzaEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.db_engine_specs.risingwave import RisingWaveDbEngineSpec
from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.db_engine_specs.timescaledb import TimescaleDBEngineSpec
from superset.exceptions import QueryClauseValidationException
from superset.sql.dialects.postgres import normalize_date_trunc_units
from superset.sql.metric_normalization import (
    CommentConversionError,
    normalize_custom_metric,
    NormalizedMetric,
    SqlCommentConverter,
)


def test_normalize_date_trunc_units_preserves_unparseable_expression() -> None:
    expression: str = "DATE_TRUNC('QUARTER"

    assert normalize_date_trunc_units(expression) == expression


@pytest.mark.parametrize(
    "expression, expected",
    [
        ("SELECT 'abc\\' -- trailing", "SELECT 'abc\\' /* trailing */"),
        (
            "SELECT DATE_TRUNC('QUARTER', created_at) -- contains */",
            "SELECT TIMESTAMP_TRUNC(created_at, QUARTER) /* contains * / */",
        ),
    ],
)
def test_comment_conversion_fallback(
    expression: str,
    expected: str,
) -> None:
    normalized_metric = normalize_custom_metric(
        expression,
        "postgresql",
        PostgresEngineSpec,
    )

    assert normalized_metric.expression == expected
    assert normalized_metric.may_preserve_source is ("*/" not in expression)


def test_postgres_alias_preserves_normalized_source() -> None:
    normalized_metric = normalize_custom_metric(
        "DATE_TRUNC('QUARTER', created_at) -- trailing",
        "postgres",
        PostgresEngineSpec,
    )

    assert normalized_metric.expression == (
        "DATE_TRUNC('quarter', created_at) /* trailing */"
    )
    assert normalized_metric.may_preserve_source


def test_postgres_alias_uses_postgres_dialect_for_fallback() -> None:
    normalized_metric = normalize_custom_metric(
        "DATE_TRUNC('QUARTER', created_at) -- contains */",
        "postgres",
        PostgresEngineSpec,
    )

    assert normalized_metric.expression == (
        "TIMESTAMP_TRUNC(created_at, QUARTER) /* contains * / */"
    )
    assert not normalized_metric.may_preserve_source


def test_trims_trailing_semicolon() -> None:
    normalized_metric = normalize_custom_metric(
        "DATE_TRUNC('QUARTER', created_at);  ",
        "postgresql",
        PostgresEngineSpec,
    )

    assert normalized_metric.expression == "DATE_TRUNC('quarter', created_at)"
    assert normalized_metric.may_preserve_source


def test_invalid_fallback_expression_raises_validation_error() -> None:
    with pytest.raises(QueryClauseValidationException):
        normalize_custom_metric(
            "DATE_TRUNC('QUARTER', created_at) -- contains */\nSELECT",
            "postgresql",
            PostgresEngineSpec,
        )


@pytest.mark.parametrize(
    "expression, expected",
    [
        ("SUM(value) /* block */", "SUM(value) /* block */"),
        ("SUM('$tag$ -- text $tag$'::text)", "SUM('$tag$ -- text $tag$'::text)"),
        ("SUM($tag$ -- text $tag$::text)", "SUM($tag$ -- text $tag$::text)"),
        ("SUM($$ -- text $$::text)", "SUM($$ -- text $$::text)"),
        ("SUM('it''s -- text'::text)", "SUM('it''s -- text'::text)"),
        ("SUM(E'it\\'s -- text'::text)", "SUM(E'it\\'s -- text'::text)"),
        ('SUM("quoted--identifier")', 'SUM("quoted--identifier")'),
        ("SUM(value) -- first\rSUM(other)", "SUM(value) /* first */\rSUM(other)"),
        ("$not_a_tag", "$not_a_tag"),
    ],
)
def test_comment_converter_preserves_quoted_regions(
    expression: str,
    expected: str,
) -> None:
    converted = SqlCommentConverter(expression).convert()

    assert converted.expression == expected
    assert converted.may_preserve_source


@pytest.mark.parametrize(
    "expression",
    [
        "SUM(value) /* unterminated",
        "SUM($tag$ unterminated)",
        "SUM('unterminated)",
        'SUM("unterminated)',
    ],
)
def test_comment_converter_rejects_unterminated_regions(expression: str) -> None:
    with pytest.raises(ValueError, match="Unterminated SQL"):
        SqlCommentConverter(expression).convert()


def test_non_postgres_engine_uses_normalizer_without_source_preservation() -> None:
    class LowercasingEngineSpec(SqliteEngineSpec):
        @classmethod
        def normalize_custom_sql_metric(cls, expression: str) -> str:
            return expression.lower()

    normalized_metric = normalize_custom_metric(
        "CUSTOM(value)",
        "sqlite",
        LowercasingEngineSpec,
    )

    assert normalized_metric.expression == "custom(value)"
    assert not normalized_metric.may_preserve_source


@pytest.mark.parametrize(
    "engine, db_engine_spec",
    [
        ("cockroachdb", CockroachDbEngineSpec),
        ("greenplum", GreenplumEngineSpec),
        ("netezza", NetezzaEngineSpec),
        ("risingwave", RisingWaveDbEngineSpec),
        ("timescaledb", TimescaleDBEngineSpec),
    ],
)
def test_postgres_family_engines_preserve_normalized_source(
    engine: str,
    db_engine_spec: type[BaseEngineSpec],
) -> None:
    """
    Every spec inheriting PostgresBaseEngineSpec's lowercase DATE_TRUNC grains
    must normalize custom metric units and skip SQLGlot re-rendering, which
    would otherwise turn the call into ``TIMESTAMP_TRUNC(created_at, QUARTER)``.
    """
    normalized_metric = normalize_custom_metric(
        "DATE_TRUNC('QUARTER', created_at) -- trailing",
        engine,
        db_engine_spec,
    )

    assert normalized_metric.expression == (
        "DATE_TRUNC('quarter', created_at) /* trailing */"
    )
    assert normalized_metric.may_preserve_source


def test_snowflake_keeps_uppercase_units_without_source_preservation() -> None:
    expression = "DATE_TRUNC('QUARTER', created_at)"

    normalized_metric = normalize_custom_metric(
        expression,
        "snowflake",
        SnowflakeEngineSpec,
    )

    assert normalized_metric.expression == expression
    assert not normalized_metric.may_preserve_source


def test_comment_conversion_error_subclasses_value_error() -> None:
    with pytest.raises(CommentConversionError, match="Unterminated SQL"):
        SqlCommentConverter("SUM('unterminated)").convert()

    assert issubclass(CommentConversionError, ValueError)


def test_normalize_custom_metric_does_not_swallow_unrelated_value_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A ValueError from convert() that is not a CommentConversionError propagates.

    The fallback only catches the converter's own signal; an unexpected
    ValueError inside convert() must surface rather than being silently degraded
    to the sanitize_clause path.
    """

    def boom(self: SqlCommentConverter) -> NormalizedMetric:
        raise ValueError("unrelated converter bug")

    monkeypatch.setattr(SqlCommentConverter, "convert", boom)

    with pytest.raises(ValueError, match="unrelated converter bug"):
        normalize_custom_metric(
            "DATE_TRUNC('QUARTER', created_at)", "postgresql", PostgresEngineSpec
        )


def test_greenplum_fallback_parses_under_postgres_dialect() -> None:
    """The greenplum sanitize_clause fallback now resolves to the Postgres dialect.

    The ``*/``-bearing line comment forces the fallback branch, where
    ``sanitize_clause(expr, "greenplum")`` builds its statement — previously under
    the generic base dialect, now under Postgres via the SQLGLOT_DIALECTS mapping.
    A Postgres ``::`` cast in the clause must survive rather than fail to parse.
    """
    normalized_metric = normalize_custom_metric(
        "SUM(created_at::timestamp) -- note */",
        "greenplum",
        GreenplumEngineSpec,
    )

    assert "created_at" in normalized_metric.expression
    assert not normalized_metric.may_preserve_source
