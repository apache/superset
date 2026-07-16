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

from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.exceptions import QueryClauseValidationException
from superset.sql.metric_normalization import (
    normalize_custom_metric,
    SqlCommentConverter,
)


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
        PostgresEngineSpec.normalize_custom_sql_metric,
    )

    assert normalized_metric.expression == expected
    assert normalized_metric.may_preserve_source is ("*/" not in expression)


def test_postgres_alias_preserves_normalized_source() -> None:
    normalized_metric = normalize_custom_metric(
        "DATE_TRUNC('QUARTER', created_at) -- trailing",
        "postgres",
        PostgresEngineSpec.normalize_custom_sql_metric,
    )

    assert normalized_metric.expression == (
        "DATE_TRUNC('quarter', created_at) /* trailing */"
    )
    assert normalized_metric.may_preserve_source


def test_postgres_alias_uses_postgres_dialect_for_fallback() -> None:
    normalized_metric = normalize_custom_metric(
        "DATE_TRUNC('QUARTER', created_at) -- contains */",
        "postgres",
        PostgresEngineSpec.normalize_custom_sql_metric,
    )

    assert normalized_metric.expression == (
        "TIMESTAMP_TRUNC(created_at, QUARTER) /* contains * / */"
    )
    assert not normalized_metric.may_preserve_source


def test_trims_trailing_semicolon() -> None:
    normalized_metric = normalize_custom_metric(
        "DATE_TRUNC('QUARTER', created_at);  ",
        "postgresql",
        PostgresEngineSpec.normalize_custom_sql_metric,
    )

    assert normalized_metric.expression == "DATE_TRUNC('quarter', created_at)"
    assert normalized_metric.may_preserve_source


def test_invalid_fallback_expression_raises_validation_error() -> None:
    with pytest.raises(QueryClauseValidationException):
        normalize_custom_metric(
            "DATE_TRUNC('QUARTER', created_at) -- contains */\nSELECT",
            "postgresql",
            PostgresEngineSpec.normalize_custom_sql_metric,
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
    normalized_metric = normalize_custom_metric(
        "CUSTOM(value)",
        "sqlite",
        str.lower,
    )

    assert normalized_metric.expression == "custom(value)"
    assert not normalized_metric.may_preserve_source
