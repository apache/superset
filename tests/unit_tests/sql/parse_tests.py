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
# pylint: disable=invalid-name, redefined-outer-name, too-many-lines


import logging

import pytest
import sqlglot
from pytest_mock import MockerFixture
from sqlglot import Dialects, exp, parse_one

from superset.exceptions import QueryClauseValidationException, SupersetParseError
from superset.jinja_context import JinjaTemplateProcessor
from superset.sql.parse import (
    _check_script_length,
    _count_weighted_table_references,
    BaseSQLStatement,
    count_referenced_tables,
    CTASMethod,
    extract_tables_from_statement,
    has_aggregate,
    JinjaSQLResult,
    KQLTokenType,
    KustoKQLStatement,
    LimitMethod,
    Partition,
    process_jinja_sql,
    remove_quotes,
    RLSMethod,
    sanitize_clause,
    split_kql,
    SQLGLOT_DIALECTS,
    SQLScript,
    SQLStatement,
    Table,
    tokenize_kql,
    transpile_to_dialect,
)
from tests.integration_tests.conftest import with_feature_flags


def test_table() -> None:
    """
    Test the `Table` class and its string conversion.

    Special characters in the table, schema, or catalog name should be escaped correctly.
    """  # noqa: E501
    assert str(Table("tbname")) == "tbname"
    assert str(Table("tbname", "schemaname")) == "schemaname.tbname"
    assert (
        str(Table("tbname", "schemaname", "catalogname"))
        == "catalogname.schemaname.tbname"
    )
    assert (
        str(Table("table.name", "schema/name", "catalog\nname"))
        == "catalog%0Aname.schema%2Fname.table%2Ename"
    )


def test_table_qualify() -> None:
    """
    Test the `Table.qualify` method.

    The qualify method should add schema and/or catalog if not already set,
    but should not override existing values.
    """
    # Table with no schema or catalog
    table = Table("tbname")

    # Add schema only
    qualified = table.qualify(schema="schemaname")
    assert qualified.table == "tbname"
    assert qualified.schema == "schemaname"
    assert qualified.catalog is None
    assert str(qualified) == "schemaname.tbname"

    # Add catalog only
    qualified = table.qualify(catalog="catalogname")
    assert qualified.table == "tbname"
    assert qualified.schema is None
    assert qualified.catalog == "catalogname"
    assert str(qualified) == "catalogname.tbname"

    # Add both schema and catalog
    qualified = table.qualify(schema="schemaname", catalog="catalogname")
    assert qualified.table == "tbname"
    assert qualified.schema == "schemaname"
    assert qualified.catalog == "catalogname"
    assert str(qualified) == "catalogname.schemaname.tbname"

    # Table with existing schema - should not override
    table_with_schema = Table("tbname", "existingschema")
    qualified = table_with_schema.qualify(schema="newschema")
    assert qualified.schema == "existingschema"
    assert str(qualified) == "existingschema.tbname"

    # Table with existing catalog - should not override
    table_with_catalog = Table("tbname", catalog="existingcatalog")
    qualified = table_with_catalog.qualify(catalog="newcatalog")
    assert qualified.catalog == "existingcatalog"
    assert str(qualified) == "existingcatalog.tbname"

    # Table with existing schema and catalog - should not override
    fully_qualified = Table("tbname", "existingschema", "existingcatalog")
    qualified = fully_qualified.qualify(schema="newschema", catalog="newcatalog")
    assert qualified.schema == "existingschema"
    assert qualified.catalog == "existingcatalog"
    assert str(qualified) == "existingcatalog.existingschema.tbname"

    # Table with schema but no catalog - should add catalog only
    table_with_schema_only = Table("tbname", "existingschema")
    qualified = table_with_schema_only.qualify(
        schema="newschema", catalog="catalogname"
    )
    assert qualified.schema == "existingschema"
    assert qualified.catalog == "catalogname"
    assert str(qualified) == "catalogname.existingschema.tbname"

    # Table with catalog but no schema - should add schema only
    table_with_catalog_only = Table("tbname", catalog="existingcatalog")
    qualified = table_with_catalog_only.qualify(
        schema="schemaname", catalog="newcatalog"
    )
    assert qualified.schema == "schemaname"
    assert qualified.catalog == "existingcatalog"
    assert str(qualified) == "existingcatalog.schemaname.tbname"

    # Calling qualify with no arguments should return equivalent table
    qualified = table.qualify()
    assert qualified.table == table.table
    assert qualified.schema == table.schema
    assert qualified.catalog == table.catalog


def test_partition() -> None:
    """
    Test the `Partition` class and its string conversion.
    """
    # Test partitioned table with partition columns
    partition = Partition(is_partitioned_table=True, partition_column=("col1", "col2"))
    assert partition.is_partitioned_table is True
    assert partition.partition_column == ("col1", "col2")
    assert (
        str(partition)
        == "Partition(is_partitioned_table=True, partition_column=[col1, col2])"
    )

    # Test non-partitioned table
    partition_none = Partition(is_partitioned_table=False, partition_column=None)
    assert partition_none.is_partitioned_table is False
    assert partition_none.partition_column is None
    assert (
        str(partition_none)
        == "Partition(is_partitioned_table=False, partition_column=[None])"
    )

    # Test equality
    partition1 = Partition(is_partitioned_table=True, partition_column=("col1",))
    partition2 = Partition(is_partitioned_table=True, partition_column=("col1",))
    partition3 = Partition(is_partitioned_table=True, partition_column=("col2",))
    assert partition1 == partition2
    assert partition1 != partition3

    # A frozen dataclass with a tuple field must be hashable (a list field would
    # raise TypeError: unhashable type at hash time).
    assert hash(partition1) == hash(partition2)
    assert len({partition1, partition2, partition3}) == 2


def extract_tables_from_sql(sql: str, engine: str = "postgresql") -> set[Table]:
    """
    Helper function to extract tables from SQL.
    """
    dialect = SQLGLOT_DIALECTS.get(engine)
    return {
        table
        for statement in SQLScript(sql, engine).statements
        for table in extract_tables_from_statement(statement._parsed, dialect)
    }


def test_extract_tables_from_sql() -> None:
    """
    Test that referenced tables are parsed correctly from the SQL.
    """
    assert extract_tables_from_sql("SELECT * FROM tbname") == {Table("tbname")}
    assert extract_tables_from_sql("SELECT * FROM tbname foo") == {Table("tbname")}
    assert extract_tables_from_sql("SELECT * FROM tbname AS foo") == {Table("tbname")}

    # underscore
    assert extract_tables_from_sql("SELECT * FROM tb_name") == {Table("tb_name")}

    # quotes
    assert extract_tables_from_sql('SELECT * FROM "tbname"') == {Table("tbname")}

    # unicode
    assert extract_tables_from_sql('SELECT * FROM "tb_name" WHERE city = "Lübeck"') == {
        Table("tb_name")
    }

    # columns
    assert extract_tables_from_sql("SELECT field1, field2 FROM tb_name") == {
        Table("tb_name")
    }
    assert extract_tables_from_sql("SELECT t1.f1, t2.f2 FROM t1, t2") == {
        Table("t1"),
        Table("t2"),
    }

    # named table
    assert extract_tables_from_sql(
        "SELECT a.date, a.field FROM left_table a LIMIT 10"
    ) == {Table("left_table")}

    assert extract_tables_from_sql(
        "SELECT FROM (SELECT FROM forbidden_table) AS forbidden_table;"
    ) == {Table("forbidden_table")}

    assert extract_tables_from_sql(
        "select * from (select * from forbidden_table) forbidden_table"
    ) == {Table("forbidden_table")}


def test_count_referenced_tables() -> None:
    """
    Test that ``count_referenced_tables`` counts table reference occurrences
    (not distinct tables), ignoring dotted quoted aliases, and falls back to
    1 for unparseable SQL.
    """
    assert count_referenced_tables('SELECT * FROM "db.table1"', Dialects.SQLITE) == 1
    assert (
        count_referenced_tables(
            'SELECT COUNT(id) AS "metric.value" FROM "db.table1"', Dialects.SQLITE
        )
        == 1
    )
    assert (
        count_referenced_tables(
            'SELECT t1.b, t2.b FROM "db.table1" AS t1 '
            'JOIN "db.table2" AS t2 ON t1.a = t2.a',
            Dialects.SQLITE,
        )
        == 2
    )
    assert count_referenced_tables("this is not valid sql (((", Dialects.SQLITE) == 1
    assert count_referenced_tables("SHOW CREATE TABLE s1.t1", "mysql") == 1


def test_count_referenced_tables_self_join() -> None:
    """
    A self-join references the same physical table twice via two aliases;
    it must still count as 2 (a join), not 1 (deduplicated to a single
    table), or the caller's multi-table detection would incorrectly treat
    it as single-table.
    """
    assert (
        count_referenced_tables(
            'SELECT l.a, r.a FROM "db.table1" AS l JOIN "db.table1" AS r ON l.a = r.a',
            Dialects.SQLITE,
        )
        == 2
    )


def test_count_referenced_tables_cte_self_join() -> None:
    """
    A CTE that reads a single virtual table and is then self-joined must
    count as 2, matching the direct self-join case, since the CTE is
    inlined at each of its two consumption sites and triggers a read of
    that table for both sides of the join.
    """
    assert (
        count_referenced_tables(
            'WITH cte AS (SELECT a FROM "db.table1") '
            "SELECT l.a, r.a FROM cte AS l JOIN cte AS r ON l.a = r.a",
            Dialects.SQLITE,
        )
        == 2
    )
    # A CTE used exactly once, with no join, still counts as a single table.
    assert (
        count_referenced_tables(
            'WITH cte AS (SELECT a FROM "db.table1") SELECT a FROM cte',
            Dialects.SQLITE,
        )
        == 1
    )
    # A CTE joined against a distinct real table also counts as 2.
    assert (
        count_referenced_tables(
            'WITH cte AS (SELECT a FROM "db.table1") '
            'SELECT l.a, r.a FROM cte AS l JOIN "db.table2" AS r ON l.a = r.a',
            Dialects.SQLITE,
        )
        == 2
    )
    # Nested CTEs: a CTE built on top of another CTE, then self-joined,
    # still weights the base CTE's own table by the self-join count.
    assert (
        count_referenced_tables(
            'WITH base AS (SELECT a FROM "db.table1"), derived AS (SELECT a FROM base) '
            "SELECT l.a, r.a FROM derived AS l JOIN derived AS r ON l.a = r.a",
            Dialects.SQLITE,
        )
        == 2
    )


def test_count_referenced_tables_describe() -> None:
    """
    ``DESCRIBE`` (and other ``exp.Describe``/``exp.Command`` statements) has
    no join semantics for a per-table row cap to interact with, so it takes
    the plain unweighted table-extraction path rather than
    ``_count_weighted_table_references``.
    """
    assert count_referenced_tables("DESCRIBE table1", Dialects.SQLITE) == 1


def test_count_referenced_tables_derived_subqueries() -> None:
    """
    Two distinct derived (non-CTE) subqueries joined together must each
    resolve their own tables directly, without recursing as if they were
    CTE sources -- covering the branch in ``_count_weighted_table_references``
    where a selected source is a ``Scope`` but not a CTE.
    """
    assert (
        count_referenced_tables(
            'SELECT l.a, r.a FROM (SELECT a FROM "db.table1") AS l '
            'JOIN (SELECT a FROM "db.table1") AS r ON l.a = r.a',
            Dialects.SQLITE,
        )
        == 2
    )


def test_count_weighted_table_references_self_referential_scope_guard(
    mocker: MockerFixture,
) -> None:
    """
    ``_count_weighted_table_references`` must not recurse forever on a
    self-referential ``Scope`` graph, the shape a ``WITH RECURSIVE`` CTE
    could in principle produce if sqlglot ever resolved its own
    self-reference to the same ``Scope`` object instead of a bare
    ``exp.Table``. The ``seen`` guard must catch the repeat visit and treat
    it as contributing no further table reads.
    """
    from sqlglot.optimizer.scope import Scope, ScopeType  # noqa: PLC0415

    cte_scope = Scope.__new__(Scope)
    cte_scope.scope_type = ScopeType.CTE
    # The CTE's own body references itself.
    cte_scope._selected_sources = {"t": (None, cte_scope)}  # noqa: SLF001

    root_scope = Scope.__new__(Scope)
    root_scope.scope_type = ScopeType.ROOT
    root_scope._selected_sources = {"t": (None, cte_scope)}  # noqa: SLF001

    mocker.patch(
        "superset.sql.parse.traverse_scope",
        return_value=[cte_scope, root_scope],
    )

    assert _count_weighted_table_references(mocker.MagicMock()) == 0


def test_count_referenced_tables_respects_parse_length_cap(
    mocker: MockerFixture,
) -> None:
    """
    ``count_referenced_tables`` must not bypass ``SQL_MAX_PARSE_LENGTH``: an
    oversized statement should fail the length check before reaching
    sqlglot, and fall back to the conservative single-table count. The
    statement references two tables so that bypassing the guard (and
    reaching sqlglot) would produce a different, detectable result.
    """
    mocker.patch("superset.config.SQL_MAX_PARSE_LENGTH", 100)
    mocker.patch("superset.sql.parse.has_app_context", return_value=False)
    padding = "1, " * 50
    statement = (
        'SELECT * FROM "db.table1" AS t1 '  # noqa: S608
        'JOIN "db.table2" AS t2 ON t1.a = t2.a '
        f"WHERE t1.a IN ({padding}1)"
    )
    assert len(statement.encode("utf-8")) > 100
    assert count_referenced_tables(statement, Dialects.SQLITE) == 1


def test_extract_tables_subselect() -> None:
    """
    Test that tables inside subselects are parsed correctly.
    """
    assert extract_tables_from_sql(
        """
SELECT sub.*
FROM (
    SELECT *
        FROM s1.t1
        WHERE day_of_week = 'Friday'
    ) sub, s2.t2
WHERE sub.resolution = 'NONE'
"""
    ) == {Table("t1", "s1"), Table("t2", "s2")}

    assert extract_tables_from_sql(
        """
SELECT sub.*
FROM (
    SELECT *
    FROM s1.t1
    WHERE day_of_week = 'Friday'
) sub
WHERE sub.resolution = 'NONE'
"""
    ) == {Table("t1", "s1")}

    assert extract_tables_from_sql(
        """
SELECT * FROM t1
WHERE s11 > ANY (
    SELECT COUNT(*) /* no hint */ FROM t2
    WHERE NOT EXISTS (
        SELECT * FROM t3
        WHERE ROW(5*t2.s1,77)=(
            SELECT 50,11*s1 FROM t4
        )
    )
)
"""
    ) == {Table("t1"), Table("t2"), Table("t3"), Table("t4")}


def test_extract_tables_select_in_expression() -> None:
    """
    Test that parser works with `SELECT`s used as expressions.
    """
    assert extract_tables_from_sql("SELECT f1, (SELECT count(1) FROM t2) FROM t1") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql(
        "SELECT f1, (SELECT count(1) FROM t2) as f2 FROM t1"
    ) == {
        Table("t1"),
        Table("t2"),
    }


def test_extract_tables_parenthesis() -> None:
    """
    Test that parenthesis are parsed correctly.
    """
    assert extract_tables_from_sql("SELECT f1, (x + y) AS f2 FROM t1") == {Table("t1")}


def test_extract_tables_with_schema() -> None:
    """
    Test that schemas are parsed correctly.
    """
    assert extract_tables_from_sql("SELECT * FROM schemaname.tbname") == {
        Table("tbname", "schemaname")
    }
    assert extract_tables_from_sql('SELECT * FROM "schemaname"."tbname"') == {
        Table("tbname", "schemaname")
    }
    assert extract_tables_from_sql('SELECT * FROM "schemaname"."tbname" foo') == {
        Table("tbname", "schemaname")
    }
    assert extract_tables_from_sql('SELECT * FROM "schemaname"."tbname" AS foo') == {
        Table("tbname", "schemaname")
    }


def test_extract_tables_union() -> None:
    """
    Test that `UNION` queries work as expected.
    """
    assert extract_tables_from_sql("SELECT * FROM t1 UNION SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql("SELECT * FROM t1 UNION ALL SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql(
        "SELECT * FROM t1 INTERSECT ALL SELECT * FROM t2"
    ) == {
        Table("t1"),
        Table("t2"),
    }


def test_extract_tables_select_from_values() -> None:
    """
    Test that selecting from values returns no tables.
    """
    assert extract_tables_from_sql("SELECT * FROM VALUES (13, 42)") == set()


def test_extract_tables_select_array() -> None:
    """
    Test that queries selecting arrays work as expected.
    """
    assert extract_tables_from_sql(
        """
SELECT ARRAY[1, 2, 3] AS my_array
FROM t1 LIMIT 10
"""
    ) == {Table("t1")}


def test_extract_tables_select_if() -> None:
    """
    Test that queries with an `IF` work as expected.
    """
    assert extract_tables_from_sql(
        """
SELECT IF(CARDINALITY(my_array) >= 3, my_array[3], NULL)
FROM t1 LIMIT 10
"""
    ) == {Table("t1")}


def test_extract_tables_with_catalog() -> None:
    """
    Test that catalogs are parsed correctly.
    """
    assert extract_tables_from_sql("SELECT * FROM catalogname.schemaname.tbname") == {
        Table("tbname", "schemaname", "catalogname")
    }


def test_extract_tables_illdefined() -> None:
    """
    Test that ill-defined tables return an empty set.
    """
    with pytest.raises(SupersetParseError) as excinfo:
        extract_tables_from_sql("SELECT * FROM schemaname.")
    assert str(excinfo.value) == "Error parsing near '.' at line 1:25"

    with pytest.raises(SupersetParseError) as excinfo:
        extract_tables_from_sql("SELECT * FROM catalogname.schemaname.")
    assert str(excinfo.value) == "Error parsing near '.' at line 1:37"

    with pytest.raises(SupersetParseError) as excinfo:
        extract_tables_from_sql("SELECT * FROM catalogname..")
    assert str(excinfo.value) == "Error parsing near '.' at line 1:27"

    with pytest.raises(SupersetParseError) as excinfo:
        extract_tables_from_sql('SELECT * FROM "tbname')
    assert str(excinfo.value) == "Unable to parse script"

    # odd edge case that works
    assert extract_tables_from_sql("SELECT * FROM catalogname..tbname") == {
        Table(table="tbname", schema=None, catalog="catalogname")
    }


def test_extract_tables_show_tables_from() -> None:
    """
    Test `SHOW TABLES FROM`.

    No individual table target is extractable, so the statement must be
    flagged as unparseable for authorization purposes instead of passing
    strict scoping with an empty table set.
    """
    assert (
        extract_tables_from_sql("SHOW TABLES FROM s1 like '%order%'", "mysql") == set()
    )
    assert SQLScript(
        "SHOW TABLES FROM s1 like '%order%'", "mysql"
    ).has_unparseable_statement


def test_extract_tables_show_tables_starrocks_catalog_schema() -> None:
    """
    Regression guard for the StarRocks catalog-qualified schema override.

    Unlike MySQL, `db` there can itself be an ``exp.Table`` (built via
    ``_parse_table_parts(is_db_reference=True)`` so a dotted
    ``catalog.schema`` parses), which ``find_all(exp.Table)`` would
    otherwise also pick up as a phantom, empty-name table reference --
    breaking the invariant that a schema-only `SHOW TABLES` target extracts
    no tables and is flagged unparseable for authorization purposes.
    """
    assert (
        extract_tables_from_sql("SHOW TABLES IN catalog_1.schema_a", "starrocks")
        == set()
    )
    assert extract_tables_from_sql("SHOW TABLES FROM schema_a", "starrocks") == set()
    assert SQLScript(
        "SHOW TABLES IN catalog_1.schema_a", "starrocks"
    ).has_unparseable_statement

    # A target-bearing SHOW must still resolve the real table, threading the
    # catalog.schema `db` scope through correctly rather than dropping it
    # (`exp.Table.name` is empty for a schema-only reference; the schema and
    # catalog live in `.db`/`.catalog` instead).
    assert extract_tables_from_sql(
        "SHOW COLUMNS FROM tbl FROM catalog_1.schema_a", "starrocks"
    ) == {Table("tbl", "schema_a", "catalog_1")}


def test_extract_tables_show_create_table() -> None:
    """
    Test `SHOW CREATE TABLE`.

    The target table must enter table-level authorization.
    """
    assert extract_tables_from_sql("SHOW CREATE TABLE s1.t1", "mysql") == {
        Table("t1", "s1")
    }
    assert not SQLScript("SHOW CREATE TABLE s1.t1", "mysql").has_unparseable_statement


def test_format_show_tables() -> None:
    """
    Test format when `ast.sql()` raises an exception.
    """
    assert (
        SQLScript("SHOW TABLES FROM s1 like '%order%'", "mysql").format()
        == "SHOW TABLES FROM s1 LIKE '%order%'"
    )


def test_format_no_dialect() -> None:
    """
    Test format with an engine that has no corresponding dialect.
    """
    assert (
        SQLScript("SELECT col FROM t WHERE col NOT IN (1, 2)", "dremio").format()
        == """
SELECT
  col
FROM t
WHERE
  NOT col IN (1, 2)
        """.strip()
    )


def test_format_oracle_group_by_keeps_explicit_expressions() -> None:
    """
    Test that formatting Oracle SQL doesn't rewrite ``GROUP BY`` to ordinals.

    Oracle doesn't support positional grouping (``GROUP BY 1, 2``) and fails
    with ``ORA-00979: not a GROUP BY expression``. sqlglot < 27.21.0 rewrote
    ``GROUP BY`` expressions that matched aliased projections into ordinals
    when generating Oracle SQL, breaking chart queries.

    Regression test for https://github.com/apache/superset/issues/35414,
    fixed by upgrading sqlglot.
    """
    sql = (
        "SELECT TRUNC(CAST(order_date AS DATE), 'MONTH') AS __timestamp, "
        'region AS region, SUM(sales) AS "SUM(sales)" '
        "FROM orders "
        "GROUP BY TRUNC(CAST(order_date AS DATE), 'MONTH'), region "
        'ORDER BY "SUM(sales)" DESC'
    )
    formatted = SQLStatement(sql, engine="oracle").format()

    # pretty-formatting puts each `GROUP BY` item on its own line
    group_by_clause = formatted.split("GROUP BY")[1].split("ORDER BY")[0]
    group_by_items = [
        line.strip().rstrip(",") for line in group_by_clause.strip().splitlines()
    ]
    assert group_by_items == [
        "TRUNC(CAST(order_date AS DATE), 'MONTH')",
        "region",
    ]
    # no item should have been replaced by a positional reference
    assert not any(item.isdigit() for item in group_by_items)


def test_format_oracle_group_by_keeps_explicit_expressions_subquery() -> None:
    """
    Test that formatting an Oracle chart query doesn't rewrite ``GROUP BY``
    to ordinals when the aggregated column comes from a virtual dataset
    subquery.

    This mirrors the query shape SQLAlchemy generates for a bar chart with a
    dimension and a ``COUNT(*)`` metric on a virtual dataset, which is the
    reproduction reported in
    https://github.com/apache/superset/issues/28327 (``ORA-00979: not a
    GROUP BY expression``). Fixed by the same sqlglot upgrade that resolved
    https://github.com/apache/superset/issues/35414.
    """
    sql = (
        "SELECT bar AS bar, COUNT(*) AS count "
        "FROM (SELECT 'foo' AS bar FROM dual) AS virtual_table "
        "GROUP BY bar"
    )
    formatted = SQLStatement(sql, engine="oracle").format()

    group_by_clause = formatted.split("GROUP BY")[1]
    group_by_items = [
        line.strip().rstrip(",") for line in group_by_clause.strip().splitlines()
    ]
    assert group_by_items == ["bar"]
    # no item should have been replaced by a positional reference
    assert not any(item.isdigit() for item in group_by_items)


def test_format_hana_preserves_quoted_identifier_casing() -> None:
    """
    Regression test for https://github.com/apache/superset/issues/39328.

    HANA is mapped to the Postgres sqlglot dialect (there's no dedicated HANA
    dialect upstream). HANA calculation-view invocations address the view as
    a quoted, case-sensitive identifier followed by a PLACEHOLDER parameter
    list, e.g. ``"zbw.10_001/INVENTORY"('PLACEHOLDER' = (...))`` -- sqlglot's
    parser treats that shape as a function call, so Postgres's inherited
    function-name normalization (``NORMALIZE_FUNCTIONS = "upper"``) re-cased
    the quoted identifier to ``"ZBW.10_001/INVENTORY"``. HANA resolves
    calculation-view names case-sensitively, so the re-cased identifier no
    longer exists and SQL Lab fails with ``invalid table name`` even though
    the user's original query was valid.
    """
    sql = (
        'SELECT * FROM _sys_bic."zbw.10_001/INVENTORY"\n'
        "(\n"
        "  'PLACEHOLDER' = ('$$IP_DATE_TO$$', ''),\n"
        "  'PLACEHOLDER' = ('$$IP_DATE_FROM$$', '')\n"
        ")"
    )
    formatted = SQLStatement(sql, engine="hana").format()

    assert '"zbw.10_001/INVENTORY"' in formatted
    assert "$$IP_DATE_TO$$" in formatted
    assert "$$IP_DATE_FROM$$" in formatted


def test_format_hana_custom_function_call_untouched() -> None:
    """
    The HANA dialect disables function-name normalization entirely (see
    ``test_format_hana_preserves_quoted_identifier_casing``), which only
    affects functions sqlglot doesn't recognize (parsed as
    ``exp.Anonymous`` -- built-ins like ``COUNT`` have their own dedicated
    AST node and always generate with a fixed canonical casing regardless).
    An unrecognized, mixed-case function call must round-trip with its
    original casing intact rather than being forced to uppercase.
    """
    formatted = SQLStatement("SELECT MyCustomFunc(col) FROM t", engine="hana").format()

    assert "MyCustomFunc(col)" in formatted


def test_split_no_dialect() -> None:
    """
    Test the statement split when the engine has no corresponding dialect.
    """
    sql = "SELECT col FROM t WHERE col NOT IN (1, 2); SELECT * FROM t; SELECT foo"
    statements = SQLScript(sql, "dremio").statements
    assert len(statements) == 3
    assert statements[0].format() == "SELECT\n  col\nFROM t\nWHERE\n  NOT col IN (1, 2)"
    assert statements[1].format() == "SELECT\n  *\nFROM t"
    assert statements[2].format() == "SELECT\n  foo"


def test_extract_tables_show_columns_from() -> None:
    """
    Test `SHOW COLUMNS FROM`.
    """
    assert extract_tables_from_sql("SHOW COLUMNS FROM t1") == {Table("t1")}


def test_extract_tables_where_subquery() -> None:
    """
    Test that tables in a `WHERE` subquery are parsed correctly.
    """
    assert extract_tables_from_sql(
        """
SELECT name
FROM t1
WHERE regionkey = (SELECT max(regionkey) FROM t2)
"""
    ) == {Table("t1"), Table("t2")}

    assert extract_tables_from_sql(
        """
SELECT name
FROM t1
WHERE regionkey IN (SELECT regionkey FROM t2)
"""
    ) == {Table("t1"), Table("t2")}

    assert extract_tables_from_sql(
        """
SELECT name
FROM t1
WHERE EXISTS (SELECT 1 FROM t2 WHERE t1.regionkey = t2.regionkey);
"""
    ) == {Table("t1"), Table("t2")}


def test_extract_tables_describe() -> None:
    """
    Test `DESCRIBE`.
    """
    assert extract_tables_from_sql("DESCRIBE t1") == {Table("t1")}


def test_extract_tables_show_partitions() -> None:
    """
    Test `SHOW PARTITIONS`.
    """
    assert extract_tables_from_sql(
        """
SHOW PARTITIONS FROM orders
WHERE ds >= '2013-01-01' ORDER BY ds DESC
"""
    ) == {Table("orders")}


def test_extract_tables_join() -> None:
    """
    Test joins.
    """
    assert extract_tables_from_sql(
        "SELECT t1.*, t2.* FROM t1 JOIN t2 ON t1.a = t2.a;"
    ) == {
        Table("t1"),
        Table("t2"),
    }

    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
    FROM right_table
) b
ON a.date = b.date
"""
    ) == {Table("left_table"), Table("right_table")}

    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
LEFT INNER JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
    FROM right_table
) b
ON a.date = b.date
"""
    ) == {Table("left_table"), Table("right_table")}

    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
RIGHT OUTER JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
    FROM right_table
) b
ON a.date = b.date
"""
    ) == {Table("left_table"), Table("right_table")}

    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
FULL OUTER JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
        FROM right_table
) b
ON a.date = b.date
"""
    ) == {Table("left_table"), Table("right_table")}


def test_extract_tables_semi_join() -> None:
    """
    Test `LEFT SEMI JOIN`.
    """
    assert extract_tables_from_sql(
        """
SELECT a.date, b.name
FROM left_table a
LEFT SEMI JOIN (
    SELECT
        CAST((b.year) as VARCHAR) date,
        name
    FROM right_table
) b
ON a.data = b.date
"""
    ) == {Table("left_table"), Table("right_table")}


def test_extract_tables_combinations() -> None:
    """
    Test a complex case with nested queries.
    """
    assert extract_tables_from_sql(
        """
SELECT * FROM t1
WHERE s11 > ANY (
    SELECT * FROM t1 UNION ALL SELECT * FROM (
        SELECT t6.*, t3.* FROM t6 JOIN t3 ON t6.a = t3.a
    ) tmp_join
    WHERE NOT EXISTS (
        SELECT * FROM t3
        WHERE ROW(5*t3.s1,77)=(
            SELECT 50,11*s1 FROM t4
        )
    )
)
"""
    ) == {Table("t1"), Table("t3"), Table("t4"), Table("t6")}

    assert extract_tables_from_sql(
        """
SELECT * FROM (
    SELECT * FROM (
        SELECT * FROM (
            SELECT * FROM EmployeeS
        ) AS S1
    ) AS S2
) AS S3
"""
    ) == {Table("EmployeeS")}


def test_extract_tables_with() -> None:
    """
    Test `WITH`.
    """
    assert extract_tables_from_sql(
        """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM t2),
    z AS (SELECT b AS c FROM t3)
SELECT c FROM z
"""
    ) == {Table("t1"), Table("t2"), Table("t3")}

    assert extract_tables_from_sql(
        """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM x),
    z AS (SELECT b AS c FROM y)
SELECT c FROM z
"""
    ) == {Table("t1")}


def test_extract_tables_reusing_aliases() -> None:
    """Test that the parser follows aliases.

    A non-recursive ``WITH`` item sees only items declared before it, so a forward
    reference resolves to the table of that name -- a real read that must be extracted.
    """
    # `q1` first: the `q2` in its body, and `q2`'s `src`, are both tables.
    assert extract_tables_from_sql(
        """
with q1 as ( select key from q2 where key = '5'),
q2 as ( select key from src where key = '5')
select * from (select key from q1) a
"""
    ) == {Table("q2"), Table("src")}

    # `src` first: its `q2` is a table; `q2`'s `src` and the outer `src` are the CTE.
    assert extract_tables_from_sql(
        """
with src as ( select key from q2 where key = '5'),
q2 as ( select key from src where key = '5')
select * from (select key from src) a
"""
    ) == {Table("q2")}


def test_extract_tables_cte_name_shared_with_table() -> None:
    """Test that a CTE's name does not hide reads of the table it is named after.

    Only a reference resolving to the CTE may be excluded; dropping any other costs it
    both its row filter and its access check.
    """
    # A qualified reference -- in the CTE body or elsewhere -- is the table.
    assert extract_tables_from_sql(
        "WITH orders AS (SELECT * FROM public.orders) SELECT * FROM orders"
    ) == {Table("orders", "public")}
    assert extract_tables_from_sql(
        "WITH orders AS (SELECT 1 AS d) "
        "SELECT * FROM (SELECT * FROM public.orders) AS z"
    ) == {Table("orders", "public")}

    # A non-recursive CTE cannot see itself, so its own name in its body is the table.
    assert extract_tables_from_sql(
        "WITH orders AS (SELECT * FROM orders) SELECT * FROM orders"
    ) == {Table("orders")}

    # A catalog disqualifies like a schema; `cat..orders` is checked only when pivoted.
    assert extract_tables_from_sql(
        "WITH orders AS (SELECT 1 AS amt, 'a' AS mth) "
        "SELECT * FROM cat..orders PIVOT(SUM(amt) FOR mth IN ('a'))",
        engine="snowflake",
    ) == {Table("orders", None, "cat")}


def test_extract_tables_cte_reference_not_table() -> None:
    """Test the counterpart: a reference that resolves to a CTE is not a table.

    A recursive item's reference to itself is the shape a bare-name compare gets wrong.
    """
    assert (
        extract_tables_from_sql(
            "WITH RECURSIVE t AS ("
            "SELECT 1 AS n UNION ALL SELECT n + 1 FROM t WHERE n < 5"
            ") SELECT * FROM t"
        )
        == set()
    )


def test_extract_tables_pivoted_cte_reference_is_not_a_table() -> None:
    """Test that pivoting a CTE reference does not make it a table read.

    Pivoting yields a new relation, so sqlglot keeps the reference as an ``exp.Table``
    -- the one shape where a CTE reference reaches ``is_cte()`` unqualified.
    """
    assert extract_tables_from_sql(
        "WITH c AS (SELECT a, b FROM other_table) "
        "SELECT * FROM c PIVOT(SUM(b) FOR a IN ('p'))",
        engine="snowflake",
    ) == {Table("other_table")}
    # Also when the pivot sits inside a derived table.
    assert extract_tables_from_sql(
        "WITH c AS (SELECT a, b FROM other_table) "
        "SELECT * FROM (SELECT * FROM c PIVOT(SUM(b) FOR a IN ('p'))) AS z",
        engine="snowflake",
    ) == {Table("other_table")}


def test_extract_tables_aliased_cte_does_not_hide_table() -> None:
    """Test that aliasing a CTE reference does not erase a table of the same name.

    ``Scope.sources`` is keyed by ``alias_or_name`` and would file the table under the
    CTE's alias; ``cte_sources`` is keyed by CTE name only.
    """
    assert extract_tables_from_sql(
        "WITH c AS (SELECT 1 AS n) SELECT s2.* FROM c AS other_table, other_table AS s2"
    ) == {Table("other_table")}
    assert extract_tables_from_sql(
        "WITH c AS (SELECT 1 AS n) "
        "SELECT s2.* FROM c AS other_table LEFT JOIN other_table AS s2 ON TRUE"
    ) == {Table("other_table")}


def test_extract_tables_cte_reference_over_reported() -> None:
    """Test the two shapes that over-report a CTE reference as a table.

    A spurious access check, not a missing one. Pinned so a change either way is meant.
    """
    # PostgreSQL resolves `foo` to the CTE; this reports the table.
    assert extract_tables_from_sql("WITH Foo AS (SELECT 1 AS d) SELECT * FROM foo") == {
        Table("foo")
    }
    # Legal under RECURSIVE: `q2` is the CTE declared below, not a table.
    assert extract_tables_from_sql(
        "WITH RECURSIVE q1 AS (SELECT key FROM q2), q2 AS (SELECT 1 AS key) "
        "SELECT * FROM q1"
    ) == {Table("q2")}


def test_extract_tables_multistatement() -> None:
    """
    Test that the parser works with multiple statements.
    """
    assert extract_tables_from_sql("SELECT * FROM t1; SELECT * FROM t2") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql("SELECT * FROM t1; SELECT * FROM t2;") == {
        Table("t1"),
        Table("t2"),
    }
    assert extract_tables_from_sql(
        "ADD JAR file:///hive.jar; SELECT * FROM t1;",
        engine="hive",
    ) == {Table("t1")}


def test_extract_tables_complex() -> None:
    """
    Test a few complex queries.
    """
    assert extract_tables_from_sql(
        """
SELECT sum(m_examples) AS "sum__m_example"
FROM (
    SELECT
        COUNT(DISTINCT id_userid) AS m_examples,
        some_more_info
    FROM my_b_table b
    JOIN my_t_table t ON b.ds=t.ds
    JOIN my_l_table l ON b.uid=l.uid
    WHERE
        b.rid IN (
            SELECT other_col
            FROM inner_table
        )
        AND l.bla IN ('x', 'y')
    GROUP BY 2
    ORDER BY 2 ASC
) AS "meh"
ORDER BY "sum__m_example" DESC
LIMIT 10;
"""
    ) == {
        Table("my_l_table"),
        Table("my_b_table"),
        Table("my_t_table"),
        Table("inner_table"),
    }

    assert extract_tables_from_sql(
        """
SELECT *
FROM table_a AS a, table_b AS b, table_c as c
WHERE a.id = b.id and b.id = c.id
"""
    ) == {Table("table_a"), Table("table_b"), Table("table_c")}

    assert extract_tables_from_sql(
        """
SELECT somecol AS somecol
FROM (
    WITH bla AS (
        SELECT col_a
        FROM a
        WHERE
            1=1
            AND column_of_choice NOT IN (
                SELECT interesting_col
                FROM b
            )
    ),
    rb AS (
        SELECT yet_another_column
        FROM (
            SELECT a
            FROM c
            GROUP BY the_other_col
        ) not_table
        LEFT JOIN bla foo
        ON foo.prop = not_table.bad_col0
        WHERE 1=1
        GROUP BY
            not_table.bad_col1 ,
            not_table.bad_col2 ,
        ORDER BY not_table.bad_col_3 DESC ,
            not_table.bad_col4 ,
            not_table.bad_col5
    )
    SELECT random_col
    FROM d
    WHERE 1=1
    UNION ALL SELECT even_more_cols
    FROM e
    WHERE 1=1
    UNION ALL SELECT lets_go_deeper
    FROM f
    WHERE 1=1
    GROUP BY last_col
    LIMIT 50000
)
"""
    ) == {Table("a"), Table("b"), Table("c"), Table("d"), Table("e"), Table("f")}


def test_extract_tables_mixed_from_clause() -> None:
    """
    Test that the parser handles a `FROM` clause with table and subselect.
    """
    assert extract_tables_from_sql(
        """
SELECT *
FROM table_a AS a, (select * from table_b) AS b, table_c as c
WHERE a.id = b.id and b.id = c.id
"""
    ) == {Table("table_a"), Table("table_b"), Table("table_c")}


def test_extract_tables_nested_select() -> None:
    """
    Test that the parser handles selects inside functions.
    """
    assert extract_tables_from_sql(
        """
select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(TABLE_NAME)
from INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA like "%bi%"),0x7e)));
""",
        "mysql",
    ) == {Table("COLUMNS", "INFORMATION_SCHEMA")}

    assert extract_tables_from_sql(
        """
select (extractvalue(1,concat(0x7e,(select GROUP_CONCAT(COLUMN_NAME)
from INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME="bi_achievement_daily"),0x7e)));
""",
        "mysql",
    ) == {Table("COLUMNS", "INFORMATION_SCHEMA")}


def test_extract_tables_complex_cte_with_prefix() -> None:
    """
    Test that the parser handles CTEs with prefixes.
    """
    assert extract_tables_from_sql(
        """
WITH CTE__test (SalesPersonID, SalesOrderID, SalesYear)
AS (
    SELECT SalesPersonID, SalesOrderID, YEAR(OrderDate) AS SalesYear
    FROM SalesOrderHeader
    WHERE SalesPersonID IS NOT NULL
)
SELECT SalesPersonID, COUNT(SalesOrderID) AS TotalSales, SalesYear
FROM CTE__test
GROUP BY SalesYear, SalesPersonID
ORDER BY SalesPersonID, SalesYear;
"""
    ) == {Table("SalesOrderHeader")}


def test_extract_tables_qualified_reference_matching_cte_name() -> None:
    """
    Test that a schema/catalog-qualified reference is resolved as a physical
    table even when its final name component matches a CTE defined in scope.

    A CTE name is always a bare identifier, so ``public.orders`` cannot be the
    CTE ``orders`` and must be reported as the physical table it names.
    """
    # schema-qualified reference shadowed by a same-named bare CTE
    assert extract_tables_from_sql(
        "WITH orders AS (SELECT 1) SELECT * FROM public.orders"
    ) == {Table("orders", "public")}

    # the CTE itself still references its own physical source
    assert extract_tables_from_sql(
        "WITH orders AS (SELECT * FROM staging.orders) SELECT * FROM public.orders"
    ) == {Table("orders", "staging"), Table("orders", "public")}

    # catalog-qualified reference shadowed by a same-named bare CTE
    assert extract_tables_from_sql(
        "WITH orders AS (SELECT 1) SELECT * FROM cat.public.orders"
    ) == {Table("orders", "public", "cat")}


def test_extract_tables_bare_cte_still_excluded() -> None:
    """
    Test that a genuine bare CTE reference is still not reported as a table.
    """
    assert extract_tables_from_sql(
        "WITH foo AS (SELECT * FROM target_table) SELECT * FROM foo"
    ) == {Table("target_table")}


def test_extract_tables_unreferenced_cte_does_not_shadow_table() -> None:
    """
    Test that a CTE that is defined but not used by the outer query does not
    change extraction of a physical table sharing its name.
    """
    assert extract_tables_from_sql(
        "WITH orders AS (SELECT 1) SELECT * FROM orders_summary"
    ) == {Table("orders_summary")}


def test_extract_tables_identifier_list_with_keyword_as_alias() -> None:
    """
    Test that aliases that are keywords are parsed correctly.
    """
    assert extract_tables_from_sql(
        """
WITH
    f AS (SELECT * FROM foo),
    match AS (SELECT * FROM f)
SELECT * FROM match
"""
    ) == {Table("foo")}


def test_sqlscript() -> None:
    """
    Test the `SQLScript` class.
    """
    script = SQLScript("SELECT 1; SELECT 2;", "sqlite")

    assert len(script.statements) == 2
    assert script.format() == "SELECT\n  1;\nSELECT\n  2"
    assert script.statements[0].format() == "SELECT\n  1"

    script = SQLScript("SET a=1; SET a=2; SELECT 3;", "sqlite")
    assert script.get_settings() == {"a": "2"}

    query = SQLScript(
        """set querytrace;
Events | take 100""",
        "kustokql",
    )
    assert query.get_settings() == {"querytrace": True}


def test_sqlscript_format_preserves_optimizer_hint_block() -> None:
    """
    Regression for #38189: an inline `--` comment trailing a query with a
    `/*+ SET_VAR(...) */` optimizer hint must not get repositioned inside
    the hint block during `format()` -- that would corrupt the hint syntax
    (StarRocks and other engines using the `/*+ ... */` convention reject
    a nested `/* */` inside it). `format()` is what Superset's execution
    path actually sends to the engine (see `executor.py`/`celery_task.py`).
    """
    sql = """SELECT /*+ SET_VAR(query_timeout = 3000) */ col1, col2
FROM my_table
LIMIT 100

-- increase timeout for large scans"""
    statement = SQLScript(sql, "starrocks").statements[0]
    formatted = statement.format()

    hint = "/*+ SET_VAR(query_timeout = 3000) */"
    assert hint in formatted
    assert "SET_VAR(query_timeout /*" not in formatted
    # the trailing comment must survive, and land outside (after) the hint
    # block rather than being dropped or relocated into it
    hint_end = formatted.index(hint) + len(hint)
    assert "increase timeout for large scans" in formatted[hint_end:]


@pytest.mark.xfail(
    reason=(
        "#38189 is not fully fixed: a `;`-terminated statement still hits "
        "the comment-relocation branch and corrupts the hint block. Only "
        "the no-semicolon form from the original repro was fixed."
    ),
    strict=True,
)
def test_sqlscript_format_preserves_optimizer_hint_block_with_semicolon() -> None:
    """
    Same as `test_sqlscript_format_preserves_optimizer_hint_block`, but with
    a terminating `;` on the statement -- this still reproduces #38189: the
    trailing `--` comment gets injected inside the `/*+ SET_VAR(...) */`
    hint block, corrupting it for StarRocks/MySQL-style engines.
    """
    sql = """SELECT /*+ SET_VAR(query_timeout = 3000) */ col1, col2
FROM my_table
LIMIT 100;

-- increase timeout for large scans"""
    statement = SQLScript(sql, "starrocks").statements[0]
    formatted = statement.format()

    hint = "/*+ SET_VAR(query_timeout = 3000) */"
    assert hint in formatted
    assert "SET_VAR(query_timeout /*" not in formatted
    hint_end = formatted.index(hint) + len(hint)
    assert "increase timeout for large scans" in formatted[hint_end:]


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        (
            " SELECT foo FROM tbl ; ",
            "postgresql",
            ["SELECT\n  foo\nFROM tbl"],
        ),
        (
            "SELECT foo FROM tbl1; SELECT bar FROM tbl2;",
            "postgresql",
            ["SELECT\n  foo\nFROM tbl1", "SELECT\n  bar\nFROM tbl2"],
        ),
        (
            "let foo = 1; tbl | where bar == foo",
            "kustokql",
            ["let foo = 1", "tbl | where bar == foo"],
        ),
        (
            "SELECT 1; -- extraneous comment",
            "postgresql",
            ["SELECT\n  1 /* extraneous comment */"],
        ),
        (
            "SHOW TABLES FROM s1 like '%order%';",
            "mysql",
            ["SHOW TABLES FROM s1 LIKE '%order%'"],
        ),
        (
            "SELECT 1; SELECT 2; SELECT 3;",
            "unknown-engine",
            [
                "SELECT\n  1",
                "SELECT\n  2",
                "SELECT\n  3",
            ],
        ),
    ],
)
def test_sqlscript_split(sql: str, engine: str, expected: list[str]) -> None:
    """
    Test the `SQLScript` class with a script that has a single statement.
    """
    script = SQLScript(sql, engine)
    assert [statement.format() for statement in script.statements] == expected


def test_sqlstatement() -> None:
    """
    Test the `SQLStatement` class.
    """
    statement = SQLStatement(
        "SELECT * FROM table1 UNION ALL SELECT * FROM table2",
        "sqlite",
    )

    assert (
        statement.format()
        == "SELECT\n  *\nFROM table1\nUNION ALL\nSELECT\n  *\nFROM table2"
    )
    assert str(statement) == statement.format()

    assert statement.tables == {
        Table(table="table1", schema=None, catalog=None),
        Table(table="table2", schema=None, catalog=None),
    }

    assert statement.parse_predicate("a > 1") == exp.GT(
        this=exp.Column(this=exp.Identifier(this="a", quoted=False)),
        expression=exp.Literal(this="1", is_string=False),
    )

    statement = SQLStatement("SET a=1", "sqlite")
    assert statement.get_settings() == {"a": "1"}

    with pytest.raises(
        ValueError,
        match="Either statement or ast must be provided",
    ):
        SQLStatement()


def test_kustokqlstatement() -> None:
    """
    Test the `KustoKQLStatement` class.
    """
    statement = KustoKQLStatement("foo | take 100", "kustokql")

    assert statement.format() == "foo | take 100"
    assert str(statement) == statement.format()

    # doesn't support table extraction
    assert statement.tables == set()

    # optimize is a no-op
    assert statement.optimize().format() == "foo | take 100"

    # predicate parsing is also no-op
    assert statement.parse_predicate("a > 1") == "a > 1"

    with pytest.raises(SupersetParseError, match="Invalid engine: invalid-engine"):
        KustoKQLStatement("foo | take 100", "invalid-engine")

    with pytest.raises(
        SupersetParseError,
        match="KustoKQLStatement should have exactly one statement",
    ):
        KustoKQLStatement("foo | take 1; bar | take 2", "kustokql")


def test_kustokqlstatement_split_script() -> None:
    """
    Test the `KustoKQLStatement` split method.
    """
    statements = KustoKQLStatement.split_script(
        """
let totalPagesPerDay = PageViews
| summarize by Page, Day = startofday(Timestamp)
| summarize count() by Day;
let materializedScope = PageViews
| summarize by Page, Day = startofday(Timestamp);
let cachedResult = materialize(materializedScope);
cachedResult
| project Page, Day1 = Day
| join kind = inner
(
    cachedResult
    | project Page, Day2 = Day
)
on Page
| where Day2 > Day1
| summarize count() by Day1, Day2
| join kind = inner
    totalPagesPerDay
on $left.Day1 == $right.Day
| project Day1, Day2, Percentage = count_*100.0/count_1
        """,
        "kustokql",
    )
    assert len(statements) == 4


def test_kustokqlstatement_with_program() -> None:
    """
    Test the `KustoKQLStatement` split method when the KQL has a program.
    """
    statements = KustoKQLStatement.split_script(
        """
print program = ```
  public class Program {
    public static void Main() {
      System.Console.WriteLine("Hello!");
    }
  }```
        """,
        "kustokql",
    )
    assert len(statements) == 1


def test_kustokqlstatement_with_set() -> None:
    """
    Test the `KustoKQLStatement` split method when the KQL has a set command.
    """
    statements = KustoKQLStatement.split_script(
        """
set querytrace;
Events | take 100
        """,
        "kustokql",
    )
    assert len(statements) == 2
    assert statements[0].format() == "set querytrace"
    assert statements[1].format() == "Events | take 100"


@pytest.mark.parametrize(
    "kql,statements",
    [
        ('print banner=strcat("Hello", ", ", "World!")', 1),
        (r"print 'O\'Malley\'s'", 1),
        (r"print 'O\'Mal;ley\'s'", 1),
        ("print ```foo;\nbar;\nbaz;```\n", 1),
    ],
)
def test_kustokql_statement_split_special(kql: str, statements: int) -> None:
    assert len(KustoKQLStatement.split_script(kql, "kustokql")) == statements


@pytest.mark.parametrize(
    "kql, expected",
    [
        (";Table | take 5", ["Table | take 5"]),
        (";Table | take 5;", ["Table | take 5"]),
        (
            """
let totalPagesPerDay = PageViews
| summarize by Page, Day = startofday(Timestamp)
| summarize count() by Day;
let materializedScope = PageViews
| summarize by Page, Day = startofday(Timestamp);
let cachedResult = materialize(materializedScope);
cachedResult
| project Page, Day1 = Day
| join kind = inner
(
    cachedResult
    | project Page, Day2 = Day
)
on Page
| where Day2 > Day1
| summarize count() by Day1, Day2
| join kind = inner
    totalPagesPerDay
on $left.Day1 == $right.Day
| project Day1, Day2, Percentage = count_*100.0/count_1
            """,
            [
                """
let totalPagesPerDay = PageViews
| summarize by Page, Day = startofday(Timestamp)
| summarize count() by Day""",
                """
let materializedScope = PageViews
| summarize by Page, Day = startofday(Timestamp)""",
                """
let cachedResult = materialize(materializedScope)""",
                """
cachedResult
| project Page, Day1 = Day
| join kind = inner
(
    cachedResult
    | project Page, Day2 = Day
)
on Page
| where Day2 > Day1
| summarize count() by Day1, Day2
| join kind = inner
    totalPagesPerDay
on $left.Day1 == $right.Day
| project Day1, Day2, Percentage = count_*100.0/count_1
            """,
            ],
        ),
    ],
)
def test_split_kql(kql: str, expected: list[str]) -> None:
    """
    Test the `split_kql` function.
    """
    assert split_kql(kql) == expected


@pytest.mark.parametrize(
    ("engine", "sql", "expected"),
    [
        ("sqlite", "SELECT 1", False),
        ("sqlite", "INSERT INTO foo VALUES (1)", True),
        ("sqlite", "UPDATE foo SET bar = 2 WHERE id = 1", True),
        ("sqlite", "DELETE FROM foo WHERE id = 1", True),
        ("sqlite", "CREATE TABLE foo (id INT, bar TEXT)", True),
        ("sqlite", "DROP TABLE foo", True),
        ("sqlite", "EXPLAIN SELECT * FROM foo", False),
        ("sqlite", "PRAGMA table_info(foo)", False),
        ("postgresql", "SELECT 1", False),
        ("postgresql", "INSERT INTO foo (id, bar) VALUES (1, 'test')", True),
        ("postgresql", "UPDATE foo SET bar = 'new' WHERE id = 1", True),
        ("postgresql", "DELETE FROM foo WHERE id = 1", True),
        ("postgresql", "CREATE TABLE foo (id SERIAL PRIMARY KEY, bar TEXT)", True),
        ("postgresql", "DROP TABLE foo", True),
        ("postgresql", "EXPLAIN ANALYZE SELECT * FROM foo", False),
        ("postgresql", "EXPLAIN ANALYZE DELETE FROM foo", True),
        # SHOW reads server configuration; it mutates nothing, so it is NOT
        # classified as mutating (that would be wrong for the commit/limit/
        # "only SELECT" consumers of has_mutation()). Gating disclosure reads
        # belongs in DISALLOWED_SQL_FUNCTIONS, not the mutation check.
        ("postgresql", "SHOW search_path", False),
        # SET search_path parses as exp.Set (a structured node), not
        # exp.Command, so the SET-in-mutating-commands rule does NOT
        # catch it. Pure GUC reads/writes stay non-mutating.
        ("postgresql", "SET search_path TO public", False),
        (
            "postgres",
            """
            with source as (
                select 1 as one
            )
            select * from source
            """,
            False,
        ),
        ("trino", "SELECT 1", False),
        ("trino", "INSERT INTO foo VALUES (1, 'bar')", True),
        ("trino", "UPDATE foo SET bar = 'baz' WHERE id = 1", True),
        ("trino", "DELETE FROM foo WHERE id = 1", True),
        ("trino", "CREATE TABLE foo (id INT, bar VARCHAR)", True),
        ("trino", "DROP TABLE foo", True),
        ("trino", "EXPLAIN SELECT * FROM foo", False),
        ("trino", "SHOW SCHEMAS", False),
        ("trino", "SET SESSION optimization_level = '3'", False),
        ("kustokql", "tbl | limit 100", False),
        ("kustokql", "let foo = 1; tbl | where bar == foo", False),
        ("kustokql", ".show tables", False),
        ("kustokql", "print 1", False),
        ("kustokql", "set querytrace; Events | take 100", False),
        ("kustokql", ".drop table foo", True),
        ("kustokql", ".set-or-append table foo <| bar", True),
        ("base", "SHOW LOCKS test EXTENDED", False),
        ("base", "SET hivevar:desc='Legislators'", False),
        ("base", "UPDATE t1 SET col1 = NULL", True),
        ("base", "EXPLAIN SELECT 1", False),
        ("base", "SELECT 1", False),
        ("base", "WITH bla AS (SELECT 1) SELECT * FROM bla", False),
        ("base", "SHOW CATALOGS", False),
        ("base", "SHOW TABLES", False),
        ("hive", "UPDATE t1 SET col1 = NULL", True),
        ("hive", "INSERT OVERWRITE TABLE tabB SELECT a.Age FROM TableA", True),
        ("hive", "SHOW LOCKS test EXTENDED", False),
        ("hive", "SET hivevar:desc='Legislators'", False),
        ("hive", "EXPLAIN SELECT 1", False),
        ("hive", "SELECT 1", False),
        ("hive", "WITH bla AS (SELECT 1) SELECT * FROM bla", False),
        ("presto", "SET hivevar:desc='Legislators'", False),
        ("presto", "UPDATE t1 SET col1 = NULL", True),
        ("presto", "INSERT OVERWRITE TABLE tabB SELECT a.Age FROM TableA", True),
        ("presto", "SHOW LOCKS test EXTENDED", False),
        ("presto", "EXPLAIN SELECT 1", False),
        ("presto", "SELECT 1", False),
        ("presto", "WITH bla AS (SELECT 1) SELECT * FROM bla", False),
    ],
)
def test_has_mutation(engine: str, sql: str, expected: bool) -> None:
    """
    Test the `has_mutation` method.
    """
    assert SQLScript(sql, engine).has_mutation() == expected


@pytest.mark.parametrize(
    "engine, sql, expected",
    [
        # Plain SELECT parses to a proper AST node.
        ("postgresql", "SELECT * FROM foo", False),
        # CALL parses to ``exp.Command`` on Postgres.
        ("postgresql", "CALL my_proc(1);", True),
        # A script that mixes a parseable statement with an unparseable one
        # is still flagged so strict scoping can refuse the whole script.
        ("postgresql", "SELECT 1; CALL my_proc();", True),
        # Non-sqlglot engines (e.g. Kusto KQL) do not produce a parseable
        # AST and cannot have their tables enumerated, so they must be
        # flagged as unparseable to fail closed under strict scoping.
        ("kustokql", "print 1", True),
    ],
)
def test_has_unparseable_statement(engine: str, sql: str, expected: bool) -> None:
    """
    Test the `has_unparseable_statement` property used by strict scoping to
    refuse statements that sqlglot couldn't fully model.
    """
    assert SQLScript(sql, engine).has_unparseable_statement is expected


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT last(my_value_column, my_time_column) FROM my_table",
        "SELECT first(my_value_column, my_time_column) FROM my_table",
        "SELECT time_bucket('1 hour', my_time_column) AS bucket FROM my_table",
    ],
)
def test_postgres_parses_timescaledb_hyperfunctions(sql: str) -> None:
    """
    Regression for #32028: TimescaleDB extends Postgres with hyperfunctions
    (``last``, ``first``, ``time_bucket``, etc.) that take more arguments
    than vanilla Postgres equivalents. SQL Lab tolerates them (it routes
    raw SQL straight to the engine), but the dashboard chart path runs the
    SQL through ``SQLScript`` for inspection. A strict per-function arity
    check in sqlglot was rejecting these queries with ``The number of
    provided arguments (2) is greater than the maximum number of supported
    arguments (1)``, which broke dashboards built on TimescaleDB datasets.

    These tests pin that the parse path tolerates Postgres-dialect SQL
    using TimescaleDB hyperfunction signatures. If a future sqlglot
    upgrade reintroduces the strict arity check, this fails immediately.
    """
    SQLScript(sql, "postgresql")  # Must not raise.


@pytest.mark.parametrize(
    "engine",
    ["oracle", "postgresql", "trino", "presto", "hive", "base"],
)
def test_with_clause_containing_union_is_not_mutating(engine: str) -> None:
    """
    Regression for #25659: a SELECT with a WITH clause whose CTEs contain
    UNION (or UNION ALL) must not be classified as mutating, on any dialect.

    The original bug surfaced on Oracle, where saving a virtual dataset built
    from such a query failed with "Only `SELECT` statements are allowed". The
    parser was misclassifying the WITH+UNION construct as DML.

    Multiple dialects are exercised because the bug arose from sqlglot's
    per-dialect AST shape — Oracle's representation of the same query may
    differ from Postgres/Trino, and a fix that only touches one dialect
    leaves the others exposed to the same regression.
    """
    sql = """
    WITH set1 AS (SELECT 1 AS n UNION SELECT 2),
         set2 AS (SELECT * FROM set1)
    SELECT * FROM set2
    """
    assert not SQLScript(sql, engine).has_mutation(), (
        f"WITH+UNION misclassified as mutating on {engine!r}; "
        "this would block the query from being saved as a virtual dataset."
    )


def test_with_clause_containing_union_all_is_not_mutating_oracle() -> None:
    """
    Companion to test_with_clause_containing_union_is_not_mutating: the
    original bug report (#25659) used the exact Oracle-flavored shape below
    (``SYSDATE FROM DUAL`` is the Oracle no-op for "now"). Pinning the
    verbatim repro guards against a future dialect-specific regression that
    a generic ``SELECT 1`` test might miss.
    """
    sql = """
    WITH SET1 AS (SELECT SYSDATE FROM DUAL UNION ALL SELECT SYSDATE FROM DUAL),
         SET2 AS (SELECT * FROM SET1)
    SELECT * FROM SET2
    """
    assert not SQLScript(sql, "oracle").has_mutation()


@pytest.mark.parametrize("engine", ["clickhouse", "clickhousedb"])
def test_clickhouse_parametric_aggregate_parses_and_is_read_only(engine: str) -> None:
    """
    Regression for #37285: ClickHouse parametric aggregate functions use a
    double pair of parentheses — ``groupConcat(', ')(part_name)`` — where the
    first list holds the aggregate's parameters and the second its arguments.

    Older sqlglot versions choked on the second parenthesized list, so SQL
    Lab either mangled the query sent to the database or, with DDL/DML
    disallowed, refused to run it because it "could not be parsed to confirm
    it is a read-only query". The sqlglot bump to >=30 fixed the parsing;
    pinning the reporter's verbatim query guards against a future
    dialect-specific regression. Both ClickHouse engine specs are exercised
    since each resolves the sqlglot dialect independently.
    """
    sql = """
    select
      groupConcat(', ')(part_name) as concatenated
    from system.parts
    """
    script = SQLScript(sql, engine)  # Must not raise.
    assert not script.has_mutation(), (
        f"Parametric aggregate misclassified as mutating on {engine!r}; "
        "this would block the query on connections without DDL/DML allowed."
    )


def test_get_settings() -> None:
    """
    Test `get_settings` in some edge cases.
    """
    sql = """
set
-- this is a tricky comment
search_path -- another one
= bar;
SELECT * FROM some_table;
    """
    assert SQLScript(sql, "postgresql").get_settings() == {"search_path": "bar"}


@pytest.mark.parametrize(
    "app",
    [{"SQLGLOT_DIALECTS_EXTENSIONS": {"custom": Dialects.MYSQL}}],
    indirect=True,
)
def test_custom_dialect(app: None) -> None:
    """
    Test that custom dialects are loaded correctly.
    """
    assert SQLGLOT_DIALECTS.get("custom") == Dialects.MYSQL


@pytest.mark.parametrize(
    "engine",
    [
        "ascend",
        "awsathena",
        "base",
        "bigquery",
        "clickhouse",
        "clickhousedb",
        "cockroachdb",
        "couchbase",
        "crate",
        "databend",
        "databricks",
        "db2",
        "denodo",
        "dremio",
        "drill",
        "druid",
        "duckdb",
        "dynamodb",
        "elasticsearch",
        "exa",
        "firebird",
        "firebolt",
        "gsheets",
        "hana",
        "hive",
        "ibmi",
        "impala",
        "kustokql",
        "kustosql",
        "kylin",
        "mariadb",
        "motherduck",
        "mssql",
        "mysql",
        "netezza",
        "oceanbase",
        "ocient",
        "odelasticsearch",
        "oracle",
        "pinot",
        "postgresql",
        "presto",
        "pydoris",
        "redshift",
        "risingwave",
        "shillelagh",
        "snowflake",
        "solr",
        "sqlite",
        "starrocks",
        "superset",
        "teradatasql",
        "trino",
        "vertica",
    ],
)
@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT 1", False),
        ("with source as ( select 1 as one ) select * from source", False),
        ("ALTER TABLE foo ADD COLUMN bar INT", True),
        # COMMENT ON parses as a typed exp.Comment node across dialects; it
        # writes to the catalog (pg_description on Postgres) so it is gated.
        ("COMMENT ON TABLE t IS 'note'", True),
    ],
)
def test_is_mutating(sql: str, engine: str, expected: bool) -> None:
    """
    Global tests for `is_mutating`, covering all supported engines.
    """
    assert SQLStatement(sql, engine).is_mutating() == expected


@pytest.mark.parametrize(
    "sql, engine",
    [
        # Opaque `exp.Command` fallbacks must fail closed on every dialect,
        # not only PostgreSQL.
        ("CALL evil_proc()", "mysql"),
        ("LOAD '/tmp/x.so'", "postgres"),
        ("EXEC dbo.evil_proc", "mssql"),
        # The EXPLAIN ANALYZE unwrap must handle the parenthesized
        # option-list, whitespace, alternate-spelling, and leading-comment
        # forms: PostgreSQL executes the inner DML for all of them.
        ("EXPLAIN (ANALYZE) UPDATE t SET x = 1", "postgresql"),
        ("EXPLAIN (ANALYZE, BUFFERS) DELETE FROM t", "postgresql"),
        ("EXPLAIN ANALYZE\nUPDATE t SET x = 1", "postgresql"),
        ("EXPLAIN ANALYSE UPDATE t SET x = 1", "postgresql"),
        ("EXPLAIN /* c */ (ANALYZE) UPDATE t SET x = 1", "postgresql"),
        # A bare COMMIT persists every prior write on the connection even
        # when the execution layer skips its own commit call.
        ("COMMIT", "postgresql"),
        ("COMMIT", "mysql"),
        # Further EXPLAIN ANALYZE edge forms: a leading line comment before
        # the option, a VERBOSE qualifier, an empty option list, and an
        # inner statement that cannot be parsed all fail closed as mutating.
        ("EXPLAIN --c\nANALYZE UPDATE t SET x = 1", "postgresql"),
        ("EXPLAIN ANALYZE VERBOSE UPDATE t SET x = 1", "postgresql"),
        ("EXPLAIN (ANALYZE)", "postgresql"),
        ("EXPLAIN ANALYZE )))", "postgresql"),
    ],
)
def test_is_mutating_fails_closed_on_gate_blind_spots(sql: str, engine: str) -> None:
    """
    `is_mutating` must fail closed on statements that slip past node-type
    matching: non-PostgreSQL command fallbacks, normalized `EXPLAIN ANALYZE`
    variants, and structured `COMMIT`.
    """
    assert SQLStatement(sql, engine).is_mutating()


@pytest.mark.parametrize(
    "sql, expected",
    [
        (
            """
DO $$
BEGIN
  INSERT INTO public.users (name, real_name)
    VALUES ('SQLLab bypass DML', 'SQLLab bypass DML');
END;
$$;
            """,
            True,
        ),
        (
            """
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM orders WHERE status = 'pending') > 100 THEN
        RAISE NOTICE 'High pending order volume detected';
    END IF;
END;
$$;
            """,
            True,
        ),
    ],
)
def test_is_mutating_anonymous_block(sql: str, expected: bool) -> None:
    """
    Test for `is_mutating` with a Postgres anonymous block.

    Since we can't parse the PL/pgSQL inside the block we always assume it is mutating.
    """
    assert SQLStatement(sql, "postgresql").is_mutating() == expected


@pytest.mark.parametrize(
    "sql, expected",
    [
        # PostgreSQL large-object writers: each mutates server state. The bare
        # SELECT wrapper is irrelevant because the function call itself is the
        # side effect.
        ("SELECT lo_from_bytea(0, decode('deadbeef', 'hex'))", True),
        ("SELECT lo_export(12345, '/tmp/payload.bin')", True),
        ("SELECT lo_import('/etc/passwd')", True),
        ("SELECT lo_put(12345, 0, decode('00', 'hex'))", True),
        ("SELECT lo_create(0)", True),
        # lo_creat is the legacy large-object creator (distinct from lo_create).
        ("SELECT lo_creat(-1)", True),
        ("SELECT lowrite(12345, decode('00', 'hex'))", True),
        # lo_truncate/lo_truncate64 shrink an existing large object: a write.
        ("SELECT lo_truncate(12345, 0)", True),
        ("SELECT lo_truncate64(12345, 0)", True),
        # lo_unlink deletes a large object outright.
        ("SELECT lo_unlink(12345)", True),
        # PostgreSQL sequence mutators. setval()/nextval() look like reads but
        # advance sequence state for every subsequent caller.
        ("SELECT setval('public.my_seq', 1000)", True),
        ("SELECT SETVAL('public.my_seq', 1)", True),
        ("SELECT nextval('public.my_seq')", True),
        # currval() only reads the session's last value, so it is not mutating.
        ("SELECT currval('public.my_seq')", False),
        # Read-side large-object functions are intentionally NOT classified
        # as mutating here. They are still blocked via the function denylist
        # (see DISALLOWED_SQL_FUNCTIONS) but they do not write state.
        ("SELECT lo_get(12345)", False),
        ("SELECT loread(12345, 1024)", False),
        # Case-insensitive matching: the AST stores the raw casing for
        # anonymous functions, the check uppercases both sides.
        ("SELECT LO_EXPORT(12345, '/tmp/x')", True),
        # `SELECT INTO new_table FROM existing` creates a new relation; treat
        # as mutating even though sqlglot parses it as exp.Select.
        ("SELECT * INTO new_table FROM existing_table", True),
        ("SELECT col INTO TEMP new_table FROM existing_table", True),
        # A built-in function whose first string argument happens to match a
        # mutating name must NOT be flagged. sqlglot parses these into dedicated
        # nodes (e.g. exp.Upper) whose `.name` is the argument text, not the
        # function name, so the walk is restricted to exp.Anonymous to avoid a
        # false positive on this read-only query.
        ("SELECT upper('lo_export')", False),
        ("SELECT length('setval')", False),
        # Plain SELECT must remain non-mutating.
        ("SELECT 1", False),
        ("SELECT * FROM users WHERE id = 1", False),
    ],
)
def test_is_mutating_postgres_function_and_select_into(
    sql: str, expected: bool
) -> None:
    """
    `is_mutating` must catch mutating function calls (PostgreSQL large-object
    writers) and `SELECT ... INTO new_table` even though the wrapping AST
    node is a plain `exp.Select`.
    """
    assert SQLStatement(sql, "postgresql").is_mutating() == expected


@pytest.mark.parametrize(
    "engine, sql",
    [
        # `SELECT ... INTO new_table` is CTAS only in Postgres/Redshift/T-SQL.
        # In Oracle PL/SQL and MySQL the same syntax assigns into a variable
        # and is a read, so it must NOT be classified as mutating.
        ("oracle", "SELECT col INTO v FROM existing_table"),
        ("mysql", "SELECT col INTO @v FROM existing_table"),
    ],
)
def test_is_mutating_select_into_variable_is_read(engine: str, sql: str) -> None:
    """
    `SELECT ... INTO target` is only CTAS (mutating) for dialects where the
    syntax creates a table. On Oracle/MySQL it assigns into a variable and is
    a read, so `is_mutating` must return False there.
    """
    assert SQLStatement(sql, engine).is_mutating() is False


@pytest.mark.parametrize(
    "engine, sql",
    [
        # `SELECT ... INTO new_table` is CTAS on Redshift and T-SQL just as it
        # is on Postgres, so each dialect in _SELECT_INTO_CTAS_DIALECTS must
        # classify the statement as mutating.
        ("redshift", "SELECT * INTO new_table FROM existing_table"),
        ("redshift", "SELECT col INTO new_table FROM existing_table"),
        ("mssql", "SELECT * INTO new_table FROM existing_table"),
        ("mssql", "SELECT col INTO new_table FROM existing_table"),
    ],
)
def test_is_mutating_select_into_ctas_dialects(engine: str, sql: str) -> None:
    """
    `SELECT ... INTO new_table` creates a table on the CTAS dialects beyond
    Postgres (Redshift, T-SQL), so `is_mutating` must return True there.
    """
    assert SQLStatement(sql, engine).is_mutating() is True


@pytest.mark.parametrize(
    "engine, sql",
    [
        # The mutating-function names are PostgreSQL built-ins. On other engines
        # a same-named read-only function or UDF must NOT be flagged as
        # mutating, otherwise read-only queries get wrongly blocked.
        ("mysql", "SELECT setval(my_col)"),
        ("mysql", "SELECT lo_export(id, path) FROM t"),
        ("base", "SELECT setval(my_col)"),
        ("trino", "SELECT lowrite(x)"),
    ],
)
def test_is_mutating_function_names_scoped_to_postgres(engine: str, sql: str) -> None:
    """
    `_MUTATING_FUNCTION_NAMES` is PostgreSQL-specific, so the function-name walk
    only runs for the Postgres dialect; same-named functions on other engines
    must stay non-mutating.
    """
    assert SQLStatement(sql, engine).is_mutating() is False


@pytest.mark.parametrize(
    "sql, expected",
    [
        # PostgreSQL constructs that sqlglot parses as opaque exp.Command.
        # Each can wrap a DML body or change effective server state.
        ("PREPARE u AS UPDATE t SET x = 1", True),
        ("PREPARE i AS INSERT INTO t VALUES (1)", True),
        ("EXECUTE my_plan", True),
        ("CALL my_writing_procedure()", True),
        ("COPY t FROM '/tmp/data.csv'", True),
        ("GRANT SELECT ON t TO public", True),
        ("REVOKE SELECT ON t FROM public", True),
        ("SET ROLE other_role", True),
        ("REFRESH MATERIALIZED VIEW mv", True),
        ("REINDEX TABLE t", True),
        ("VACUUM t", True),
        # SHOW commands are reads (they mutate nothing), so they are NOT
        # classified as mutating. Gating information-disclosure reads such as
        # SHOW server_version belongs in DISALLOWED_SQL_FUNCTIONS (which already
        # blocks pg_read_file, version(), etc.), not in the mutation check.
        ("SHOW search_path", False),
        ("SHOW all", False),
        ("SHOW server_version", False),
        # RESET reverts a prior SET (e.g. RESET ROLE backs out SET ROLE).
        ("RESET ROLE", True),
        # DDL head-tokens that sqlglot falls back to exp.Command for when the
        # body uses syntax it does not model. One representative per
        # head-token branch (CREATE/ALTER/DROP); they all hit the same
        # set-lookup so additional CREATE PUBLICATION/SUBSCRIPTION/etc.
        # cases would not add coverage.
        (
            "CREATE FUNCTION x() RETURNS int AS '/tmp/x.so', 'i' LANGUAGE C",
            True,
        ),
        ("CREATE EXTENSION pg_trgm", True),  # non-FUNCTION DDL via Command
        ("ALTER SYSTEM SET wal_level = 'logical'", True),
        ("DROP EXTENSION pg_trgm", True),
        # LOAD dlopens a shared library on the PG host. Same RCE primitive
        # as `CREATE FUNCTION ... LANGUAGE C` if the library path is
        # attacker-controlled (e.g. via a prior COPY-to-program foothold).
        ("LOAD '/tmp/x.so'", True),
        # Case-insensitive: sqlglot preserves source case on Command.name,
        # so the set lookup must normalise. Regression for the original
        # bug where a lowercase head-token bypassed the gate.
        ("create extension pg_trgm", True),
        ("load '/tmp/x.so'", True),
        # Pre-existing positive controls
        ("DO $$ BEGIN UPDATE t SET x = 1; END $$", True),
        ("EXPLAIN ANALYZE UPDATE t SET x = 1", True),
    ],
)
def test_is_mutating_postgres_command_constructs(sql: str, expected: bool) -> None:
    """
    Several PostgreSQL constructs are represented by sqlglot as opaque
    `exp.Command` nodes (no structured AST). `is_mutating` recognises them
    by command name so they cannot slip past the read-only gate.
    """
    assert SQLStatement(sql, "postgresql").is_mutating() == expected


@pytest.mark.parametrize(
    "sql, engine, functions, expected",
    [
        # MySQL `@@<name>` syntax parses as exp.SessionParameter, which is
        # not a subclass of exp.Func. The walker must include it so the
        # denylist entry for `version` still catches `SELECT @@version`.
        ("SELECT @@version", "mysql", {"version"}, True),
        ("SELECT @@global.version", "mysql", {"version"}, True),
        ("SELECT @@hostname", "mysql", {"hostname"}, True),
        ("SELECT @@datadir", "mysql", {"datadir"}, True),
        # Negative control: a session parameter not in the denylist must
        # not match.
        ("SELECT @@autocommit", "mysql", {"version", "hostname"}, False),
        # A plain SELECT does not introduce session-parameter names.
        ("SELECT 1", "mysql", {"version"}, False),
        # The pre-existing exp.Func walk still works for normal calls.
        ("SELECT version()", "mysql", {"version"}, True),
        # PostgreSQL large-object functions are exp.Anonymous calls. The
        # walk includes them; the denylist entry catches them.
        ("SELECT lo_export(12345, '/tmp/x')", "postgresql", {"lo_export"}, True),
        (
            "SELECT lo_from_bytea(0, decode('00','hex'))",
            "postgresql",
            {"lo_from_bytea"},
            True,
        ),
        ("SELECT loread(12345, 1024)", "postgresql", {"loread"}, True),
    ],
)
def test_check_functions_present_session_parameter(
    sql: str, engine: str, functions: set[str], expected: bool
) -> None:
    """
    `check_functions_present` must visit `exp.SessionParameter` so that
    denylist entries for names like `version` or `hostname` also match
    `SELECT @@version` / `SELECT @@hostname` in MySQL.
    """
    assert SQLScript(sql, engine).check_functions_present(functions) == expected


@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT 1", False),
        ("INSERT INTO t VALUES (1)", False),
        ("UPDATE t SET x = 1", False),
        ("DELETE FROM t", False),
        ("MERGE INTO t USING s ON t.id = s.id WHEN MATCHED THEN DELETE", False),
        ("CREATE TABLE t (id INT)", False),
        ("DROP TABLE t", True),
        ("DROP TABLE IF EXISTS t", True),
        ("DROP VIEW v", True),
        ("TRUNCATE TABLE t", True),
        ("ALTER TABLE t ADD COLUMN x INT", True),
        ("ALTER TABLE t DROP COLUMN x", True),
    ],
)
def test_is_destructive(sql: str, expected: bool) -> None:
    """
    Test that ``is_destructive`` detects DROP, TRUNCATE, and ALTER
    but not SELECT, INSERT, UPDATE, DELETE, MERGE, or CREATE.
    """
    assert SQLStatement(sql, "postgresql").is_destructive() == expected


@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT 1; INSERT INTO t VALUES (1)", False),
        ("SELECT 1; DROP TABLE t", True),
        ("SELECT 1; TRUNCATE TABLE t", True),
        ("CREATE TABLE t (id INT); ALTER TABLE t ADD COLUMN x INT", True),
    ],
)
def test_has_destructive(sql: str, expected: bool) -> None:
    """
    Test that ``has_destructive`` on SQLScript detects destructive DDL
    across multiple statements.
    """
    assert SQLScript(sql, "postgresql").has_destructive() == expected


@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT 1 UNION SELECT 2", True),
        ("SELECT 1 UNION ALL SELECT 2", True),
        ("SELECT 1 INTERSECT SELECT 2", True),
        ("SELECT 1 EXCEPT SELECT 2", True),
        ("SELECT 1", False),
        ("WITH cte AS (SELECT 1) SELECT * FROM cte", False),
        ("SELECT * FROM (SELECT 1 UNION SELECT 2) AS sub", False),
    ],
)
def test_is_set_operation(sql: str, expected: bool) -> None:
    """
    Test that ``is_set_operation`` detects top-level UNION/INTERSECT/EXCEPT
    but not nested set operations inside a sub-query.
    """
    assert SQLStatement(sql, "postgresql").is_set_operation() == expected


@pytest.mark.parametrize(
    "kql, expected",
    [
        (".drop table T", True),
        (".alter table T (col:string)", True),
        (".show tables", False),
        ("T | count", False),
    ],
)
def test_kusto_is_destructive(kql: str, expected: bool) -> None:
    """
    Test ``is_destructive`` on KustoKQLStatement.
    """
    from superset.sql.parse import KustoKQLStatement

    assert KustoKQLStatement(kql, "kustokql").is_destructive() == expected


def test_optimize() -> None:
    """
    Test that the `optimize` method works as expected.

    The SQL optimization only works with engines that have a corresponding dialect.
    """
    sql = """
SELECT anon_1.a, anon_1.b
FROM (SELECT some_table.a AS a, some_table.b AS b, some_table.c AS c
FROM some_table) AS anon_1
WHERE anon_1.a > 1 AND anon_1.b = 2
    """

    optimized = """
SELECT
  anon_1.a,
  anon_1.b
FROM (
  SELECT
    some_table.a AS a,
    some_table.b AS b,
    some_table.c AS c
  FROM some_table
  WHERE
    some_table.a > 1 AND some_table.b = 2
) AS anon_1
WHERE
  TRUE AND TRUE
    """.strip()

    not_optimized = """
SELECT
  anon_1.a,
  anon_1.b
FROM (
  SELECT
    some_table.a AS a,
    some_table.b AS b,
    some_table.c AS c
  FROM some_table
) AS anon_1
WHERE
  anon_1.a > 1 AND anon_1.b = 2
    """.strip()

    assert SQLStatement(sql, "sqlite").optimize().format() == optimized
    assert SQLStatement(sql, "crate").optimize().format() == not_optimized

    # also works for scripts
    assert SQLScript(sql, "sqlite").optimize().format() == optimized


def test_firebolt() -> None:
    """
    Test that Firebolt 3rd party dialect is registered correctly.

    We need a custom dialect for Firebolt because it parses `NOT col IN (1, 2)` as
    `(NOT col) IN (1, 2)` instead of `NOT (col IN (1, 2))`, which will fail when `col`
    is not a boolean.

    Note that `NOT col = 1` works as expected in Firebolt, parsing as `NOT (col = 1)`.
    """
    sql = "SELECT col NOT IN (1, 2) FROM tbl"
    assert (
        SQLStatement(sql, "firebolt").format()
        == """
SELECT
  NOT (
    col IN (1, 2)
  )
FROM tbl
    """.strip()
    )

    sql = "SELECT NOT col = 1 FROM tbl"
    assert (
        SQLStatement(sql, "firebolt").format()
        == """
SELECT
  NOT col = 1
FROM tbl
    """.strip()
    )


def test_firebolt_old() -> None:
    """
    Test the dialect for the old Firebolt syntax.
    """
    from superset.sql.dialects import FireboltOld
    from superset.sql.parse import SQLGLOT_DIALECTS

    SQLGLOT_DIALECTS["firebolt"] = FireboltOld

    sql = "SELECT * FROM t1 UNNEST(col1 AS foo)"
    assert (
        SQLStatement(sql, "firebolt").format()
        == """
SELECT
  *
FROM t1 UNNEST(col1 AS foo)
        """.strip()
    )


def test_firebolt_old_escape_string() -> None:
    """
    Test the dialect for the old Firebolt syntax.
    """
    from superset.sql.dialects import FireboltOld
    from superset.sql.parse import SQLGLOT_DIALECTS

    SQLGLOT_DIALECTS["firebolt"] = FireboltOld

    # both '' and \' are valid escape sequences
    sql = r"SELECT 'foo''bar', 'foo\'bar'"

    # but they normalize to ''
    assert (
        SQLStatement(sql, "firebolt").format()
        == """
SELECT
  'foo''bar',
  'foo''bar'
        """.strip()
    )


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM users LIMIT 10", "postgresql", 10),
        (
            """
WITH cte_example AS (
  SELECT * FROM my_table
  LIMIT 100
)
SELECT * FROM cte_example
LIMIT 10;
        """,
            "postgresql",
            10,
        ),
        ("SELECT * FROM users ORDER BY id DESC LIMIT 25", "postgresql", 25),
        ("SELECT * FROM users", "postgresql", None),
        ("SELECT TOP 5 name FROM employees", "teradatasql", 5),
        ("SELECT TOP (42) * FROM table_name", "teradatasql", 42),
        ("select * from table", "postgresql", None),
        ("select * from mytable limit 10", "postgresql", 10),
        (
            "select * from (select * from my_subquery limit 10) where col=1 limit 20",
            "postgresql",
            20,
        ),
        ("select * from (select * from my_subquery limit 10);", "postgresql", None),
        (
            "select * from (select * from my_subquery limit 10) where col=1 limit 20;",
            "postgresql",
            20,
        ),
        ("select * from mytable limit 20, 10", "postgresql", 10),
        ("select * from mytable limit 10 offset 20", "postgresql", 10),
        (
            """
SELECT id, value, i
FROM (SELECT * FROM my_table LIMIT 10),
LATERAL generate_series(1, value) AS i;
        """,
            "postgresql",
            None,
        ),
        # not really valid SQL, but let's roll with it
        ("SELECT * FROM my_table LIMIT invalid", "postgresql", None),
        # A ClickHouse `LIMIT ... BY` caps rows per group, not overall, so it is
        # not a row limit. sqlglot hangs the `BY` columns off the `Limit` node,
        # or off the `Offset` node for the `OFFSET` / `m, n` spellings.
        ("SELECT * FROM t ORDER BY id, val LIMIT 2 BY id", "clickhouse", None),
        ("SELECT * FROM t ORDER BY id, val LIMIT 2 BY id, val", "clickhouse", None),
        (
            "SELECT * FROM t ORDER BY id, val LIMIT 2 OFFSET 1 BY id",
            "clickhouse",
            None,
        ),
        ("SELECT * FROM t ORDER BY id, val LIMIT 1, 2 BY id", "clickhouse", None),
        # ... while a plain ClickHouse limit, with or without an offset, is.
        ("SELECT * FROM t ORDER BY c LIMIT 555", "clickhouse", 555),
        ("SELECT * FROM t LIMIT 5 OFFSET 3", "clickhouse", 5),
        ("SELECT * FROM t LIMIT 3, 5", "clickhouse", 5),
    ],
)
def test_get_limit_value(sql: str, engine: str, expected: str) -> None:
    assert SQLStatement(sql, engine).get_limit_value() == expected


@pytest.mark.parametrize(
    "kql, expected",
    [
        ("StormEvents | take 10", 10),
        ("StormEvents | limit 20", 20),
        ("StormEvents | where State == 'FL' | summarize count()", None),
        ("StormEvents | where name has 'limit 10'", None),
        ("AnotherTable | take 5", 5),
        ("datatable(x:int) [1, 2, 3] | take 100", 100),
        (
            """
    Table1 | where msg contains 'abc;xyz'
           | limit 5
    """,
            5,
        ),
        ("table | take five", None),
    ],
)
def test_get_kql_limit_value(kql: str, expected: str) -> None:
    assert KustoKQLStatement(kql, "kustokql").get_limit_value() == expected


@pytest.mark.parametrize(
    "sql, engine, limit, method, expected",
    [
        (
            "SELECT * FROM t",
            "postgresql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM t\nLIMIT 10",
        ),
        (
            "SELECT * FROM t LIMIT 1000",
            "postgresql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM t\nLIMIT 10",
        ),
        (
            "SELECT * FROM t",
            "mssql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10\n  *\nFROM t",
        ),
        (
            "SELECT * FROM t",
            "teradatasql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10\n  *\nFROM t",
        ),
        (
            "SELECT * FROM t",
            "oracle",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM t\nFETCH FIRST 10 ROWS ONLY",
        ),
        (
            "SELECT * FROM t",
            "db2",
            10,
            LimitMethod.WRAP_SQL,
            "SELECT\n  *\nFROM (\n  SELECT\n    *\n  FROM t\n)\nLIMIT 10",
        ),
        (
            "SEL TOP 1000 * FROM My_table",
            "teradatasql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SEL TOP 1000 * FROM My_table;",
            "teradatasql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SEL TOP 1000 * FROM My_table;",
            "teradatasql",
            1000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 1000\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "teradatasql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "teradatasql",
            10000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10000\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table",
            "mssql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "mssql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 100\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "mssql",
            10000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10000\n  *\nFROM My_table",
        ),
        (
            "SELECT TOP 1000 * FROM My_table;",
            "mssql",
            1000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 1000\n  *\nFROM My_table",
        ),
        (
            """
with abc as (select * from test union select * from test1)
select TOP 100 * from currency
            """,
            "mssql",
            1000,
            LimitMethod.FORCE_LIMIT,
            """
WITH abc AS (
  SELECT
    *
  FROM test
  UNION
  SELECT
    *
  FROM test1
)
SELECT
TOP 1000
  *
FROM currency
            """.strip(),
        ),
        (
            "SELECT DISTINCT x from tbl",
            "mssql",
            100,
            LimitMethod.FORCE_LIMIT,
            "SELECT DISTINCT\nTOP 100\n  x\nFROM tbl",
        ),
        (
            "SELECT 1 as cnt",
            "mssql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10\n  1 AS cnt",
        ),
        (
            "select TOP 1000 * from abc where id=1",
            "mssql",
            10,
            LimitMethod.FORCE_LIMIT,
            "SELECT\nTOP 10\n  *\nFROM abc\nWHERE\n  id = 1",
        ),
        (
            "SELECT * FROM birth_names -- SOME COMMENT",
            "postgresql",
            1000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM birth_names /* SOME COMMENT */\nLIMIT 1000",
        ),
        (
            "SELECT * FROM birth_names -- SOME COMMENT WITH LIMIT 555",
            "postgresql",
            1000,
            LimitMethod.FORCE_LIMIT,
            """
SELECT
  *
FROM birth_names /* SOME COMMENT WITH LIMIT 555 */
LIMIT 1000
            """.strip(),
        ),
        (
            "SELECT * FROM birth_names LIMIT 555",
            "postgresql",
            1000,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM birth_names\nLIMIT 1000",
        ),
        (
            "SELECT * FROM birth_names LIMIT 555",
            "postgresql",
            1000,
            LimitMethod.FETCH_MANY,
            "SELECT\n  *\nFROM birth_names\nLIMIT 555",
        ),
        # A ClickHouse `LIMIT ... BY` shares the `limit`/`offset` slot with the
        # row limit, so `FORCE_LIMIT` wraps instead of overwriting it.
        (
            "SELECT * FROM limit_by ORDER BY id, val LIMIT 2 BY id",
            "clickhouse",
            1001,
            LimitMethod.FORCE_LIMIT,
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM limit_by
  ORDER BY
    id,
    val
  LIMIT 2 BY id
)
LIMIT 1001
            """.strip(),
        ),
        (
            "SELECT * FROM limit_by ORDER BY id, val LIMIT 2 BY id, val",
            "clickhouse",
            1001,
            LimitMethod.FORCE_LIMIT,
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM limit_by
  ORDER BY
    id,
    val
  LIMIT 2 BY id, val
)
LIMIT 1001
            """.strip(),
        ),
        # For `LIMIT n OFFSET m BY x` sqlglot hangs the `BY` columns off the
        # `Offset` node instead, so the `limit` arg alone doesn't reveal them.
        (
            "SELECT * FROM limit_by ORDER BY id, val LIMIT 2 OFFSET 1 BY id",
            "clickhouse",
            1001,
            LimitMethod.FORCE_LIMIT,
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM limit_by
  ORDER BY
    id,
    val
  LIMIT 2
  OFFSET 1 BY id
)
LIMIT 1001
            """.strip(),
        ),
        (
            "SELECT * FROM limit_by ORDER BY id, val LIMIT 1, 2 BY id",
            "clickhouse",
            1001,
            LimitMethod.FORCE_LIMIT,
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM limit_by
  ORDER BY
    id,
    val
  LIMIT 2
  OFFSET 1 BY id
)
LIMIT 1001
            """.strip(),
        ),
        # `WITH TOTALS` rides into the subquery untouched: ClickHouse keeps
        # emitting the totals block for a wrapped query, so the cap really is
        # the only thing the rewrite adds.
        (
            "SELECT id, count() AS c FROM limit_by "
            "GROUP BY id WITH TOTALS ORDER BY id LIMIT 2 BY id",
            "clickhouse",
            1001,
            LimitMethod.FORCE_LIMIT,
            """
SELECT
  *
FROM (
  SELECT
    id,
    count() AS c
  FROM limit_by
  GROUP BY
    id
  WITH TOTALS
  ORDER BY
    id
  LIMIT 2 BY id
)
LIMIT 1001
            """.strip(),
        ),
        # `SETTINGS` and `FORMAT` do not survive a demotion into the subquery,
        # so they move up onto the wrapper instead.
        (
            "SELECT * FROM limit_by ORDER BY id LIMIT 2 BY id "
            "SETTINGS extremes = 1 FORMAT JSONCompact",
            "clickhouse",
            1001,
            LimitMethod.FORCE_LIMIT,
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM limit_by
  ORDER BY
    id
  LIMIT 2 BY id
)
LIMIT 1001
SETTINGS extremes = 1
FORMAT JSONCompact
            """.strip(),
        ),
        # A ClickHouse limit without a `BY` still takes the in-place path.
        (
            "SELECT * FROM t ORDER BY c LIMIT 555",
            "clickhouse",
            1001,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM t\nORDER BY\n  c\nLIMIT 1001",
        ),
        (
            "SELECT * FROM t LIMIT 5 OFFSET 3",
            "clickhouse",
            1001,
            LimitMethod.FORCE_LIMIT,
            "SELECT\n  *\nFROM t\nLIMIT 1001\nOFFSET 3",
        ),
    ],
)
def test_set_limit_value(
    sql: str,
    engine: str,
    limit: int,
    method: LimitMethod,
    expected: str,
) -> None:
    statement = SQLStatement(sql, engine)
    statement.set_limit_value(limit, method)
    assert statement.format() == expected


@pytest.mark.parametrize("engine", ["clickhouse", "clickhousedb"])
@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM limit_by ORDER BY id, val LIMIT 2 BY id",
        "SELECT * FROM limit_by ORDER BY id, val LIMIT 2 BY id, val",
        "SELECT * FROM limit_by ORDER BY id, val LIMIT 2 OFFSET 1 BY id",
        "SELECT * FROM limit_by ORDER BY id, val LIMIT 1, 2 BY id",
    ],
)
def test_set_limit_value_preserves_clickhouse_limit_by(sql: str, engine: str) -> None:
    """
    A row limit must not cannibalize a ClickHouse ``LIMIT ... BY``.

    ``LIMIT 2 BY id`` keeps 2 rows *per id*; ``FORCE_LIMIT`` used to build a
    fresh ``Limit`` node over ``args["limit"]``, dropping the ``BY`` columns and
    turning the query into a flat ``LIMIT 1001`` -- a different result set, with
    no error to hint at it. ``get_limit_value()`` reported the per-group 2 as a
    row cap on top of that, so ``_set_query_limit()`` clamped the query to 2 rows.

    The cap can't simply be appended next to the ``BY`` either: sqlglot cannot
    parse ClickHouse's own ``LIMIT n BY x LIMIT m`` ("Found multiple 'LIMIT'
    clauses"), so the result would not survive a reparse. Wrapping the query is
    what keeps both the grouping and the cap.
    """
    statement = SQLStatement(sql, engine)
    assert statement.get_limit_value() is None

    statement.set_limit_value(1001, LimitMethod.FORCE_LIMIT)
    limited = statement.format()

    assert "BY id" in limited
    assert limited.endswith("LIMIT 1001")
    # The rewrite has to be valid ClickHouse, not just valid-looking.
    assert SQLStatement(limited, engine).format() == limited


def test_set_limit_value_keeps_clickhouse_top_level_modifiers() -> None:
    """
    The wrap must not demote clauses that only work at the top level.

    ClickHouse rejects `FORMAT` inside a subquery outright, and a `SETTINGS`
    attached to a subquery binds to that subquery alone -- top-level-only
    settings such as ``extremes`` would silently stop applying. Both therefore
    move onto the wrapper, which is where the original query had them.

    The row-producing modifiers are left alone, because ClickHouse honors them
    inside a `FROM` subquery: a wrapped `WITH TOTALS` query still emits its
    totals block, and `WITH ROLLUP`/`WITH CUBE` still emit their extra rows.
    Hoisting those would change the result rather than preserve it.
    """
    statement = SQLStatement(
        "SELECT id, count() AS c FROM limit_by "
        "GROUP BY id WITH TOTALS ORDER BY id LIMIT 2 BY id "
        "SETTINGS extremes = 1 FORMAT JSONCompact",
        "clickhouse",
    )
    statement.set_limit_value(1001, LimitMethod.FORCE_LIMIT)
    limited = statement.format()

    assert limited.endswith("LIMIT 1001\nSETTINGS extremes = 1\nFORMAT JSONCompact")
    # `WITH TOTALS` stays with the aggregation it belongs to.
    assert "WITH TOTALS\n" in limited.split("LIMIT 2 BY id")[0]
    assert SQLStatement(limited, "clickhouse").format() == limited


@pytest.mark.parametrize(
    "engine", ["clickhouse", "clickhousedb", "postgresql", "mysql"]
)
def test_set_limit_value_without_limit_by_stays_in_place(engine: str) -> None:
    """
    Queries with no ``LIMIT ... BY`` keep the cheaper in-place rewrite.

    The wrap is reserved for the ``LIMIT ... BY`` case; everything else -- every
    non-ClickHouse dialect, and ClickHouse's own plain ``LIMIT`` -- must still
    have its limit replaced without gaining a subquery.
    """
    statement = SQLStatement("SELECT * FROM t ORDER BY c LIMIT 555", engine)
    statement.set_limit_value(1001, LimitMethod.FORCE_LIMIT)
    assert statement.format() == "SELECT\n  *\nFROM t\nORDER BY\n  c\nLIMIT 1001"


@pytest.mark.parametrize(
    "method",
    [LimitMethod.FORCE_LIMIT, LimitMethod.WRAP_SQL],
)
@pytest.mark.parametrize(
    "engine",
    [
        # Engines whose sqlglot dialect parses `SHOW` into a real `exp.Show`
        # node (as opposed to falling back to an opaque `exp.Command`, which
        # doesn't expose a `limit` arg and so was never affected by this bug).
        "starrocks",
        "mysql",
        "snowflake",
    ],
)
@pytest.mark.parametrize(
    "sql",
    [
        "SHOW TABLES",
        "SHOW DATABASES",
        "SHOW CREATE TABLE test.will_test1",
    ],
)
def test_set_limit_value_leaves_show_statements_unchanged(
    sql: str, engine: str, method: LimitMethod
) -> None:
    """
    Regression for #36939: no limit method may touch ``SHOW`` statements.

    ``SHOW`` statements have no `LIMIT` clause in sqlglot's expression tree,
    so forcing one via ``args["limit"]`` doesn't reject cleanly, it produces
    a malformed statement with two ``LIMIT`` keywords (one from a stray
    rendering of the bare ``Limit`` expression, one from the forced value).
    StarRocks (and presumably other engines) reject that outright: "Getting
    syntax error ... Unexpected input 'LIMIT'". The statement should be
    left untouched instead, matching how ``SELECT`` statements without a
    scannable row source aren't force-limited either.

    ``WRAP_SQL`` is wrong on a ``SHOW`` for the same reason but fails more
    quietly, rewriting it as ``SELECT * FROM (SHOW DATABASES)``, so both
    methods are covered here.

    Covers multiple engines, not just StarRocks: the fix guards on the AST
    node category (``exp.Query``), not the dialect, so any engine whose
    sqlglot dialect parses ``SHOW`` into a real ``Show`` node (e.g. MySQL,
    Snowflake) is equally exposed and must be equally protected.
    """
    statement = SQLStatement(sql, engine)
    original = statement.format()
    statement.set_limit_value(1000, method)
    assert statement.format() == original
    assert "LIMIT" not in statement.format()


@pytest.mark.parametrize(
    "sql, expected_catalog, expected_db",
    [
        ("SHOW TABLES IN catalog_1.schema_a", "catalog_1", "schema_a"),
        ("SHOW TABLES FROM catalog_1.schema_a", "catalog_1", "schema_a"),
        ("SHOW TABLES IN schema_a", None, "schema_a"),
        ("SHOW TABLES FROM schema_a", None, "schema_a"),
        ("SHOW DATABASES IN catalog_1", None, "catalog_1"),
    ],
)
def test_show_tables_in_catalog_qualified_schema(
    sql: str, expected_catalog: str | None, expected_db: str
) -> None:
    """
    StarRocks supports a catalog-qualified schema reference in
    ``SHOW TABLES/DATABASES FROM|IN <schema>``, e.g.
    ``SHOW TABLES IN catalog.schema``, which sqlglot's MySQL-derived parser
    doesn't support: the schema is parsed with ``_parse_id_var()``, which only
    ever consumes a single identifier, leaving the ``.schema`` part dangling
    and rejected as an unexpected token. The ``superset.sql.dialects.StarRocks``
    override reparses the schema with ``_parse_table_parts(is_db_reference=True)``
    so a dotted ``catalog.schema`` (or a plain schema) both parse correctly.
    """
    show = SQLStatement(sql, "starrocks")._parsed
    assert isinstance(show, exp.Show)

    db = show.args.get("db")
    assert isinstance(db, exp.Table)
    catalog = db.args.get("catalog")
    assert (catalog.name if catalog else None) == expected_catalog
    assert db.args.get("db").name == expected_db


def test_show_binlog_events_in_log_name_still_parses() -> None:
    """
    Regression guard: the override must not break the pre-existing meaning of
    ``IN`` for ``SHOW BINLOG/RELAYLOG EVENTS IN 'log_name'``, where ``IN``
    introduces a string log name rather than a schema reference.
    """
    show = SQLStatement(
        "SHOW BINLOG EVENTS IN 'log.000001' FROM 4", "starrocks"
    )._parsed
    assert isinstance(show, exp.Show)
    assert show.args.get("log").name == "log.000001"
    assert show.args.get("position").name == "4"


@pytest.mark.parametrize(
    "sql",
    [
        # Admin / cluster / job-control statements sqlglot's MySQL-derived
        # grammar has no dedicated handling for, so it used to try (and
        # fail) to read the head keyword as a generic expression.
        'ADMIN SET FRONTEND CONFIG ("disable_balance" = "true")',
        'ADMIN CHECK TABLET (10000, 10001) PROPERTIES("type" = "consistency")',
        "ADMIN REPAIR TABLE tbl1 PARTITION (p1, p2)",
        "BACKUP SNAPSHOT example_db.snapshot_label1 TO example_repo "
        'PROPERTIES ("type" = "full")',
        "RESTORE SNAPSHOT example_db.snapshot_label1 FROM example_repo "
        'ON (backup_tbl) PROPERTIES("backup_timestamp"="2018-05-04-16-45-08")',
        "RECOVER DATABASE example_db",
        "RECOVER TABLE example_db.example_tbl",
        "RECOVER PARTITION p1 FROM example_tbl",
        "CANCEL BACKUP FROM example_db",
        "CANCEL RESTORE FROM example_db",
        'CANCEL LOAD WHERE LABEL = "example_label"',
        'CANCEL EXPORT WHERE queryid = "921d8f80-7c9d-11eb-9342-acde48001121"',
        "CANCEL ALTER TABLE COLUMN FROM example_db.my_table",
        'EXPORT TABLE testTbl TO "hdfs://h:9000/a/b/c/testTbl_" WITH BROKER',
        "PAUSE ROUTINE LOAD FOR example_db.example_tbl1_ordertest1",
        "RESUME ROUTINE LOAD FOR example_db.example_tbl1_ordertest1",
        "STOP ROUTINE LOAD FOR example_db.example_tbl1_ordertest1",
        "SUBMIT TASK etl0 AS CREATE TABLE tbl1 AS SELECT * FROM src_tbl",
        "SUBMIT TASK AS INSERT OVERWRITE tbl2 SELECT * FROM src_tbl",
        "DEALLOCATE PREPARE select_by_id_stmt",
        # StarRocks blacklist management. ADD/DELETE already mean something
        # else in the grammar (ALTER TABLE ADD ..., the DML DELETE
        # statement), so these need the specific-phrase peek in
        # `_parse_statement`, not a blanket keyword remap.
        'ADD SQLBLACKLIST "select count(*) from .+"',
        "DELETE SQLBLACKLIST 3, 4",
        "ADD BACKEND BLACKLIST 10001",
        "DELETE BACKEND BLACKLIST 10001",
        "ADD COMPUTE NODE BLACKLIST 10005",
        # Ordinary ADD/DELETE must be unaffected by the blacklist peek.
        "ALTER TABLE t ADD COLUMN c INT",
        "DELETE FROM my_table WHERE k1 = 3",
        # TRANSLATE TRINO translates a Trino SELECT into StarRocks SQL. Like
        # ADD/DELETE, TRANSLATE can't be remapped to TokenType.COMMAND
        # outright -- it also names the ordinary TRANSLATE(string, from, to)
        # scalar function -- so this needs the same specific-phrase peek.
        "TRANSLATE TRINO SELECT 1",
        "TRANSLATE TRINO SELECT id, name FROM products WHERE category = 'Electronics'",
        # Ordinary use of the scalar function must be unaffected by the peek.
        "SELECT TRANSLATE(col, 'a', 'b') FROM t",
    ],
)
def test_starrocks_admin_and_job_control_statements_parse(sql: str) -> None:
    SQLStatement(sql, "starrocks")


@pytest.mark.parametrize(
    "sql",
    [
        "KILL ANALYZE 266030",
        "KILL QUERY 5",
        "KILL 20",
        "REFRESH DICTIONARY dict_obj",
        "REFRESH CONNECTIONS",
        "REFRESH MATERIALIZED VIEW lo_mv1",
        "REFRESH MATERIALIZED VIEW lo_mv1 FORCE",
        'REFRESH MATERIALIZED VIEW lo_mv1 PARTITION START ("2020-02-01") '
        'END ("2020-03-01") FORCE',
        "REFRESH MATERIALIZED VIEW lo_mv1 WITH SYNC MODE",
        "CANCEL REFRESH MATERIALIZED VIEW lo_mv1",
        "CANCEL REFRESH MATERIALIZED VIEW lo_mv1 FORCE",
        "CANCEL REFRESH DICTIONARY dict_obj",
        "SHOW CREATE FUNCTION default_db.python_add(BIGINT)",
        "SHOW CREATE FUNCTION default_db.python_add",
        "CREATE MATERIALIZED VIEW lo_mv3 DISTRIBUTED BY HASH(`lo_orderkey`) "
        "REFRESH SCHEDULE START ('2023-07-01 10:00:00') EVERY (INTERVAL 1 DAY) "
        "AS SELECT lo_orderkey FROM lineorder",
        "SHOW COLUMNS FROM t1",
        "REFRESH TABLE t1",
        "SHOW PROFILE",
        # No REFRESH kind keyword matches; falls back to an opaque Command
        # rather than raising.
        "REFRESH foo",
        # No START/EVERY schedule at all.
        "CREATE MATERIALIZED VIEW mv1 DISTRIBUTED BY HASH(x) REFRESH MANUAL "
        "AS SELECT x FROM t",
        # Existing forms these overrides must not regress.
        "REFRESH EXTERNAL TABLE t1",
        # REFRESH EXTERNAL TABLE / TABLE's own PARTITION(...) clause -- using
        # `_parse_table_parts` unconditionally for the target would raise
        # before this clause is ever reached.
        "REFRESH EXTERNAL TABLE hudi1 PARTITION('date=2022-12-20', 'date=2022-12-21')",
        "REFRESH TABLE t1 PARTITION('p1')",
        "CREATE MATERIALIZED VIEW lo_mv1 DISTRIBUTED BY HASH(`lo_orderkey`) "
        "REFRESH ASYNC START ('2023-07-01 10:00:00') EVERY (INTERVAL 1 DAY) "
        "AS SELECT lo_orderkey FROM lineorder",
    ],
)
def test_starrocks_kill_refresh_show_create_function_parse(sql: str) -> None:
    SQLStatement(sql, "starrocks")


@pytest.mark.parametrize(
    ("sql", "expected"),
    [
        # `this` is a placeholder Var required by the base Refresh expression,
        # not a real target name; the generic REFRESH {kind} {this} rendering
        # would otherwise duplicate the word.
        ("REFRESH CONNECTIONS", "REFRESH CONNECTIONS"),
        # A standalone ALTER TABLE ADD ROLLUP action's own "ADD ROLLUP"
        # keywords live on the RollupIndex node, not on the enclosing ALTER.
        (
            "ALTER TABLE db.tbl ADD ROLLUP r1(col1, col2) FROM r0",
            "ALTER TABLE db.tbl\nADD ROLLUP r1(col1, col2) FROM r0",
        ),
        # Dual-bound `VALUES [(...), (...))` range partition must round-trip
        # as the same half-open bound, not collapse into a single-bound
        # `VALUES LESS THAN (...)` partition with a different meaning.
        (
            "CREATE TABLE t(k1 INT) PARTITION BY RANGE (k1) "
            "(PARTITION p1 VALUES [('2021-01-01'), ('2021-01-31'))) "
            "DISTRIBUTED BY HASH(k1)",
            "CREATE TABLE t (\n  k1 INT\n)\n"
            "PARTITION BY RANGE (k1) (PARTITION p1 VALUES "
            "[('2021-01-01'), ('2021-01-31')))\n"
            "DISTRIBUTED BY HASH (\n  k1\n)",
        ),
        # StarRocks' single-argument INTERVAL form must round-trip with the
        # INTERVAL keyword, not the generic positional Func rendering.
        (
            "CREATE TABLE t(dt DATETIME) PARTITION BY time_slice(dt, INTERVAL 7 day) "
            "DISTRIBUTED BY HASH(dt)",
            "CREATE TABLE t (\n  dt DATETIME\n)\n"
            "PARTITION BY TIME_SLICE(dt, INTERVAL '7' DAY)\n"
            "DISTRIBUTED BY HASH (\n  dt\n)",
        ),
        # The 3-argument boundary form, and the non-CONNECTIONS/non-dual-bound/
        # non-ALTER-action fallback paths of each override above, must keep
        # deferring to the base StarRocks generator rather than always taking
        # the specialized branch.
        (
            "CREATE TABLE t(dt DATETIME) "
            "PARTITION BY TIME_SLICE(dt, INTERVAL 7 DAY, FLOOR) "
            "DISTRIBUTED BY HASH(dt)",
            "CREATE TABLE t (\n  dt DATETIME\n)\n"
            "PARTITION BY TIME_SLICE(dt, INTERVAL '7' DAY, FLOOR)\n"
            "DISTRIBUTED BY HASH (\n  dt\n)",
        ),
        ("REFRESH TABLE t1", "REFRESH TABLE t1"),
        ("REFRESH DICTIONARY dict_obj", "REFRESH DICTIONARY dict_obj"),
        (
            "CREATE TABLE t (k1 INT, k2 INT) DUPLICATE KEY (k1) "
            "DISTRIBUTED BY HASH (k1) ROLLUP (r1 (k1) FROM t)",
            "CREATE TABLE t (\n  k1 INT,\n  k2 INT\n)\n"
            "DUPLICATE KEY (k1)\n"
            "DISTRIBUTED BY HASH (\n  k1\n)\n"
            "ROLLUP (r1(k1) FROM t)",
        ),
        (
            "CREATE TABLE t(k1 INT) PARTITION BY RANGE (k1) "
            '(PARTITION p1 VALUES LESS THAN ("10")) DISTRIBUTED BY HASH(k1)',
            "CREATE TABLE t (\n  k1 INT\n)\n"
            "PARTITION BY RANGE (k1) (PARTITION p1 VALUES LESS THAN ('10'))\n"
            "DISTRIBUTED BY HASH (\n  k1\n)",
        ),
        # REFRESH MATERIALIZED VIEW's FORCE / PARTITION START(...) END(...) /
        # WITH {SYNC|ASYNC} MODE clauses must round-trip, not vanish --
        # `format()` is what SQL Lab actually sends to the database.
        (
            "REFRESH MATERIALIZED VIEW lo_mv1 FORCE",
            "REFRESH MATERIALIZED VIEW lo_mv1 FORCE",
        ),
        (
            "REFRESH MATERIALIZED VIEW lo_mv1 PARTITION START ('2020-02-01') "
            "END ('2020-03-01')",
            "REFRESH MATERIALIZED VIEW lo_mv1 PARTITION START ('2020-02-01') "
            "END ('2020-03-01')",
        ),
        # FORCE is accepted either right after the view name or after the
        # PARTITION clause; it always renders after PARTITION.
        (
            "REFRESH MATERIALIZED VIEW lo_mv1 FORCE PARTITION START ('2020-02-01') "
            "END ('2020-03-01')",
            "REFRESH MATERIALIZED VIEW lo_mv1 PARTITION START ('2020-02-01') "
            "END ('2020-03-01') FORCE",
        ),
        (
            "REFRESH MATERIALIZED VIEW lo_mv1 PARTITION START ('2020-02-01') "
            "END ('2020-03-01') FORCE",
            "REFRESH MATERIALIZED VIEW lo_mv1 PARTITION START ('2020-02-01') "
            "END ('2020-03-01') FORCE",
        ),
        (
            "REFRESH MATERIALIZED VIEW lo_mv1 WITH SYNC MODE",
            "REFRESH MATERIALIZED VIEW lo_mv1 WITH SYNC MODE",
        ),
        (
            "REFRESH MATERIALIZED VIEW lo_mv1 WITH ASYNC MODE",
            "REFRESH MATERIALIZED VIEW lo_mv1 WITH ASYNC MODE",
        ),
    ],
)
def test_starrocks_generator_round_trip(sql: str, expected: str) -> None:
    # SQL Lab regenerates SQL from this AST via `format()` for every
    # statement it executes (see `build_statement_blocks` in
    # `superset/sql/execution/executor.py`), so an incorrect round-trip here
    # would send malformed or semantically wrong SQL to the database.
    assert SQLStatement(sql, "starrocks").format() == expected


@pytest.mark.parametrize(
    "sql",
    [
        # Aggregate/unique-key column agg-function suffix.
        "CREATE TABLE t(k1 INT, v2 INT SUM) AGGREGATE KEY(k1) DISTRIBUTED BY HASH(k1)",
        'CREATE TABLE t(k1 INT, v2 INT REPLACE_IF_NOT_NULL DEFAULT "10") '
        "AGGREGATE KEY(k1) DISTRIBUTED BY HASH(k1)",
        # Generated columns without the parenthesized `AS (expr)` form.
        "CREATE TABLE t1(id INT, newcol1 INT AS id + 1)",
        "CREATE TABLE test_tbl1(id INT NOT NULL, data_array ARRAY<int> NOT NULL, "
        "newcol1 DOUBLE AS array_avg(data_array)) PRIMARY KEY (id) "
        "DISTRIBUTED BY HASH(id)",
        "CREATE TABLE t1(id INT, newcol1 INT AS (id + 1))",  # existing form
        # Bare, unnamed inline KEY constraint (a primary/duplicate key marker
        # with no name or column list is also accepted; see the CONSTRAINT_
        # PARSERS override below).
        "CREATE TABLE t (k1 INT, KEY (k1))",
        # GIN/NGRAM full-text index with an inline properties list.
        "CREATE TABLE t(k1 INT, INDEX idx (k1) USING GIN ('parser' = 'english')) "
        "DUPLICATE KEY(k1) DISTRIBUTED BY HASH(k1)",
        "CREATE TABLE t(k1 INT, INDEX idx (k1) USING BITMAP) "
        "DUPLICATE KEY(k1) DISTRIBUTED BY HASH(k1)",  # existing form
        # Inherited MySQL inline-index forms/options, unrelated to the
        # StarRocks-specific GIN case above, but reachable through the same
        # overridden method.
        "CREATE TABLE t (c TEXT, FULLTEXT idx (c))",
        "CREATE TABLE t (k1 INT, INDEX idx (k1) KEY_BLOCK_SIZE = 1024)",
        "CREATE TABLE t (k1 INT, INDEX idx (k1) WITH PARSER ngram)",
        "CREATE TABLE t (k1 INT, INDEX idx (k1) COMMENT 'my index')",
        "CREATE TABLE t (k1 INT, INDEX idx (k1) VISIBLE)",
        "CREATE TABLE t (k1 INT, INDEX idx (k1) INVISIBLE)",
        "CREATE TABLE t (k1 INT, INDEX idx (k1) ENGINE_ATTRIBUTE = 'foo')",
        "CREATE TABLE t (k1 INT, INDEX idx (k1) SECONDARY_ENGINE_ATTRIBUTE = 'foo')",
        # Range partition VALUES forms.
        "CREATE TABLE t(k1 INT) PARTITION BY RANGE (k1) "
        '(PARTITION p1 VALUES LESS THAN ("10")) DISTRIBUTED BY HASH(k1)',
        "CREATE TABLE t(k1 INT) PARTITION BY RANGE (k1) "
        "(PARTITION p1 VALUES LESS THAN MAXVALUE) DISTRIBUTED BY HASH(k1)",
        # Legacy parenthesized MAXVALUE form, distinct from the bare form
        # immediately above.
        "CREATE TABLE t(k1 INT) PARTITION BY RANGE (k1) "
        "(PARTITION p1 VALUES LESS THAN (MAXVALUE)) DISTRIBUTED BY HASH(k1)",
        "CREATE TABLE t(k1 INT) PARTITION BY RANGE (k1) "
        '(PARTITION p1 VALUES [("2021-01-01"), ("2021-01-31"))) '
        "DISTRIBUTED BY HASH(k1)",
        # A range partition item with no VALUES clause at all.
        "CREATE TABLE t(k1 INT) PARTITION BY RANGE (k1) "
        "(PARTITION p1) DISTRIBUTED BY HASH(k1)",
        "CREATE TABLE t(dt DATETIME) PARTITION BY time_slice(dt, INTERVAL 7 day) "
        "DISTRIBUTED BY HASH(dt)",
        # ALTER TABLE clause variants.
        "ALTER TABLE example_db.my_table DROP PARTITION p1",
        "ALTER TABLE example_db.my_table DROP PARTITION IF EXISTS p1 FORCE",
        "ALTER TABLE example_db.my_table DROP TEMPORARY PARTITION p1",  # existing
        "ALTER TABLE example_db.my_table DROP PARTITION (p1, p2)",  # existing
        "ALTER TABLE db.tbl ADD ROLLUP r1(col1,col2) FROM r0",
        "ALTER TABLE db.tbl ADD ROLLUP r1(col1,col2)",
        "ALTER TABLE db.tbl DROP ROLLUP r1",  # existing
        "ALTER TABLE my_table ADD COLUMN new_col INT KEY DEFAULT '0' FIRST",
        # existing form:
        "ALTER TABLE my_table ADD COLUMN new_col INT DEFAULT '0' AFTER col1",
        "ALTER TABLE my_table ADD COLUMN (c1 INT DEFAULT '0', c2 INT DEFAULT '0')",
        # existing form:
        "ALTER TABLE my_table ADD COLUMNS (c1 INT DEFAULT '0', c2 INT DEFAULT '0')",
        "ALTER TABLE my_table ADD COLUMN c1 INT DEFAULT '0'",  # existing
        # Degenerate input where the "(" right after ADD COLUMN turns out not
        # to be a column list (disambiguated from a subquery start), so the
        # multi-column fast path backs off to the generic ADD handling.
        "ALTER TABLE t ADD COLUMN (SELECT 1)",
        "DROP INDEX index_name ON db.table1",
        "DROP COLUMN t1.c1",
        "DROP TABLE t1 ON cluster_name",
        "DROP FUNCTION my_func(INT, VARCHAR)",
        "DELETE FROM my_table PARTITION p1 WHERE k1 = 3",
        "DELETE FROM my_table PARTITION (p1, p2) WHERE k1 = 3",
        # MySQL "Multiple-Table Syntax" delete, where the target list
        # precedes FROM instead of following it directly.
        "DELETE t1 FROM t1 JOIN t2 ON t1.id = t2.id WHERE t2.x = 1",
        # INSERT clause variants.
        "INSERT OVERWRITE test PARTITION(p1, p2) WITH LABEL `label1` "
        "SELECT * FROM test3",
        "INSERT OVERWRITE test WITH LABEL `label1` (c1, c2) SELECT * FROM test3",
        "INSERT INTO test WITH LABEL `label1` SELECT * FROM test3",
        'INSERT INTO FILES("path" = "s3://bucket/x/", "format" = "parquet") '
        "SELECT * FROM t",
        "INSERT OVERWRITE test SELECT * FROM test3",  # existing form
        # Regression guard: the ordinary `INSERT INTO t (col1, col2) VALUES
        # (...)` column-list form -- with no WITH LABEL and no table
        # function -- must still resolve via the normal schema=True path,
        # not get misread as a table-valued-function call.
        "INSERT INTO t (c1) VALUES (1)",
        "INSERT INTO t AS t_alias VALUES (1)",
    ],
)
def test_starrocks_create_alter_table_clauses_parse(sql: str) -> None:
    SQLStatement(sql, "starrocks")


@pytest.mark.parametrize(
    "sql, expected",
    [
        # ANALYZE writes CBO statistics server-side; structured `exp.Analyze`
        # was missing from the mutating-node tuple.
        ("ANALYZE TABLE tbl_name", True),
        ("ANALYZE TABLE tbl_name DROP HISTOGRAM ON col_name", True),
        ("ANALYZE TABLE tbl_name UPDATE HISTOGRAM ON v1,v2 WITH 32 BUCKETS", True),
        ("KILL ANALYZE 266030", True),
        ("KILL QUERY 5", True),
        ("KILL 20", True),
        # REFRESH MATERIALIZED VIEW/DICTIONARY/CONNECTIONS/EXTERNAL TABLE all
        # parse to a structured `exp.Refresh`, also missing from the tuple.
        ("REFRESH MATERIALIZED VIEW lo_mv1", True),
        ("REFRESH DICTIONARY dict_obj", True),
        ("REFRESH CONNECTIONS", True),
        ("REFRESH EXTERNAL TABLE t1", True),
        ("CANCEL REFRESH MATERIALIZED VIEW lo_mv1", True),
        # SET PASSWORD/ROLE/DEFAULT ROLE/DEFAULT STORAGE VOLUME all fall
        # back to an opaque `exp.Command` with head "SET", which the
        # dialect gate only recognised for PostgreSQL.
        ("SET PASSWORD FOR 'jack'@'192.%' = PASSWORD('123456')", True),
        ("SET ROLE db_admin", True),
        ("SET ROLE ALL EXCEPT db_admin", True),
        ("SET DEFAULT ROLE db_admin TO test", True),
        ("SET DEFAULT STORAGE VOLUME my_s3_volume", True),
        # `SET PASSWORD = ...` (own account) parses as a plain structured
        # `exp.Set`, indistinguishable from a benign session variable except
        # by inspecting the assignment target.
        ("SET PASSWORD = PASSWORD('123456')", True),
        # Ordinary session variables must still read as non-mutating.
        ("SET time_zone = 'UTC'", False),
        ("SET SESSION time_zone = 'UTC'", False),
        ("SET @myvar = 1", False),
        ("SET NAMES utf8mb4", False),
        # Admin/ops/job-control commands that always fall back to an opaque
        # `exp.Command` with one of these heads.
        (
            "BACKUP SNAPSHOT example_db.snapshot_label1 TO example_repo "
            'PROPERTIES ("type" = "full")',
            True,
        ),
        ("CANCEL BACKUP FROM example_db", True),
        ("CANCEL RESTORE FROM example_db", True),
        ('CANCEL LOAD WHERE LABEL = "example_label"', True),
        ("CANCEL ALTER TABLE COLUMN FROM example_db.my_table", True),
        (
            'EXPORT TABLE testTbl TO "hdfs://h:9000/a/b/c/testTbl_" WITH BROKER',
            True,
        ),
        ("PAUSE ROUTINE LOAD FOR example_db.example_tbl1_ordertest1", True),
        ("RESUME ROUTINE LOAD FOR example_db.example_tbl1_ordertest1", True),
        ("STOP ROUTINE LOAD FOR example_db.example_tbl1_ordertest1", True),
        ("SUBMIT TASK etl0 AS CREATE TABLE tbl1 AS SELECT * FROM src_tbl", True),
        ("RECOVER DATABASE example_db", True),
        ("RECOVER TABLE example_db.example_tbl", True),
        (
            'ADMIN SET FRONTEND CONFIG ("disable_balance" = "true")',
            True,
        ),
        # StarRocks blacklist management via the ADD/DELETE peek.
        ('ADD SQLBLACKLIST "select count(*) from .+"', True),
        ("DELETE SQLBLACKLIST 3, 4", True),
        ("ADD BACKEND BLACKLIST 10001", True),
        ("DELETE BACKEND BLACKLIST 10001", True),
        # Ordinary DELETE (and the ADD/DELETE peek generally) must not
        # misclassify unrelated statements.
        ("DELETE FROM my_table WHERE k1 = 3", True),
        ("DELETE FROM my_table PARTITION p1 WHERE k1 = 3", True),
        # TRANSLATE TRINO only returns translated SQL text; it is a read.
        ("TRANSLATE TRINO SELECT 1", False),
        ("SELECT 1", False),
        ("SHOW TABLES", False),
        ("SHOW TABLES IN catalog_1.schema_a", False),
    ],
)
def test_is_mutating_starrocks_command_constructs(sql: str, expected: bool) -> None:
    """
    Several StarRocks constructs are either structured nodes sqlglot models
    but ``is_mutating`` didn't check (``exp.Analyze``, ``exp.Kill``,
    ``exp.Refresh``), or fall back to an opaque ``exp.Command`` whose head
    keyword wasn't in the mutating set, or -- for ``SET PASSWORD`` on the
    caller's own account -- parse identically to a benign session variable.
    Every one of these must be classified as mutating so a query-only role
    can't run them through the SQL Lab read-only gate; ordinary session
    variables and reads must stay classified as non-mutating.
    """
    assert SQLStatement(sql, "starrocks").is_mutating() == expected


@pytest.mark.parametrize(
    "method",
    [LimitMethod.FORCE_LIMIT, LimitMethod.WRAP_SQL],
)
@pytest.mark.parametrize(
    "sql",
    [
        "DESCRIBE test.will_test1",
        "USE test",
        "SET time_zone = 'UTC'",
        "GRANT SELECT ON t1 TO u1",
    ],
)
def test_set_limit_value_leaves_non_query_statements_unchanged(
    sql: str, method: LimitMethod
) -> None:
    """
    ``SHOW`` is not the only statement with nowhere to put a `LIMIT`.

    `apply_limit()` only skips *mutating* statements, so every read-only
    non-query statement reaches ``set_limit_value``. These happen to survive
    a forced limit today only because their sqlglot generators ignore an
    unexpected ``limit`` arg -- a silent dependency on generator internals.
    Guarding on ``exp.Query`` makes leaving them alone explicit, so a future
    sqlglot that starts rendering `limit` for one of these node types can't
    reintroduce the ``SHOW`` bug under a different keyword.
    """
    statement = SQLStatement(sql, "starrocks")
    original = statement.format()
    statement.set_limit_value(1000, method)
    assert statement.format() == original
    assert "LIMIT" not in statement.format()


@pytest.mark.parametrize(
    "sql",
    [
        # `UNION` parses as `exp.Union` and a parenthesized query as
        # `exp.Subquery` -- neither is an `exp.Select`, so narrowing the guard
        # to `is_select()` would silently stop limiting them.
        "SELECT 1 UNION SELECT 2",
        "(SELECT 1)",
        "WITH t AS (SELECT 1) SELECT * FROM t",
    ],
)
def test_set_limit_value_limits_non_select_query_expressions(sql: str) -> None:
    """
    Query expressions that aren't `SELECT` must still be limited.
    """
    statement = SQLStatement(sql, "starrocks")
    statement.set_limit_value(1000, LimitMethod.FORCE_LIMIT)
    assert "LIMIT 1000" in statement.format()


@pytest.mark.parametrize(
    "kql, limit, expected",
    [
        ("StormEvents | take 10", 100, "StormEvents | take 100"),
        ("StormEvents | limit 20", 10, "StormEvents | limit 10"),
        (
            "StormEvents | where State == 'FL' | summarize count()",
            10,
            "StormEvents | where State == 'FL' | summarize count() | take 10",
        ),
        (
            "StormEvents | where name has 'limit 10'",
            10,
            "StormEvents | where name has 'limit 10' | take 10",
        ),
        ("AnotherTable | take 5", 50, "AnotherTable | take 50"),
        (
            "datatable(x:int) [1, 2, 3] | take 100",
            10,
            "datatable(x:int) [1, 2, 3] | take 10",
        ),
        (
            """
    Table1 | where msg contains 'abc;xyz'
           | limit 5
    """,
            10,
            """Table1 | where msg contains 'abc;xyz'
           | limit 10""",
        ),
    ],
)
def test_set_kql_limit_value(kql: str, limit: int, expected: str) -> None:
    """
    Test the `set_limit_value` method for KustoKQLStatement.
    """
    statement = KustoKQLStatement(kql, "kustokql")
    statement.set_limit_value(limit)
    assert statement.format() == expected


@pytest.mark.parametrize("method", [LimitMethod.WRAP_SQL, LimitMethod.FETCH_MANY])
def test_set_kql_limit_value_invalid_method(method: LimitMethod) -> None:
    """
    Test that setting a limit value with an invalid method raises an error.
    """
    statement = KustoKQLStatement("foo", "kustokql")

    with pytest.raises(
        SupersetParseError,
        match="Kusto KQL only supports the FORCE_LIMIT method.",
    ):
        statement.set_limit_value(10, method)


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT 1", "postgresql", False),
        ("SELECT 1 AS cnt", "postgresql", False),
        (
            """
SELECT 'INR' AS cur
UNION
SELECT 'USD' AS cur
UNION
SELECT 'EUR' AS cur
            """,
            "postgresql",
            False,
        ),
        ("WITH cte AS (SELECT 1) SELECT * FROM cte", "postgresql", True),
        (
            """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM t2),
    z AS (SELECT b AS c FROM t3)
SELECT c FROM z
            """,
            "postgresql",
            True,
        ),
        (
            """
WITH
    x AS (SELECT a FROM t1),
    y AS (SELECT a AS b FROM x),
    z AS (SELECT b AS c FROM y)
SELECT c FROM z
            """,
            "postgresql",
            True,
        ),
        (
            """
WITH CTE__test (SalesPersonID, SalesOrderID, SalesYear)
AS (
    SELECT SalesPersonID, SalesOrderID, YEAR(OrderDate) AS SalesYear
    FROM SalesOrderHeader
    WHERE SalesPersonID IS NOT NULL
)
SELECT SalesPersonID, COUNT(SalesOrderID) AS TotalSales, SalesYear
FROM CTE__test
GROUP BY SalesYear, SalesPersonID
ORDER BY SalesPersonID, SalesYear;
            """,
            "postgresql",
            True,
        ),
    ],
)
def test_has_cte(sql: str, engine: str, expected: bool) -> None:
    """
    Test that the parser detects CTEs correctly.
    """
    assert SQLStatement(sql, engine).has_cte() == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        (
            "SELECT 1",
            "postgresql",
            "WITH __cte AS (\n  SELECT\n    1\n)",
        ),
        (
            """
WITH currency AS (SELECT 'INR' AS cur),
     currency_2 AS (SELECT 'USD' AS cur)
SELECT * FROM currency
UNION ALL
SELECT * FROM currency_2
            """,
            "postgresql",
            """
WITH currency AS (
  SELECT
    'INR' AS cur
), currency_2 AS (
  SELECT
    'USD' AS cur
), __cte AS (
  SELECT
    *
  FROM currency
  UNION ALL
  SELECT
    *
  FROM currency_2
)
            """.strip(),
        ),
    ],
)
def test_as_cte(sql: str, engine: str, expected: str) -> None:
    """
    Test that we can covert select to CTE.
    """
    assert SQLStatement(sql, engine).as_cte().format() == expected


def test_as_cte_called_twice() -> None:
    """
    Test that calling as_cte() multiple times on the same instance works.

    Regression test for a bug where as_cte() sets self._parsed.args["with_"] = None
    after extracting CTEs, but has_cte() only checked if the key existed, not if
    the value was truthy. This caused an AttributeError on subsequent as_cte() calls.
    """
    sql = "WITH cte AS (SELECT 1) SELECT * FROM cte"
    stmt = SQLStatement(sql, "postgresql")

    assert stmt.has_cte() is True
    stmt.as_cte()
    assert stmt.has_cte() is False
    stmt.as_cte()


@pytest.mark.parametrize(
    ("sql", "removed"),
    [
        ("SELECT value FROM source ORDER BY value", True),
        ("SELECT TOP 1 value FROM source ORDER BY value", False),
        ("SELECT value FROM source ORDER BY value OFFSET 0 ROWS", False),
        ("SELECT value FROM source ORDER BY value FOR JSON AUTO", False),
    ],
)
def test_remove_unbounded_top_level_order_by(sql: str, removed: bool) -> None:
    statement = SQLStatement(sql, "mssql")

    assert statement.remove_unbounded_top_level_order_by() is removed
    assert ("ORDER BY" not in statement.format()) is removed


@pytest.mark.parametrize(
    "sql, rules, expected",
    [
        (
            "SELECT t.foo FROM some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM (
  SELECT
    *
  FROM some_table
  WHERE
    id = 42
) AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM some_table AS t",
            {},
            """
SELECT
  t.foo
FROM some_table AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM some_table AS t WHERE bar = 'baz'",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM (
  SELECT
    *
  FROM some_table
  WHERE
    id = 42
) AS t
WHERE
  bar = 'baz'
            """.strip(),
        ),
        (
            "SELECT t.foo FROM schema1.some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM (
  SELECT
    *
  FROM schema1.some_table
  WHERE
    id = 42
) AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM schema1.some_table AS t",
            {Table("some_table", "schema2"): "id = 42"},
            "SELECT\n  t.foo\nFROM schema1.some_table AS t",
        ),
        (
            "SELECT t.foo FROM catalog1.schema1.some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM (
  SELECT
    *
  FROM catalog1.schema1.some_table
  WHERE
    id = 42
) AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM catalog1.schema1.some_table AS t",
            {Table("some_table", "schema1", "catalog2"): "id = 42"},
            "SELECT\n  t.foo\nFROM catalog1.schema1.some_table AS t",
        ),
        (
            "SELECT * FROM some_table WHERE 1=1",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM some_table
  WHERE
    id = 42
) AS "some_table"
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM table
  WHERE
    id = 42
) AS "table"
WHERE
  1 = 1
            """.strip(),
        ),
        (
            'SELECT * FROM "table" WHERE 1=1',
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM "table"
  WHERE
    id = 42
) AS "table"
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM other_table WHERE 1=1",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM other_table
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM table JOIN other_table ON table.id = other_table.id",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN (
  SELECT
    *
  FROM other_table
  WHERE
    id = 42
) AS "other_table"
  ON table.id = other_table.id
            """.strip(),
        ),
        (
            'SELECT * FROM "table" JOIN other_table ON "table".id = other_table.id',
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM "table"
  WHERE
    id = 42
) AS "table"
JOIN other_table
  ON "table".id = other_table.id
            """.strip(),
        ),
        (
            "SELECT * FROM (SELECT * FROM some_table)",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM (
    SELECT
      *
    FROM some_table
    WHERE
      id = 42
  ) AS "some_table"
)
            """.strip(),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM table
  WHERE
    id = 42
) AS "table"
UNION ALL
SELECT
  *
FROM other_table
            """.strip(),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
UNION ALL
SELECT
  *
FROM (
  SELECT
    *
  FROM other_table
  WHERE
    id = 42
) AS "other_table"
            """.strip(),
        ),
        (
            "SELECT a.*, b.* FROM tbl_a AS a INNER JOIN tbl_b AS b ON a.col = b.col",
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  a.*,
  b.*
FROM (
  SELECT
    *
  FROM tbl_a
  WHERE
    id = 42
) AS a
INNER JOIN tbl_b AS b
  ON a.col = b.col
            """.strip(),
        ),
        (
            "SELECT a.*, b.* FROM tbl_a a INNER JOIN tbl_b b ON a.col = b.col",
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  a.*,
  b.*
FROM (
  SELECT
    *
  FROM tbl_a
  WHERE
    id = 42
) AS a
INNER JOIN tbl_b AS b
  ON a.col = b.col
            """.strip(),
        ),
        (
            "SELECT * FROM public.flights LIMIT 100",
            {Table("flights", "public", "catalog1"): "\"AIRLINE\" like 'A%'"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM public.flights
  WHERE
    "AIRLINE" LIKE 'A%'
) AS "flights"
LIMIT 100
        """.strip(),
        ),
        (
            'SELECT * FROM tbl_a AS "x AND 1 = 0 OR 1 = 1"',
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM tbl_a
  WHERE
    id = 42
) AS "x AND 1 = 0 OR 1 = 1"
            """.strip(),
        ),
        (
            "SELECT c1 FROM tbl_a AS x (c1, c2)",
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  c1
FROM (
  SELECT
    *
  FROM tbl_a
  WHERE
    id = 42
) AS x(c1, c2)
            """.strip(),
        ),
        # A CTE sharing the rule's table name is not a read of it: only the real read
        # inside the CTE body is wrapped; the CTE reference keeps its own projection.
        (
            "WITH some_table AS (SELECT id FROM some_table) SELECT * FROM some_table",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
WITH some_table AS (
  SELECT
    id
  FROM (
    SELECT
      *
    FROM some_table
    WHERE
      id = 42
  ) AS "some_table"
)
SELECT
  *
FROM some_table
            """.strip(),
        ),
        # A correlated ``LATERAL`` reaches the outer read through two scopes: wrapped
        # once, not twice. The lateral's own read is a distinct node, wrapped in place.
        (
            "SELECT * FROM some_table, LATERAL ("
            "SELECT * FROM other_table WHERE other_table.x = some_table.x) t",
            {
                Table("some_table", "schema1", "catalog1"): "id = 42",
                Table("other_table", "schema1", "catalog1"): "id = 7",
            },
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM some_table
  WHERE
    id = 42
) AS "some_table", LATERAL (
  SELECT
    *
  FROM (
    SELECT
      *
    FROM other_table
    WHERE
      id = 7
  ) AS "other_table"
  WHERE
    other_table.x = some_table.x
) AS t
            """.strip(),
        ),
        # A read in a DML statement's subquery is filtered in place, not refused: the
        # ``UPDATE`` target is not a source, so only the ``SELECT`` read of ``t`` wraps.
        (
            "UPDATE dst SET x = 1 WHERE id IN (SELECT id FROM t)",
            {Table("t", "schema1", "catalog1"): "id = 42"},
            """
UPDATE dst SET x = 1
WHERE
  id IN (
    SELECT
      id
    FROM (
      SELECT
        *
      FROM t
      WHERE
        id = 42
    ) AS "t"
  )
            """.strip(),
        ),
    ],
)
def test_rls_subquery_transformer(
    sql: str,
    rules: dict[Table, str],
    expected: str,
) -> None:
    """
    Test `RLSAsSubqueryTransformer`.
    """
    statement = SQLStatement(sql)
    statement.apply_rls(
        "catalog1",
        "schema1",
        {k: [parse_one(v)] for k, v in rules.items()},
        RLSMethod.AS_SUBQUERY,
    )
    assert statement.format() == expected


@pytest.mark.parametrize(
    "sql, read_counts",
    [
        ("SELECT * FROM t", {"t": 1}),
        ("SELECT * FROM t JOIN u ON t.id = u.id", {"t": 1, "u": 1}),
        ("SELECT * FROM t, u", {"t": 1, "u": 1}),
        ("SELECT * FROM t WHERE id IN (SELECT id FROM u)", {"t": 1, "u": 1}),
        # A self-join reads the table through two distinct nodes; both are wrapped.
        ("SELECT * FROM t AS a JOIN t AS b ON a.id = b.id", {"t": 2}),
        # The CTE body's read of ``t`` and the outer read of ``t`` are both wrapped;
        # the CTE reference ``c`` is not a read and carries no rule.
        (
            "WITH c AS (SELECT id FROM t) SELECT * FROM c JOIN t AS t2 ON c.id = t2.id",
            {"t": 2},
        ),
        ("SELECT * FROM (SELECT * FROM t) AS x", {"t": 1}),
        # Pins the deepest-first ordering. The parenthesised join head ``t`` carries the
        # join to ``u`` in its own args, so ``u`` must be wrapped before ``t``; wrapping
        # ``t`` first would copy ``u`` into ``t``'s subquery and drop ``u``'s filter.
        # Flipping the sort to ``reverse=False`` makes this case fail.
        ("SELECT * FROM (t JOIN u ON t.id = u.id)", {"t": 1, "u": 1}),
        # A correlated ``LATERAL`` reaches the outer read through two scopes; it is
        # wrapped once, and the lateral's own read is wrapped once.
        (
            "SELECT * FROM some_table, LATERAL ("
            "SELECT * FROM other_table WHERE other_table.x = some_table.x) t",
            {"some_table": 1, "other_table": 1},
        ),
    ],
)
def test_rls_subquery_filters_every_authorized_read(
    sql: str,
    read_counts: dict[str, int],
) -> None:
    """The set the rewrite filters equals the set authorization enforces.

    Each read gets a table-specific sentinel predicate; its count in the output must
    equal that table's real-read node count, catching a dropped read or a double-wrap.
    """
    authorized = {t.table for t in extract_tables_from_statement(parse_one(sql), None)}
    assert authorized == set(read_counts)

    statement = SQLStatement(sql)
    statement.apply_rls(
        "catalog1",
        "schema1",
        {
            Table(table, "schema1", "catalog1"): [parse_one(f"rls_{table} = 1")]
            for table in read_counts
        },
        RLSMethod.AS_SUBQUERY,
    )
    output = statement.format()
    for table, count in read_counts.items():
        assert output.count(f"rls_{table} = 1") == count


def test_rls_invalid_method(mocker: MockerFixture) -> None:
    """
    Test that an invalid RLS method raises an error.
    """
    statement = SQLStatement("SELECT 1", "postgresql")
    predicates = mocker.MagicMock()

    with pytest.raises(ValueError, match="Invalid RLS method: invalid"):
        statement.apply_rls("catalog1", "schema1", predicates, "invalid")  # type: ignore


@pytest.mark.parametrize(
    "sql, rules, expected",
    [
        (
            "SELECT t.foo FROM some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM some_table AS t
WHERE
  t.id = 42
            """.strip(),
        ),
        (
            "SELECT t.foo FROM schema2.some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM schema2.some_table AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM catalog2.schema1.some_table AS t",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM catalog2.schema1.some_table AS t
            """.strip(),
        ),
        (
            "SELECT t.foo FROM some_table AS t WHERE bar = 'baz'",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM some_table AS t
WHERE
  t.id = 42 AND (
    bar = 'baz'
  )
            """.strip(),
        ),
        (
            "SELECT t.foo FROM some_table AS t WHERE bar = 'baz' OR foo = 'qux'",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  t.foo
FROM some_table AS t
WHERE
  t.id = 42 AND (
    bar = 'baz' OR foo = 'qux'
  )
            """.strip(),
        ),
        (
            "SELECT * FROM some_table WHERE 1=1",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM some_table
WHERE
  some_table.id = 42 AND (
    1 = 1
  )
            """.strip(),
        ),
        (
            "SELECT * FROM some_table WHERE TRUE OR FALSE",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM some_table
WHERE
  some_table.id = 42 AND (
    TRUE OR FALSE
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42 AND (
    1 = 1
  )
            """.strip(),
        ),
        (
            'SELECT * FROM "table" WHERE 1=1',
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM "table"
WHERE
  "table".id = 42 AND (
    1 = 1
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM other_table WHERE 1=1",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM other_table
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM table",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42
            """.strip(),
        ),
        (
            "SELECT * FROM some_table",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM some_table
WHERE
  some_table.id = 42
            """.strip(),
        ),
        (
            "SELECT * FROM table ORDER BY id",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42
ORDER BY
  id
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1 AND table.id=42",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42 AND (
    1 = 1 AND table.id = 42
  )
            """.strip(),
        ),
        (
            """
SELECT * FROM table
JOIN other_table
ON table.id = other_table.id
AND other_table.id=42
            """,
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN other_table
  ON other_table.id = 42 AND (
    table.id = other_table.id AND other_table.id = 42
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table WHERE 1=1 AND id=42",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42 AND (
    1 = 1 AND id = 42
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table JOIN other_table ON table.id = other_table.id",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN other_table
  ON other_table.id = 42 AND (
    table.id = other_table.id
  )
            """.strip(),
        ),
        (
            "SELECT * FROM table JOIN other_table",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN other_table
  ON other_table.id = 42
            """.strip(),
        ),
        (
            """
SELECT *
FROM table
JOIN other_table
ON table.id = other_table.id
WHERE 1=1
            """,
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
JOIN other_table
  ON other_table.id = 42 AND (
    table.id = other_table.id
  )
WHERE
  1 = 1
            """.strip(),
        ),
        (
            "SELECT * FROM (SELECT * FROM other_table)",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  SELECT
    *
  FROM other_table
  WHERE
    other_table.id = 42
)
            """.strip(),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            {Table("table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
WHERE
  table.id = 42
UNION ALL
SELECT
  *
FROM other_table
            """.strip(),
        ),
        (
            "SELECT * FROM table UNION ALL SELECT * FROM other_table",
            {Table("other_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM table
UNION ALL
SELECT
  *
FROM other_table
WHERE
  other_table.id = 42
            """.strip(),
        ),
        (
            "INSERT INTO some_table (col1, col2) VALUES (1, 2)",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
INSERT INTO some_table (
  col1,
  col2
)
VALUES
  (1, 2)
            """.strip(),
        ),
        (
            'SELECT * FROM tbl_a AS "x AND 1 = 0 OR 1 = 1"',
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM tbl_a AS "x AND 1 = 0 OR 1 = 1"
WHERE
  "x AND 1 = 0 OR 1 = 1".id = 42
            """.strip(),
        ),
        (
            'SELECT * FROM tbl_a AS "a.b"',
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM tbl_a AS "a.b"
WHERE
  "a.b".id = 42
            """.strip(),
        ),
        # A column-list alias has no name (``this`` is ``None``); qualify with the table
        # so the predicate does not resolve outward into an enclosing scope.
        (
            "SELECT * FROM tbl_a AS (c1, c2)",
            {Table("tbl_a", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM tbl_a AS _t0(c1, c2)
WHERE
  tbl_a.id = 42
            """.strip(),
        ),
        # A table heading a parenthesised join is a read, but its parent is the wrapping
        # ``Subquery``, not a ``From``/``Join``, so the predicate method leaves it --
        # fail-closed (the subquery method filters it). Pinned to catch a shape change.
        (
            "SELECT * FROM (some_table JOIN other_table "
            "ON some_table.id = other_table.id)",
            {Table("some_table", "schema1", "catalog1"): "id = 42"},
            """
SELECT
  *
FROM (
  some_table
    JOIN other_table
      ON some_table.id = other_table.id
)
            """.strip(),
        ),
    ],
)
def test_rls_predicate_transformer(
    sql: str,
    rules: dict[Table, str],
    expected: str,
) -> None:
    """
    Test `RLSPredicateTransformer`.
    """
    statement = SQLStatement(sql)
    statement.apply_rls(
        "catalog1",
        "schema1",
        {k: [parse_one(v)] for k, v in rules.items()},
        RLSMethod.AS_PREDICATE,
    )
    assert statement.format() == expected


@pytest.mark.parametrize(
    "sql, table, expected",
    [
        (
            "SELECT * FROM some_table",
            Table("some_table"),
            """
CREATE TABLE "some_table" AS
SELECT
  *
FROM some_table
            """.strip(),
        ),
        (
            "SELECT * FROM some_table",
            Table("some_table", "schema1", "catalog1"),
            """
CREATE TABLE "catalog1"."schema1"."some_table" AS
SELECT
  *
FROM some_table
            """.strip(),
        ),
    ],
)
def test_as_create_table(sql: str, table: Table, expected: str) -> None:
    """
    Test the `as_create_table` method.
    """
    statement = SQLStatement(sql)
    create_table = statement.as_create_table(table, CTASMethod.TABLE)
    assert create_table.format() == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM table", "postgresql", True),
        (
            """
-- comment
SELECT * FROM table
-- comment 2
            """,
            "mysql",
            True,
        ),
        (
            """
-- comment
SET @value = 42;
SELECT @value as foo;
-- comment 2
            """,
            "mysql",
            True,
        ),
        (
            """
-- comment
EXPLAIN SELECT * FROM table
-- comment 2
            """,
            "mysql",
            False,
        ),
        (
            """
SELECT * FROM table;
INSERT INTO TABLE (foo) VALUES (42);
            """,
            "mysql",
            False,
        ),
    ],
)
def test_is_valid_ctas(sql: str, engine: str, expected: bool) -> None:
    """
    Test the `is_valid_ctas` method.
    """
    assert SQLScript(sql, engine).is_valid_ctas() == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM table", "postgresql", True),
        (
            """
-- comment
SELECT * FROM table
-- comment 2
            """,
            "mysql",
            True,
        ),
        (
            """
-- comment
SET @value = 42;
SELECT @value as foo;
-- comment 2
            """,
            "mysql",
            False,
        ),
        (
            """
-- comment
SELECT value as foo;
-- comment 2
            """,
            "mysql",
            True,
        ),
        (
            """
SELECT * FROM table;
INSERT INTO TABLE (foo) VALUES (42);
            """,
            "mysql",
            False,
        ),
    ],
)
def test_is_valid_cvas(sql: str, engine: str, expected: bool) -> None:
    """
    Test the `is_valid_cvas` method.
    """
    assert SQLScript(sql, engine).is_valid_cvas() == expected


@pytest.mark.parametrize(
    "sql, expected, engine",
    [
        ("col = 1", "col = 1", "base"),
        # Comment-free clauses are returned verbatim (no semantic round-trip).
        ("1=\t\n1", "1=\t\n1", "base"),
        ("(col = 1)", "(col = 1)", "base"),  # Compact format without newlines
        (
            "(col1 = 1) AND (col2 = 2)",
            "(col1 = 1) AND (col2 = 2)",
            "base",
        ),  # Compact format
        (
            "col = 'abc' -- comment",
            "col = 'abc' /* comment */",
            "base",
        ),  # Line comments converted to block comments
        (
            "TRUE /* precise_count_distinct=true */",
            "TRUE /* precise_count_distinct=true */",
            "base",
        ),  # Block comments preserved
        (
            "col > 1 /* hint=value */",
            "col > 1 /* hint=value */",
            "base",
        ),  # Block comments preserved
        ("col = 'col1 = 1) AND (col2 = 2'", "col = 'col1 = 1) AND (col2 = 2'", "base"),
        ("col = 'select 1; select 2'", "col = 'select 1; select 2'", "base"),
        # Trailing statement terminators are stripped so the clause stays valid
        # once embedded inside a larger fragment (e.g. ``WHERE (...)``).
        ("col = 1;", "col = 1", "base"),
        ("col = 1 ; ", "col = 1", "base"),
        ("col = 'abc -- comment'", "col = 'abc -- comment'", "base"),
        ("col1 = 1) AND (col2 = 2)", QueryClauseValidationException, "base"),
        ("(col1 = 1) AND (col2 = 2", QueryClauseValidationException, "base"),
        ("col1 = 1) AND (col2 = 2", QueryClauseValidationException, "base"),
        ("(col1 = 1)) AND ((col2 = 2)", QueryClauseValidationException, "base"),
        ("TRUE; SELECT 1", QueryClauseValidationException, "base"),
        # Regression test for https://github.com/apache/superset/issues/39223:
        # dialects with `MULTI_ARG_DISTINCT=False` (Postgres, Presto, Trino,
        # DuckDB) must not rewrite user-defined multi-argument DISTINCT
        # aggregates into row-expression null guards. Dremio is included
        # below as a defensive regression guard even though its generator
        # does not currently set `MULTI_ARG_DISTINCT=False`.
        (
            "DISTINCT_AVG(DISTINCT report_id, time_to_accept / 86400)",
            "DISTINCT_AVG(DISTINCT report_id, time_to_accept / 86400)",
            "postgresql",
        ),
        (
            "DISTINCT_SUM(DISTINCT report_id, total_bounty_reward_amount)",
            "DISTINCT_SUM(DISTINCT report_id, total_bounty_reward_amount)",
            "postgresql",
        ),
        (
            "DISTINCT_AVG(DISTINCT k, v)",
            "DISTINCT_AVG(DISTINCT k, v)",
            "presto",
        ),
        (
            "DISTINCT_AVG(DISTINCT k, v)",
            "DISTINCT_AVG(DISTINCT k, v)",
            "trino",
        ),
        (
            "DISTINCT_AVG(DISTINCT k, v)",
            "DISTINCT_AVG(DISTINCT k, v)",
            "duckdb",
        ),
        (
            "DISTINCT_AVG(DISTINCT k, v)",
            "DISTINCT_AVG(DISTINCT k, v)",
            "dremio",
        ),
        # Single-argument DISTINCT must still round-trip cleanly.
        (
            "COUNT(DISTINCT x)",
            "COUNT(DISTINCT x)",
            "postgresql",
        ),
    ],
)
def test_sanitize_clause(sql: str, expected: str | Exception, engine: str) -> None:
    """
    Test the `sanitize_clause` function.
    """
    if isinstance(expected, str):
        assert sanitize_clause(sql, engine) == expected
    else:
        with pytest.raises(expected):
            sanitize_clause(sql, engine)


@pytest.mark.parametrize(
    "engine",
    ["postgresql", "redshift", "cockroachdb", "netezza", "hana", "base", "mysql"],
)
def test_sanitize_clause_preserves_aggregation_semantics(engine: str) -> None:
    """
    Regression test for https://github.com/apache/superset/issues/36113.

    `sanitize_clause` must not silently rewrite a user-authored expression. The
    Postgres SQLGlot dialect (which several engines borrow) rewrites
    ``ROUND(AVG(x), n)`` to ``ROUND(CAST(AVG(x) AS DECIMAL), n)`` at generation
    time. On engines whose unqualified ``DECIMAL`` defaults to scale 0 (e.g.
    Redshift, Netezza) the injected cast rounds the aggregate to an integer
    *before* the explicit ``ROUND``, producing wrong results.

    The clause must be returned unchanged regardless of the engine dialect.
    """
    clause = "ROUND(AVG(col), 4)"
    sanitized = sanitize_clause(clause, engine)
    assert "CAST" not in sanitized.upper(), (
        f"sanitize_clause injected a cast for engine {engine!r}: {sanitized!r}"
    )
    assert sanitized == clause


@pytest.mark.parametrize(
    "engine",
    ["postgresql", "redshift", "cockroachdb", "netezza", "hana", "base", "mysql"],
)
def test_sanitize_clause_preserves_aggregation_semantics_with_comment(
    engine: str,
) -> None:
    """
    Regression test for https://github.com/apache/superset/issues/36113.

    A clause that contains a comment takes the re-rendering branch of
    ``sanitize_clause``. That branch must normalize comments using the *base*
    dialect rather than the engine dialect, so it must not re-apply the Postgres
    ``ROUND(AVG(x), n)`` -> ``ROUND(CAST(AVG(x) AS DECIMAL), n)`` rewrite that
    truncates results on engines where ``DECIMAL`` defaults to scale 0.
    """
    clause = "ROUND(AVG(col), 4) /* precise_count_distinct=true */"
    sanitized = sanitize_clause(clause, engine)
    assert "CAST" not in sanitized.upper(), (
        f"sanitize_clause injected a cast for engine {engine!r}: {sanitized!r}"
    )
    # The comment-handling branch must preserve the user-authored expression and
    # comment payload, not just avoid the cast (otherwise dropping the comment or
    # rewriting the clause entirely would still pass the assertion above).
    assert "ROUND(AVG(col), 4)" in sanitized, (
        f"sanitize_clause rewrote the clause for engine {engine!r}: {sanitized!r}"
    )
    assert "precise_count_distinct=true" in sanitized, (
        f"sanitize_clause dropped the comment for engine {engine!r}: {sanitized!r}"
    )


@pytest.mark.parametrize(
    "engine",
    [
        "postgresql",
        "presto",
        "trino",
        "duckdb",
        "dremio",
    ],
)
def test_sqlstatement_format_preserves_multi_arg_distinct(engine: str) -> None:
    """
    Regression guard for https://github.com/apache/superset/issues/39223:
    ``SQLStatement.format()`` must not rewrite user-defined multi-argument
    DISTINCT aggregates into row-expression null guards. This is the SQL Lab /
    executor path; the metric-expression path is covered by
    ``test_sanitize_clause``.
    """
    sql = "SELECT DISTINCT_AVG(DISTINCT a, b) FROM t"
    formatted = SQLScript(sql, engine).format()
    assert "DISTINCT_AVG(DISTINCT a, b)" in formatted
    assert "CASE WHEN" not in formatted


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@pytest.mark.parametrize(
    "engine",
    [
        "hive",
        "presto",
        "trino",
    ],
)
@pytest.mark.parametrize(
    "macro, expected",
    [
        (
            "latest_partition('foo.bar')",
            {Table(table="bar", schema="foo")},
        ),
        (
            "latest_partition(' foo.bar ')",  # Non-atypical user error which works
            {Table(table="bar", schema="foo")},
        ),
        (
            "latest_partition('foo.%s'|format('bar'))",
            {Table(table="bar", schema="foo")},
        ),
        (
            "latest_sub_partition('foo.bar', baz='qux')",
            {Table(table="bar", schema="foo")},
        ),
        (
            "latest_partitions('foo.bar')",
            {Table(table="bar", schema="foo")},
        ),
        (
            "first_latest_partition('foo.bar')",
            {Table(table="bar", schema="foo")},
        ),
    ],
)
def test_extract_tables_from_jinja_sql(
    mocker: MockerFixture,
    engine: str,
    macro: str,
    expected: set[Table],
) -> None:
    assert (
        process_jinja_sql(
            sql=f"'{{{{ {engine}.{macro} }}}}'",
            database=mocker.MagicMock(backend=engine),
        ).tables
        == expected
    )


@pytest.mark.parametrize(
    "engine",
    [
        "hive",
        "presto",
        "trino",
    ],
)
@pytest.mark.parametrize(
    "macro",
    [
        "latest_partition('foo.%s'|format(str('bar')))",
        "latest_partition('foo.{}'.format('bar'))",
        "latest_partitions('foo.{}'.format('bar'))",
        # A partition macro with the wrong number of arguments cannot be
        # resolved to a single table, so it must also fail closed.
        "latest_partition('foo.bar', 'extra')",
    ],
)
def test_extract_tables_from_jinja_sql_fails_closed(
    mocker: MockerFixture,
    engine: str,
    macro: str,
) -> None:
    """
    A partition macro whose table reference cannot be evaluated statically
    must fail closed, as the macro would otherwise execute against a table
    that never entered the authorization check.
    """
    with pytest.raises(SupersetParseError):
        process_jinja_sql(
            sql=f"'{{{{ {engine}.{macro} }}}}'",
            database=mocker.MagicMock(backend=engine),
        )


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=False)
def test_extract_tables_from_jinja_sql_disabled(mocker: MockerFixture) -> None:
    """
    Test the function when the feature flag is disabled.
    """
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "mssql"

    assert process_jinja_sql(
        sql="SELECT 1 FROM t",
        database=database,
    ).tables == {Table("t")}


def test_extract_tables_from_jinja_sql_invalid_function(mocker: MockerFixture) -> None:
    """
    Test the function with an invalid function.
    """
    database = mocker.MagicMock(backend="postgresql")

    processor = JinjaTemplateProcessor(database)
    processor.env.globals["my_table"] = lambda: "t"
    mocker.patch(
        "superset.jinja_context.get_template_processor",
        return_value=processor,
    )

    assert process_jinja_sql(
        sql="SELECT * FROM {{ my_table() }}",
        database=database,
    ).tables == {Table("t")}


def test_process_jinja_sql_result_object_structure(mocker: MockerFixture) -> None:
    """
    Test that process_jinja_sql returns a proper JinjaSQLResult object
    with correct script and tables properties.
    """
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "postgresql"

    result = process_jinja_sql(
        sql="SELECT id FROM users WHERE active = true",
        database=database,
    )

    # Test that result is the correct type
    assert isinstance(result, JinjaSQLResult)

    # Test that script property returns a SQLScript
    assert hasattr(result, "script")
    assert isinstance(result.script, SQLScript)

    # Test that tables property returns a set of Tables
    assert hasattr(result, "tables")
    assert isinstance(result.tables, set)
    assert result.tables == {Table("users")}

    # Test that the script contains the expected SQL
    formatted_sql = result.script.format()
    assert "users" in formatted_sql
    assert "active = TRUE" in formatted_sql


def test_process_jinja_sql_template_params_parameter(mocker: MockerFixture) -> None:
    """
    Test that the template_params parameter is properly handled.
    """
    database = mocker.MagicMock()
    database.db_engine_spec.engine = "postgresql"

    processor = JinjaTemplateProcessor(database)
    mocker.patch(
        "superset.jinja_context.get_template_processor",
        return_value=processor,
    )

    # Test that template_params parameter is accepted and passed through
    result = process_jinja_sql(
        sql="SELECT * FROM table_name",
        database=database,
        template_params={"param1": "value1"},
    )

    # Verify the function accepts the parameter without error
    assert isinstance(result, JinjaSQLResult)
    assert result.tables == {Table("table_name")}


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
def test_process_jinja_sql_renders_exactly_once(mocker: MockerFixture) -> None:
    """
    The authorization path must validate exactly the SQL that executes.

    A template whose first render emits Jinja comment markers inside SQL
    comments used to be rendered a second time, which stripped the markers
    and everything between them from the validated SQL while the executed
    SQL (rendered once) kept the extra statement text.
    """
    database = mocker.MagicMock(backend="postgresql")
    database.db_engine_spec.engine = "postgresql"

    result = process_jinja_sql(
        sql=(
            'SELECT * FROM granted /*{{ "{#" }}*/ '
            'UNION SELECT * FROM restricted /*{{ "#}" }}*/'
        ),
        database=database,
    )

    assert Table("restricted") in result.tables
    assert Table("granted") in result.tables


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM users", "postgresql", True),
        ("WITH cte AS (SELECT * FROM users) SELECT * FROM cte", "postgresql", True),
        ("CREATE TABLE users AS SELECT * FROM users", "postgresql", False),
        ("ALTER TABLE users ADD COLUMN age INT", "postgresql", False),
        ("SET @value = 42", "postgresql", False),
    ],
)
def test_sqlstatement_is_select(sql: str, engine: str, expected: bool) -> None:
    """
    Test the `SQLStatement.is_select()` method.
    """
    assert SQLStatement(sql, engine).is_select() == expected


@pytest.mark.parametrize(
    "kql, expected",
    [
        ("StormEvents | take 10", True),
        ("StormEvents | limit 20", True),
        ("StormEvents | where State == 'FL' | summarize count()", True),
        ("StormEvents | where name has 'limit 10'", True),
        ("AnotherTable | take 5", True),
        ("datatable(x:int) [1, 2, 3] | take 100", True),
        (".create table StormEvents (x:int)", False),
        (".ingest inline into table StormEvents <| StormEvents | take 10", False),
    ],
)
def test_kqlstatement_is_select(kql: str, expected: bool) -> None:
    """
    Test the `KustoKQLStatement.is_select()` method.
    """
    assert KustoKQLStatement(kql, "kustokql").is_select() == expected


def test_singlestore_engine_mapping():
    """
    Test the `singlestoredb` dialect is properly used.
    """
    sql = "SELECT COUNT(*) AS `COUNT(*)`"
    statement = SQLStatement(sql, engine="singlestoredb")
    assert statement.is_select()

    # Should parse without errors
    formatted = statement.format()
    assert "COUNT(*)" in formatted


def test_awsathena_engine_mapping():
    """
    Test the `awsathena` dialect is properly mapped to ATHENA instead of PRESTO.
    """
    sql = (
        "USING EXTERNAL FUNCTION my_func(x INT) RETURNS INT LAMBDA 'lambda_name' "
        "SELECT my_func(id) FROM my_table"
    )
    statement = SQLStatement(sql, engine="awsathena")

    # Should parse without errors using Athena dialect
    statement.format()


def test_remove_quotes() -> None:
    """
    Test the `remove_quotes` helper function.
    """
    assert remove_quotes(None) is None
    assert remove_quotes('"foo"') == "foo"
    assert remove_quotes("'foo'") == "foo"
    assert remove_quotes("`foo`") == "foo"
    assert remove_quotes("'foo`") == "'foo`"


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM table", "postgresql", False),
        ("SELECT VERSION()", "postgresql", True),
        ("SELECT query_to_xml()", "postgresql", True),
        ("WITH cte AS (SELECT * FROM table) SELECT * FROM cte", "postgresql", False),
        (
            """
SELECT *
FROM query_to_xml('SELECT * from some_table WHERE id = 42')
            """,
            "postgresql",
            True,
        ),
        ("Table | limit 10", "kustokql", False),
    ],
)
def test_check_functions_present(sql: str, engine: str, expected: bool) -> None:
    """
    Check the `check_functions_present` method.
    """
    functions = {"version", "query_to_xml"}
    assert SQLScript(sql, engine).check_functions_present(functions) == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("SELECT * FROM my_table", "postgresql", False),
        ("SELECT * FROM pg_stat_activity", "postgresql", True),
        ("SELECT * FROM PG_STAT_ACTIVITY", "postgresql", True),
        ("SELECT * FROM pg_roles", "postgresql", True),
        (
            "WITH cte AS (SELECT 1) SELECT * FROM cte",
            "postgresql",
            False,
        ),
        (
            "SELECT * FROM my_table; SELECT * FROM pg_settings",
            "postgresql",
            True,
        ),
        (
            "SELECT * FROM schema.pg_stat_activity",
            "postgresql",
            True,
        ),
        ("Table | limit 10", "kustokql", False),
    ],
)
def test_check_tables_present(sql: str, engine: str, expected: bool) -> None:
    """
    Check the `check_tables_present` method.
    """
    tables = {"pg_stat_activity", "pg_roles", "pg_settings"}
    assert SQLScript(sql, engine).check_tables_present(tables) == expected


@pytest.mark.parametrize(
    "engine, sql, denylist, expected",
    [
        # Postgres: schema-qualified denylist entry matches schema-qualified
        # reference.
        (
            "postgresql",
            "SELECT * FROM information_schema.tables",
            {"information_schema.tables"},
            True,
        ),
        # ... and is case-insensitive.
        (
            "postgresql",
            "SELECT * FROM INFORMATION_SCHEMA.TABLES",
            {"information_schema.tables"},
            True,
        ),
        # Schema-qualified denylist entry does NOT match a bare-name table
        # of the same name in another schema. A user table named `tables`
        # remains queryable.
        (
            "postgresql",
            "SELECT * FROM public.tables",
            {"information_schema.tables"},
            False,
        ),
        (
            "postgresql",
            "SELECT * FROM tables",
            {"information_schema.tables"},
            False,
        ),
        # Bare-name denylist entry still matches by table name only
        # (existing behavior, schema-agnostic).
        (
            "postgresql",
            "SELECT * FROM pg_stat_activity",
            {"pg_stat_activity"},
            True,
        ),
        (
            "postgresql",
            "SELECT * FROM pg_catalog.pg_stat_activity",
            {"pg_stat_activity"},
            True,
        ),
        # Mixed entries: one schema-qualified, one bare. Match either.
        (
            "postgresql",
            "SELECT * FROM information_schema.columns",
            {"information_schema.tables", "information_schema.columns"},
            True,
        ),
        (
            "postgresql",
            "SELECT * FROM pg_roles",
            {"information_schema.tables", "pg_roles"},
            True,
        ),
        # Negative control.
        (
            "postgresql",
            "SELECT * FROM my_table",
            {"information_schema.tables", "pg_roles"},
            False,
        ),
        # MySQL: the shipped DISALLOWED_SQL_TABLES['mysql'] entries are all
        # schema-qualified (`mysql.user`, `performance_schema.threads`,
        # `performance_schema.processlist`). Without schema-aware matching
        # the entries are dead config. These cases pin the fix.
        (
            "mysql",
            "SELECT user, host, authentication_string FROM mysql.user",
            {"mysql.user"},
            True,
        ),
        (
            "mysql",
            "SELECT * FROM performance_schema.threads",
            {"performance_schema.threads"},
            True,
        ),
        (
            "mysql",
            "SELECT * FROM performance_schema.processlist",
            {"performance_schema.processlist"},
            True,
        ),
        # MySQL must NOT block a user-authored table that shares the leaf
        # name with the system view.
        (
            "mysql",
            "SELECT * FROM mydb.user",
            {"mysql.user"},
            False,
        ),
        # MSSQL: same shape, `sys.*` entries are schema-qualified.
        (
            "mssql",
            "SELECT name, password_hash FROM sys.sql_logins",
            {"sys.sql_logins"},
            True,
        ),
        (
            "mssql",
            "SELECT name, sid FROM sys.server_principals",
            {"sys.server_principals"},
            True,
        ),
        (
            "mssql",
            "SELECT * FROM sys.configurations",
            {"sys.configurations"},
            True,
        ),
        # MSSQL must NOT block a user-authored table sharing the leaf name.
        (
            "mssql",
            "SELECT * FROM mydb.sql_logins",
            {"sys.sql_logins"},
            False,
        ),
        # Three-part (catalog.schema.table) denylist entries match the
        # fully-qualified reference, the multi-dot form is indexed rather than
        # silently dead.
        (
            "trino",
            "SELECT * FROM cat.sys.sql_logins",
            {"cat.sys.sql_logins"},
            True,
        ),
        # ... and a different catalog must NOT match.
        (
            "trino",
            "SELECT * FROM other.sys.sql_logins",
            {"cat.sys.sql_logins"},
            False,
        ),
    ],
)
def test_check_tables_present_schema_qualified(
    engine: str, sql: str, denylist: set[str], expected: bool
) -> None:
    """
    `check_tables_present` must distinguish schema-qualified denylist
    entries (e.g. `information_schema.tables`, `mysql.user`,
    `sys.sql_logins`) from bare-name entries (e.g. `pg_stat_activity`).
    Schema-qualified entries only match schema-qualified references in
    the SQL; bare entries match the table name regardless of schema.

    Covers Postgres, MySQL, and MSSQL dialects so the shipped
    DISALLOWED_SQL_TABLES entries for each remain effective.
    """
    assert SQLScript(sql, engine).check_tables_present(denylist) == expected


@pytest.mark.parametrize(
    "engine, sql, denylist, expected",
    [
        # A schema-qualified match is reported in its original denylist form,
        # not collapsed to the bare leaf name and not the whole denylist.
        (
            "postgresql",
            "SELECT * FROM information_schema.tables",
            {"information_schema.tables", "information_schema.columns", "pg_roles"},
            {"information_schema.tables"},
        ),
        # Bare-name match is reported as-is.
        (
            "postgresql",
            "SELECT * FROM pg_catalog.pg_stat_activity",
            {"pg_stat_activity", "pg_roles"},
            {"pg_stat_activity"},
        ),
        # Multiple references across statements union their matches.
        (
            "postgresql",
            "SELECT * FROM information_schema.tables; SELECT * FROM pg_roles",
            {"information_schema.tables", "pg_roles", "pg_settings"},
            {"information_schema.tables", "pg_roles"},
        ),
        # No match returns an empty set.
        (
            "postgresql",
            "SELECT * FROM my_table",
            {"information_schema.tables", "pg_roles"},
            set(),
        ),
        # A three-part (catalog.schema.table) denylist entry matches a
        # fully-qualified reference, reported in its original form.
        (
            "trino",
            "SELECT * FROM cat.sys.sql_logins",
            {"cat.sys.sql_logins"},
            {"cat.sys.sql_logins"},
        ),
        # ... but only when the catalog lines up: a different catalog does not
        # match the three-part entry.
        (
            "trino",
            "SELECT * FROM other.sys.sql_logins",
            {"cat.sys.sql_logins"},
            set(),
        ),
    ],
)
def test_get_disallowed_tables(
    engine: str, sql: str, denylist: set[str], expected: set[str]
) -> None:
    """
    `get_disallowed_tables` returns exactly the denylist entries referenced,
    in their original (possibly schema-qualified) form, so callers can report
    precisely which tables were hit instead of echoing the whole denylist.
    """
    assert SQLScript(sql, engine).get_disallowed_tables(denylist) == expected


@pytest.mark.parametrize(
    "sql, default_schema, denylist, expected",
    [
        # Unqualified reference resolves to the default schema, so it matches
        # a schema-qualified denylist entry when the schemas line up (e.g. a
        # connection whose search_path is `information_schema`).
        (
            "SELECT * FROM tables",
            "information_schema",
            {"information_schema.tables"},
            {"information_schema.tables"},
        ),
        # ... case-insensitively.
        (
            "SELECT * FROM tables",
            "INFORMATION_SCHEMA",
            {"information_schema.tables"},
            {"information_schema.tables"},
        ),
        # The same unqualified name under a user schema must NOT match: a user
        # table named `tables` stays queryable.
        (
            "SELECT * FROM tables",
            "public",
            {"information_schema.tables"},
            set(),
        ),
        # An explicit schema on the reference wins over the default schema.
        (
            "SELECT * FROM public.tables",
            "information_schema",
            {"information_schema.tables"},
            set(),
        ),
        # Without a default schema, behavior is unchanged: unqualified
        # references never match schema-qualified entries.
        (
            "SELECT * FROM tables",
            None,
            {"information_schema.tables"},
            set(),
        ),
        # Bare-name denylist entries are schema-agnostic and unaffected by the
        # default schema.
        (
            "SELECT * FROM pg_stat_activity",
            "information_schema",
            {"pg_stat_activity"},
            {"pg_stat_activity"},
        ),
        # The default schema is forwarded to every statement in a script, so an
        # unqualified reference in a later statement is resolved too.
        (
            "SELECT * FROM my_table; SELECT * FROM tables",
            "information_schema",
            {"information_schema.tables"},
            {"information_schema.tables"},
        ),
    ],
)
def test_get_disallowed_tables_default_schema(
    sql: str,
    default_schema: str | None,
    denylist: set[str],
    expected: set[str],
) -> None:
    """
    `get_disallowed_tables` resolves an unqualified reference against the
    supplied default schema, so a denylisted system view (e.g.
    `information_schema.tables`) is still caught when reached without an
    explicit schema under that search_path, without blocking a same-named
    user table under a different schema.
    """
    assert (
        SQLScript(sql, "postgresql").get_disallowed_tables(denylist, default_schema)
        == expected
    )


@pytest.mark.parametrize(
    "sql, default_schema, denylist, expected",
    [
        # `SET search_path` rebinds where an unqualified reference resolves, so
        # the static default schema can no longer be trusted. A qualified
        # denylist entry must still match the later unqualified reference,
        # otherwise the block is trivially bypassable.
        (
            "SET search_path = information_schema; SELECT * FROM tables",
            "public",
            {"information_schema.tables"},
            {"information_schema.tables"},
        ),
        # `SET search_path TO "$user", ...` falls back to an exp.Command (it is
        # not a structured exp.Set), exercising the same conservative matching
        # via the command-name detection branch.
        (
            'SET search_path TO "$user", information_schema; SELECT * FROM tables',
            "public",
            {"information_schema.tables"},
            {"information_schema.tables"},
        ),
        # `set_config('search_path', ...)` rebinds the search path through a
        # function call and must trigger the same conservative matching.
        (
            "SELECT set_config('search_path', 'information_schema', true);"
            " SELECT * FROM tables",
            "public",
            {"information_schema.tables"},
            {"information_schema.tables"},
        ),
        # The search-path change only affects later statements: a statement that
        # runs before it keeps resolving against the original default schema, so
        # its unqualified reference must NOT be widened.
        (
            "SELECT * FROM tables; SET search_path = information_schema",
            "public",
            {"information_schema.tables"},
            set(),
        ),
        # An explicitly qualified reference is unambiguous and must NOT be
        # widened to match a different schema's denylist entry.
        (
            "SET search_path = information_schema; SELECT * FROM public.tables",
            "public",
            {"information_schema.tables"},
            set(),
        ),
        # Without a search_path change, matching is unchanged: an unqualified
        # reference under a user schema does not match the qualified entry.
        (
            "SELECT * FROM tables",
            "public",
            {"information_schema.tables"},
            set(),
        ),
    ],
)
def test_get_disallowed_tables_search_path_change(
    sql: str,
    default_schema: str | None,
    denylist: set[str],
    expected: set[str],
) -> None:
    """
    A `SET search_path` in the script makes unqualified references resolve to a
    schema other than the caller's default, so `get_disallowed_tables` matches
    them against schema-qualified entries too, closing a denylist bypass.
    """
    assert (
        SQLScript(sql, "postgresql").get_disallowed_tables(denylist, default_schema)
        == expected
    )


@pytest.mark.parametrize(
    "sql, expected",
    [
        # Structured `SET search_path` (exp.Set), surfaced via get_settings().
        ("SET search_path = information_schema", True),
        # Exotic form that falls back to exp.Command; the leading setting name
        # is `search_path`.
        ('SET search_path TO "$user", public', True),
        # `SET SESSION ...` can also fall back to exp.Command; the optional
        # SESSION/LOCAL qualifier is skipped before matching the setting name.
        ("SET SESSION search_path FROM CURRENT", True),
        # A quoted identifier is equivalent to the unquoted form in Postgres,
        # so it must be recognized too (both the exp.Set and exp.Command forms).
        ('SET "search_path" = information_schema', True),
        ('SET "search_path" TO "$user", public', True),
        # A `SET` whose value merely contains the substring `search_path` must
        # not be misclassified (the setting being changed is `ROLE`).
        ("SET ROLE app_search_path_user", False),
        # `set_config('search_path', ...)` rebinds the path via a function call.
        ("SELECT set_config('search_path', 'information_schema', true)", True),
        # A different setting changed through `set_config` is not a search-path
        # change.
        ("SELECT set_config('statement_timeout', '0', true)", False),
        # An unrelated (non-`set_config`) function call is not a change either.
        ("SELECT my_custom_func(1)", False),
        ("SELECT 1", False),
    ],
)
def test_changes_search_path(sql: str, expected: bool) -> None:
    """
    `changes_search_path` detects search-path rebinds (via `SET` or
    `set_config`) without misclassifying unrelated `SET` statements.
    """
    assert SQLStatement(sql, "postgresql").changes_search_path() == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        # `USE` rebinds the schema for every later statement on the cursor.
        ("USE tenant_b; SELECT * FROM orders", "mysql", True),
        ("use `tenant_b`", "mysql", True),
        ("USE SCHEMA tenant_b", "snowflake", True),
        # Warehouse selection changes compute, not name resolution.
        ("USE WAREHOUSE compute_wh", "snowflake", False),
        # Search-path changes are schema rebinds too.
        ("SET search_path = tenant_b", "postgresql", True),
        (
            "SELECT set_config('search_path', 'tenant_b', false)",
            "postgresql",
            True,
        ),
        # A `set_config()` with a computed setting name fails closed.
        (
            "SELECT set_config('search' || '_path', 'tenant_b', false)",
            "postgresql",
            True,
        ),
        # `SET SCHEMA` is an alias for a search-path rebind on Postgres and
        # a schema rebind on DB2-family engines.
        ("SET SCHEMA 'tenant_b'", "postgresql", True),
        ("SELECT * FROM orders", "mysql", False),
        ("SET statement_timeout = 10", "postgresql", False),
        # A structured `SET current_schema = ...` rebinds resolution through
        # a setting rather than a search path.
        ("SET current_schema = foo", "postgresql", True),
        # `SET CATALOG`/`SET SCHEMA` that fall back to an opaque command are
        # schema rebinds, including the `CURRENT` spelling; an unrelated `SET`
        # command (e.g. `SET ROLE`) is not.
        ("SET CATALOG tenant_b", "postgresql", True),
        ("SET CURRENT SCHEMA foo", "postgresql", True),
        ("SET ROLE admin", "postgresql", False),
        # A `set_config()` whose setting name is a column reference rather than
        # a literal is treated conservatively as a schema change.
        ("SELECT set_config(schema_col, 'tenant_b', false)", "postgresql", True),
        # Engines without a sqlglot AST (e.g. Kusto KQL) do not rebind schema
        # resolution through these forms.
        ("print x = 1", "kustokql", False),
    ],
)
def test_changes_default_schema(sql: str, engine: str, expected: bool) -> None:
    """
    `changes_default_schema` detects statements that rebind unqualified-name
    resolution (`USE`, `SET SCHEMA`, search-path changes) so the SQL Lab
    authorization path can reject the script before qualifying tables with
    the schema the user selected.
    """
    assert SQLScript(sql, engine).changes_default_schema() == expected


@pytest.mark.parametrize(
    "sql, denylist, expected",
    [
        ("SELECT * FROM pg_stat_activity", {"pg_stat_activity"}, True),
        ("SELECT * FROM my_table", {"pg_stat_activity"}, False),
    ],
)
def test_statement_check_tables_present(
    sql: str, denylist: set[str], expected: bool
) -> None:
    """
    `SQLStatement.check_tables_present` is the per-statement entry point that
    `SQLScript` no longer routes through (it calls `get_disallowed_tables`
    directly), so exercise it on its own to keep the override covered.
    """
    assert SQLStatement(sql, "postgresql").check_tables_present(denylist) == expected


def test_kustokql_statement_check_tables_present() -> None:
    """
    `KustoKQLStatement.check_tables_present` is unsupported and always reports
    False; exercise it directly so the override stays covered.
    """
    statement = KustoKQLStatement("foo | take 100", "kustokql")
    assert statement.check_tables_present({"foo"}) is False


@pytest.mark.parametrize(
    "kql, expected",
    [
        (
            "StormEvents | take 10",
            [
                (KQLTokenType.WORD, "StormEvents"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "take"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.NUMBER, "10"),
            ],
        ),
        ("'test'", [(KQLTokenType.STRING, "'test'")]),
        ("```test```", [(KQLTokenType.STRING, "```test```")]),
        # Double-quoted strings
        ('"hello"', [(KQLTokenType.STRING, '"hello"')]),
        # Single-quoted string with escaped quote
        (
            "'it\\'s a test'",
            [(KQLTokenType.STRING, "'it\\'s a test'")],
        ),
        # Double-quoted string with escaped quote
        (
            '"say \\"hi\\""',
            [(KQLTokenType.STRING, '"say \\"hi\\""')],
        ),
        # Semicolon token
        (
            "a; b",
            [
                (KQLTokenType.WORD, "a"),
                (KQLTokenType.SEMICOLON, ";"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "b"),
            ],
        ),
        # Semicolon inside string is not a SEMICOLON token
        (
            "'a;b'",
            [(KQLTokenType.STRING, "'a;b'")],
        ),
        # Numbers
        (
            "42",
            [(KQLTokenType.NUMBER, "42")],
        ),
        # Other/punctuation tokens
        (
            "()",
            [
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.OTHER, ")"),
            ],
        ),
        # Empty input
        ("", []),
        # ARRAY bracket pattern used in Kusto engine spec
        (
            'ARRAY(["age"])',
            [
                (KQLTokenType.WORD, "ARRAY"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.OTHER, "["),
                (KQLTokenType.STRING, '"age"'),
                (KQLTokenType.OTHER, "]"),
                (KQLTokenType.OTHER, ")"),
            ],
        ),
        # Mixed identifiers, operators, and strings
        (
            "tbl | where name == 'Alice' | take 5",
            [
                (KQLTokenType.WORD, "tbl"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "where"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "name"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "="),
                (KQLTokenType.OTHER, "="),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.STRING, "'Alice'"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "take"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.NUMBER, "5"),
            ],
        ),
        # Underscore in identifiers
        (
            "my_table",
            [(KQLTokenType.WORD, "my_table")],
        ),
        # Identifiers starting with underscore
        (
            "_col1",
            [(KQLTokenType.WORD, "_col1")],
        ),
        # Multiline string with semicolons and quotes
        (
            "```select 'x'; drop```",
            [(KQLTokenType.STRING, "```select 'x'; drop```")],
        ),
        # Adjacent strings without whitespace
        (
            "'a''b'",
            [
                (KQLTokenType.STRING, "'a'"),
                (KQLTokenType.STRING, "'b'"),
            ],
        ),
        # Dot operator
        (
            "db.table",
            [
                (KQLTokenType.WORD, "db"),
                (KQLTokenType.OTHER, "."),
                (KQLTokenType.WORD, "table"),
            ],
        ),
        # Bracket-quoted identifier (KQL style)
        (
            '["column name"]',
            [
                (KQLTokenType.OTHER, "["),
                (KQLTokenType.STRING, '"column name"'),
                (KQLTokenType.OTHER, "]"),
            ],
        ),
        # Whitespace variants (tab, newline)
        (
            "a\t\nb",
            [
                (KQLTokenType.WORD, "a"),
                (KQLTokenType.WHITESPACE, "\t\n"),
                (KQLTokenType.WORD, "b"),
            ],
        ),
        # Summarize with count aggregation
        (
            "T | summarize count() by State",
            [
                (KQLTokenType.WORD, "T"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "summarize"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "count"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.OTHER, ")"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "by"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "State"),
            ],
        ),
        # Aliased aggregation with avg
        (
            "T | summarize avg_val = avg(price) by category",
            [
                (KQLTokenType.WORD, "T"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "summarize"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "avg_val"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "="),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "avg"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.WORD, "price"),
                (KQLTokenType.OTHER, ")"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "by"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "category"),
            ],
        ),
        # Multiple aggregations with dcount
        (
            "T | summarize cnt = count(), uniq = dcount(user_id)",
            [
                (KQLTokenType.WORD, "T"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "summarize"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "cnt"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "="),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "count"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.OTHER, ")"),
                (KQLTokenType.OTHER, ","),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "uniq"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "="),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "dcount"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.WORD, "user_id"),
                (KQLTokenType.OTHER, ")"),
            ],
        ),
        # Summarize with bin time bucketing
        (
            "T | summarize count() by bin(ts, 1h)",
            [
                (KQLTokenType.WORD, "T"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "summarize"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "count"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.OTHER, ")"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "by"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "bin"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.WORD, "ts"),
                (KQLTokenType.OTHER, ","),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.NUMBER, "1"),
                (KQLTokenType.WORD, "h"),
                (KQLTokenType.OTHER, ")"),
            ],
        ),
        (
            "T | summarize dcountif(user_id, status == 'active') by region",
            [
                (KQLTokenType.WORD, "T"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "summarize"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "dcountif"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.WORD, "user_id"),
                (KQLTokenType.OTHER, ","),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "status"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "="),
                (KQLTokenType.OTHER, "="),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.STRING, "'active'"),
                (KQLTokenType.OTHER, ")"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "by"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "region"),
            ],
        ),
        (
            "T | project tostring(value)",
            [
                (KQLTokenType.WORD, "T"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.OTHER, "|"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "project"),
                (KQLTokenType.WHITESPACE, " "),
                (KQLTokenType.WORD, "tostring"),
                (KQLTokenType.OTHER, "("),
                (KQLTokenType.WORD, "value"),
                (KQLTokenType.OTHER, ")"),
            ],
        ),
    ],
)
def test_tokenize_kql(kql: str, expected: list[tuple[KQLTokenType, str]]) -> None:
    """
    Test the `tokenize_kql` function.
    """
    assert tokenize_kql(kql) == expected


@pytest.mark.parametrize(
    "sql, engine, expected",
    [
        ("a = 1", "postgresql", False),
        ("(SELECT * FROM table)", "postgresql", True),
        ("SELECT * FROM table", "postgresql", False),
        ("SELECT * FROM (SELECT 1)", "postgresql", True),
        ("SELECT * FROM (SELECT 1) AS subquery", "postgresql", True),
        ("WITH cte AS (SELECT 1) SELECT * FROM cte", "postgresql", True),
        ("SELECT * FROM table WHERE EXISTS (SELECT 1)", "postgresql", True),
        ("SELECT * FROM table WHERE NOT EXISTS (SELECT 1)", "postgresql", True),
        (
            "SELECT * FROM table WHERE id IN (SELECT id FROM other_table)",
            "postgresql",
            True,
        ),
        # Set operations: a top-level UNION/INTERSECT/EXCEPT is not an
        # exp.Subquery, so it must be detected explicitly. A predicate fragment
        # that introduces one (e.g. supplied through a chart filter) must be
        # flagged.
        ("true UNION SELECT name FROM other_table", "postgresql", True),
        ("1 = 1 UNION ALL SELECT password FROM users", "postgresql", True),
        ("SELECT 1 INTERSECT SELECT 2", "postgresql", True),
        ("SELECT 1 EXCEPT SELECT 2", "postgresql", True),
        # Nested SELECT under non-Select top-level nodes (e.g. extra
        # parentheses) must still be detected.
        ("name IN (((SELECT secret FROM s)))", "postgresql", True),
    ],
)
def test_has_subquery(sql: str, engine: str, expected: bool) -> None:
    """
    Test the `has_subquery` method.
    """
    assert SQLStatement(sql, engine).has_subquery() == expected


@pytest.mark.parametrize(
    "sql, engine",
    [
        # Double-quoted identifiers (#32684 — postgres dataset)
        ('"Adresse E-mail"', "postgresql"),
        ('"Nom de structure"', "postgresql"),
        # Backtick-quoted identifiers (#32541 — mysql view)
        ("`Answer Created Time`", "mysql"),
        ("`Correction Time`", "mysql"),
        # Diacritics, slash, and dot — listed as "working" in #32684 but
        # easily broken by overzealous parser changes; pin them too.
        ('"Appartement / étage"', "postgresql"),
        ('"Bâtiment / Résidence"', "postgresql"),
        ('"C.Postal"', "postgresql"),
    ],
)
def test_quoted_column_name_with_spaces_is_not_subquery(sql: str, engine: str) -> None:
    r"""
    Regression for #32541 and #32684: a quoted identifier that happens to
    contain spaces (or a slash, accents, dots) must not be misclassified
    as a subquery.

    The original symptom was an opaque ``Custom SQL fields cannot contain
    sub-queries.`` error when the user added a column like ``"Adresse
    E-mail"`` (Postgres) or a backtick-quoted equivalent (MySQL) to a
    chart. Snake-case aliases worked; multi-word display names did not.
    The check that raises that error is
    ``parsed_statement.has_subquery()`` in
    ``superset/models/helpers.py:206``.
    """
    assert not SQLStatement(sql, engine).has_subquery(), (
        f"Quoted identifier {sql!r} on {engine!r} was misclassified as a "
        "subquery — would block the column from being used in any chart."
    )


@pytest.mark.parametrize(
    "sql, engine, expected_tables",
    [
        # Issue #31853: Backtick-quoted table names with "Other" database type
        (
            "SELECT * FROM database.`6`",
            "base",
            {Table(table="6", schema="database")},
        ),
        (
            "SELECT * FROM database.`6` LIMIT 100",
            "base",
            {Table(table="6", schema="database")},
        ),
        # Backtick-quoted table name without schema
        (
            "SELECT * FROM `my_table`",
            "base",
            {Table(table="my_table")},
        ),
        # Backtick-quoted schema and table
        (
            "SELECT * FROM `my_schema`.`my_table`",
            "base",
            {Table(table="my_table", schema="my_schema")},
        ),
        # Complex query with multiple backtick-quoted identifiers
        (
            "SELECT `col1`, `col2` FROM `schema`.`table` WHERE `id` = 1",
            "base",
            {Table(table="table", schema="schema")},
        ),
        # Unknown engine should also fall back
        (
            "SELECT * FROM `table_name`",
            "unknown-engine",
            {Table(table="table_name")},
        ),
        # Multiple tables with backticks
        (
            "SELECT * FROM `t1` JOIN `t2` ON `t1`.id = `t2`.id",
            "base",
            {Table(table="t1"), Table(table="t2")},
        ),
        # Backticks in subquery
        (
            "SELECT * FROM (SELECT * FROM `inner_table`) AS sub",
            "base",
            {Table(table="inner_table")},
        ),
    ],
)
def test_backtick_quoted_identifiers_base_dialect(
    sql: str, engine: str, expected_tables: set[Table]
) -> None:
    """
    Test that backtick-quoted identifiers work with base dialect.

    This is a regression test for issue #31853 where SQL parsing fails
    with "Other" database type when using backtick-quoted table names.
    The fix adds a fallback to MySQL dialect when parsing fails with
    base dialect and backticks are present in the SQL.
    """
    script = SQLScript(sql, engine)
    assert len(script.statements) == 1
    assert script.statements[0].tables == expected_tables


def test_backtick_normal_sql_still_works() -> None:
    """
    Test that normal SQL without backticks still works with base dialect.

    This ensures the backtick fallback doesn't break normal parsing.
    """
    sql = "SELECT col1, col2 FROM my_schema.my_table WHERE id = 1"
    script = SQLScript(sql, "base")
    assert len(script.statements) == 1
    assert script.statements[0].tables == {Table(table="my_table", schema="my_schema")}


def test_backtick_invalid_sql_still_fails() -> None:
    """
    Test that invalid SQL with backticks still raises an error.

    The fallback should only succeed when the MySQL dialect can parse
    the SQL successfully.
    """
    # Invalid SQL that should fail even with MySQL dialect
    sql = "SELECT * FROM `table` WHERE"
    with pytest.raises(SupersetParseError):
        SQLScript(sql, "base")


def test_base_sql_statement_is_destructive_raises_not_implemented() -> None:
    """
    BaseSQLStatement.is_destructive is abstract; both concrete subclasses
    (SQLStatement and KustoKQLStatement) override it, so calling the base
    implementation directly must raise. This exercises the abstract stub
    so it stays exercised under coverage.
    """
    with pytest.raises(NotImplementedError):
        BaseSQLStatement.is_destructive(object())  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# SQL_MAX_PARSE_LENGTH gate
# ---------------------------------------------------------------------------


@pytest.fixture
def _small_parse_cap(mocker: MockerFixture) -> None:
    """
    Pin the parse-length cap to 100 bytes and force the no-app-context
    fallback path so tests are decoupled from the suite's Flask config.
    """
    mocker.patch("superset.config.SQL_MAX_PARSE_LENGTH", 100)
    mocker.patch("superset.sql.parse.has_app_context", return_value=False)


@pytest.mark.usefixtures("_small_parse_cap")
def test_check_script_length_accepts_at_boundary() -> None:
    """A script exactly at the configured cap is accepted."""
    _check_script_length("a" * 100, "postgresql")


@pytest.mark.usefixtures("_small_parse_cap")
def test_check_script_length_rejects_one_over() -> None:
    """One byte above the cap is rejected before sqlglot runs."""
    with pytest.raises(SupersetParseError) as excinfo:
        _check_script_length("a" * 101, "postgresql")
    assert "exceeds the configured maximum" in str(excinfo.value)


def test_check_script_length_counts_utf8_bytes(mocker: MockerFixture) -> None:
    """
    The cap is in UTF-8 bytes, not code points. A multi-byte char string
    whose char-count is under the cap but byte-count is over must reject.
    """
    mocker.patch("superset.config.SQL_MAX_PARSE_LENGTH", 30)
    mocker.patch("superset.sql.parse.has_app_context", return_value=False)
    # 20 emoji = 20 code points (under the 30-byte cap) but 80 UTF-8 bytes (over)
    payload = "\U0001f600" * 20
    with pytest.raises(SupersetParseError):
        _check_script_length(payload, "postgresql")


def test_check_script_length_disabled_when_config_none(
    mocker: MockerFixture,
) -> None:
    """Setting SQL_MAX_PARSE_LENGTH=None disables the check entirely."""
    fake_app = mocker.MagicMock()
    fake_app.config = {"SQL_MAX_PARSE_LENGTH": None}
    mocker.patch("superset.sql.parse.has_app_context", return_value=True)
    mocker.patch("superset.sql.parse.current_app", fake_app)
    _check_script_length("a" * 10_000_000, "postgresql")


def test_check_script_length_uses_app_config_when_present(
    mocker: MockerFixture,
) -> None:
    """When an app context is active, the runtime config value wins."""
    fake_app = mocker.MagicMock()
    fake_app.config = {"SQL_MAX_PARSE_LENGTH": 50}
    mocker.patch("superset.sql.parse.has_app_context", return_value=True)
    mocker.patch("superset.sql.parse.current_app", fake_app)
    with pytest.raises(SupersetParseError):
        _check_script_length("a" * 51, "postgresql")


@pytest.mark.usefixtures("_small_parse_cap")
def test_sqlscript_gate_short_circuits_before_sqlglot(
    mocker: MockerFixture,
) -> None:
    """
    SQLScript construction must reject an over-cap script before any call
    to sqlglot.parse, including the MySQL-backtick fallback path. Captures
    the original behaviour the PR is closing: the previous code parsed
    twice on backtick failures, so the cap MUST short-circuit both.
    """
    spy = mocker.spy(sqlglot, "parse")
    over_cap_with_backtick = "SELECT * FROM `t` -- " + "x" * 200
    with pytest.raises(SupersetParseError):
        SQLScript(over_cap_with_backtick, "base")
    assert spy.call_count == 0, "length gate failed to short-circuit sqlglot.parse"


@pytest.mark.usefixtures("_small_parse_cap")
def test_parse_predicate_length_check() -> None:
    """SQLStatement.parse_predicate also goes through the length gate."""
    stmt = SQLStatement("SELECT 1", "postgresql")
    with pytest.raises(SupersetParseError):
        stmt.parse_predicate("x" * 101)


def test_parse_predicate_invalid_sql_raises_superset_parse_error() -> None:
    """
    A syntactically invalid RLS predicate raises ``SupersetParseError``.

    ``parse_predicate`` is reachable via ``apply_rls`` for any RLS clause
    configured on a queried table; an invalid clause must surface as the
    typed 422 parse error rather than leaking a raw ``sqlglot`` exception.
    """
    stmt = SQLStatement("SELECT 1", "postgresql")
    with pytest.raises(SupersetParseError) as excinfo:
        stmt.parse_predicate("a >")
    assert excinfo.value.status == 422


def test_parse_predicate_sqlglot_error_raises_superset_parse_error(
    mocker: MockerFixture,
) -> None:
    """
    A non-``ParseError`` ``sqlglot`` failure also surfaces as a typed error.

    ``parse_predicate`` catches the generic ``SqlglotError`` base class as a
    fallback so any sqlglot failure (e.g. tokenize errors) is converted into a
    ``SupersetParseError`` rather than leaking a raw sqlglot exception.
    """
    # Build the statement before patching, since the constructor also parses.
    stmt = SQLStatement("SELECT 1", "postgresql")
    mocker.patch(
        "sqlglot.parse_one",
        side_effect=sqlglot.errors.SqlglotError("boom"),
    )
    with pytest.raises(SupersetParseError) as excinfo:
        stmt.parse_predicate("a > 1")
    assert excinfo.value.status == 422


@pytest.mark.usefixtures("_small_parse_cap")
def test_transpile_to_dialect_length_check() -> None:
    """
    The standalone ``transpile_to_dialect`` entry point also gates input.

    The cap-exceeded error surfaces as ``QueryClauseValidationException`` to
    preserve the function's existing error contract (callers such as
    ``transpile_virtual_dataset_sql`` only catch that type and fall back to
    the original SQL). The underlying ``SupersetParseError`` is attached as
    ``__cause__`` so over-cap input is still distinguishable from a generic
    parse failure.
    """
    with pytest.raises(QueryClauseValidationException) as excinfo:
        transpile_to_dialect("x" * 101, target_engine="mysql")
    assert isinstance(excinfo.value.__cause__, SupersetParseError)


def test_backtick_fallback_logs_warning(caplog: pytest.LogCaptureFixture) -> None:
    """
    Test that the MySQL dialect fallback emits a warning log.

    When the base dialect fails to parse SQL containing backticks and the
    parser falls back to the MySQL dialect, the fallback should be observable
    via a warning log.
    """
    sql = "SELECT * FROM `my_table`"
    with caplog.at_level(logging.WARNING, logger="superset.sql.parse"):
        SQLScript(sql, "base")

    assert any(
        record.levelname == "WARNING" and "MySQL dialect" in record.getMessage()
        for record in caplog.records
    )


@pytest.mark.parametrize(
    "expression,expected",
    [
        ("GREATEST(confirmed, predicted)", False),
        ("MAX(GREATEST(a, b))", True),
        ("SUM(x)", True),
        ("COUNT(*)", True),
        ("SUM(x) OVER (PARTITION BY y)", False),
        ("ROW_NUMBER() OVER ()", False),
        ("SUM(SUM(x)) OVER ()", True),
        ("a + b", False),
        (")(", True),
        ("MY_CUSTOM_AGG(x)", True),
        ("a - (SELECT AVG(b) FROM t)", True),
    ],
)
def test_has_aggregate(expression: str, expected: bool) -> None:
    """
    ``has_aggregate`` detects any aggregate that is not itself directly windowed
    -- one nested inside a windowed aggregate or a subquery still counts -- and
    fails open (returns True) when the expression can't be parsed or uses a
    function sqlglot can't model.
    """
    assert has_aggregate(expression) is expected
