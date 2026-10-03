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

import re
from pathlib import Path

import pytest
import sqlglot
from sqlglot import exp
from sqlglot.dialects.postgres import Postgres

from superset.sql.dialects.databend import Databend


def test_databend_dialect_registered() -> None:
    from superset.sql.parse import SQLGLOT_DIALECTS

    assert "databend" in SQLGLOT_DIALECTS
    assert SQLGLOT_DIALECTS["databend"] is Databend


def test_leading_settings_round_trips_unchanged() -> None:
    """
    A leading ``SETTINGS (...)`` timeout wrapper parses to a SELECT and is
    re-emitted verbatim.
    """
    sql = 'SETTINGS (max_execute_time_in_seconds=300) SELECT "col" FROM t'
    ast = sqlglot.parse_one(sql, Databend)

    assert isinstance(ast, exp.Select)
    assert ast.sql(dialect=Databend) == sql
    assert [table.name for table in ast.find_all(exp.Table)] == ["t"]


def test_leading_settings_multiple_values() -> None:
    sql = "SETTINGS (a=1, b=2) SELECT 1"
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


@pytest.mark.parametrize(
    "sql",
    [
        "SETTINGS (a=1) SELECT 1 UNION ALL SELECT 2",
        "SETTINGS (a=1) SELECT * FROM (SELECT id FROM u) AS sub",
        "SETTINGS (a=1) WITH s AS (SELECT 1 AS one) SELECT * FROM s",
    ],
)
def test_leading_settings_preserved_across_root_types(sql: str) -> None:
    """
    The wrapper must survive generation whatever the statement root is — not
    only a bare SELECT. A UNION or a parenthesized subquery is re-emitted from
    a generator hook other than ``select_sql``; emitting the settings only in
    ``select_sql`` silently dropped the timeout guard on those.
    """
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT sample FROM t",
        "SELECT a FROM sample",
        "SELECT global FROM t",
        "SELECT prewhere FROM t",
        "SELECT sample, global, prewhere FROM t",
    ],
)
def test_clickhouse_reserved_words_stay_valid_identifiers(sql: str) -> None:
    """
    GLOBAL / SAMPLE / PREWHERE are ClickHouse reserved words, but Databend accepts
    them as identifiers. The Postgres base does too, so this no longer needs an
    ``ID_VAR_TOKENS`` override — the assertion stays as a regression guard, because
    a dataset whose column is named after one of them going unparseable is the very
    "unqueryable virtual dataset" failure this dialect exists to prevent.
    """
    assert sqlglot.parse_one(sql, Databend) is not None


def test_union_operator_still_parses() -> None:
    """Restoring the reserved words above must not disturb the UNION operator."""
    assert isinstance(
        sqlglot.parse_one("SELECT 1 UNION ALL SELECT 2", Databend), exp.Union
    )


def test_bare_leading_settings_keyword_is_not_special_cased() -> None:
    """
    Only the parenthesized ``SETTINGS (...)`` wrapper is absorbed. A bare leading
    ``SETTINGS`` keyword with no parentheses is retreated and left to the base
    parser, which rejects it — this exercises the non-wrapper retreat path.
    """
    import sqlglot.errors

    with pytest.raises(sqlglot.errors.ParseError):
        sqlglot.parse_one("SETTINGS SELECT 1", Databend)


def test_leading_settings_via_sqlscript_is_select() -> None:
    from superset.sql.parse import SQLScript

    sql = "SETTINGS (max_execute_time_in_seconds=300) SELECT col FROM t"
    script = SQLScript(sql, "databend")

    assert len(script.statements) == 1
    assert not script.has_mutation()


def test_leading_settings_survives_rls_regeneration() -> None:
    """
    User-visible path: when RLS is applied, virtual-dataset SQL is re-emitted
    via ``SQLStatement.format`` (``superset/models/helpers.py``). The leading
    ``SETTINGS`` must not be dropped there — for a UNION dataset too.
    """
    from superset.sql.parse import SQLStatement

    sql = "SETTINGS (max_execute_time_in_seconds=300) SELECT 1 UNION ALL SELECT 2"
    assert (
        SQLStatement(sql, "databend")
        .format()
        .startswith("SETTINGS (max_execute_time_in_seconds=300)")
    )


def test_leading_settings_transparent_to_table_extraction() -> None:
    """RLS depends on table extraction; the wrapper must not perturb it."""
    from superset.sql.parse import SQLStatement

    wrapped = SQLStatement("SETTINGS (a=1) SELECT c FROM myschema.t", "databend")
    plain = SQLStatement("SELECT c FROM myschema.t", "databend")
    extracted = {str(table) for table in wrapped.tables}
    assert extracted == {str(table) for table in plain.tables} == {"myschema.t"}


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT 1",
        "SELECT a, b FROM t WHERE c > 1",
        'SELECT COUNT(*) FROM "events" WHERE "type" = \'click\'',
        "SELECT * FROM t SETTINGS max_threads = 1",
        "SELECT `col` FROM `tbl`",
        "SELECT * FROM a JOIN b ON a.id = b.id",
        "SELECT DISTINCT x FROM t",
        "SELECT x FROM t GROUP BY x HAVING COUNT(*) > 1",
        "SELECT x FROM t ORDER BY x DESC LIMIT 10",
        "WITH source AS (SELECT 1 AS one) SELECT * FROM source",
        "SELECT * FROM (SELECT id FROM u) AS sub",
        "SELECT CAST(a AS String) FROM t",
        "INSERT INTO t VALUES (1)",
        "ALTER TABLE foo ADD COLUMN bar INT",
        "SELECT * FROM t WHERE name = 'O''Hara'",
    ],
)
def test_no_regression_on_known_good_statements(sql: str) -> None:
    """Statements that already parse under the generic dialect still parse."""
    assert sqlglot.parse_one(sql, Databend) is not None


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT DATE_FORMAT(\"d\", '%m/%d')",
        "SELECT DATE_FORMAT(DATE_TRUNC('week', \"d\"), '%m/%d')",
        (
            "SELECT CONCAT(DATE_FORMAT(DATE_TRUNC('week', \"d\"), '%m/%d'), ' - ', "
            "DATE_FORMAT(DATE_TRUNC('week', \"d\") + INTERVAL '6' DAY, '%m/%d'))"
        ),
    ],
)
def test_date_format_is_not_rewritten_to_format_date_time(sql: str) -> None:
    """
    ClickHouse renders ``exp.TimeToStr`` as ``formatDateTime``, which Databend
    rejects outright: "no function matches the given name: 'formatdatetime', do
    you mean 'date_format'?". Inheriting that generation silently rewrote every
    chart's ``DATE_FORMAT`` on the way to the server, breaking each one.
    """
    generated = sqlglot.parse_one(sql, Databend).sql(dialect=Databend)

    assert "formatDateTime" not in generated
    assert "DATE_FORMAT(" in generated


def test_format_date_time_is_normalised_to_date_format() -> None:
    """
    An expression saved with the ClickHouse spelling — from a chart authored while
    that rewrite was in effect — is healed on generation rather than passed through
    to a server that does not accept it. Under the ClickHouse base this fell out of
    the shared parse node; the Postgres base has no such node, so the dialect maps
    ``formatDateTime`` explicitly. Both spellings take the same ``%``-style format
    string, so it carries across untouched.
    """
    parsed = sqlglot.parse_one("SELECT formatDateTime(\"d\", '%m/%d')", Databend)
    generated = parsed.sql(dialect=Databend)

    assert generated == "SELECT DATE_FORMAT(\"d\", '%m/%d')"


def test_date_format_generation_is_idempotent() -> None:
    """Superset regenerates on every compile; the output must be a fixed point."""
    once = sqlglot.parse_one(
        "SELECT DATE_FORMAT(DATE_TRUNC('week', \"d\"), '%m/%d')", Databend
    ).sql(dialect=Databend)

    assert sqlglot.parse_one(once, Databend).sql(dialect=Databend) == once


def test_date_format_survives_adhoc_column_sanitisation() -> None:
    """
    User-visible path: ``_process_sql_expression`` in ``superset/models/helpers``
    puts every adhoc column and metric through ``sanitize_clause``, which parses
    and *regenerates* the clause in the engine's dialect. That is where a chart's
    stored ``DATE_FORMAT`` was turned into SQL Databend refuses.
    """
    from superset.sql.parse import sanitize_clause

    sanitized = sanitize_clause(
        "DATE_FORMAT(DATE_TRUNC('week', \"d\"), '%m/%d')", "databend"
    )

    assert "formatDateTime" not in sanitized
    assert sanitized.startswith("DATE_FORMAT(")


DATABEND_FUNCTION_CATALOGUE = {
    line.strip().lower()
    for line in (
        Path(__file__)
        .with_name("databend_function_catalogue.txt")
        .read_text()
        .splitlines()
    )
    if line.strip() and not line.startswith("#")
}

# Names the server resolves that SHOW FUNCTIONS does not list. The catalogue is a
# sound positive oracle and an unsound negative one, so this is where the negative
# direction gets corrected -- each entry run against Databend Query v1.2.790
# before being added. COUNT_IF is the reason the set exists: reading its absence
# as proof led to it being rewritten into a SUM(CASE ...) that answers NULL where
# COUNT_IF answers 0.
VERIFIED_PRESENT_BUT_UNLISTED = {
    "array_apply",
    "array_filter",
    "count_if",
}

# Calls ClickHouse parses without checking and Databend rejects outright, so a
# raise here is correct rather than a regression. ClickHouse renders an unknown
# or over-supplied call as an anonymous pass-through where Postgres validates the
# signature, which is the whole source of this list; it is not a judgement about
# what Databend supports. Each was run against the server:
#     md5('a','b')     -> no function matches signature `md5(String, String)`
#     date_part(NOW()) -> unexpected `NOW`, expecting DOW, ISOWEEK, ...
#     now(1, 2, 3)     -> no function matches signature `now(UInt8, UInt8, UInt8)`
# AND, OR and XOR are operators there, as DIV and RLIKE are, and are not
# callable: xor(1) answers "missing lhs or rhs for the binary operator".
CLICKHOUSE_ACCEPTS_UNVALIDATED = {
    "and",
    "date_part",
    "extract",
    "json_agg",
    "md5",
    "now",
    "or",
    "xor",
}

# SQL keywords and operator forms that are valid Databend syntax without being
# catalogue entries. POSITION is deliberately absent: Databend accepts
# ``POSITION(x IN y)`` but rejects ``POSITION(x, y)``, so it is checked by form.
SYNTAX_NOT_IN_CATALOGUE = {
    "case",
    "select",
    "in",
}

# Rewrites that still emit something Databend lacks, knowingly left alone: these
# are Snowflake/T-SQL/BigQuery spellings or sqlglot's own canonical names
# (``J_S_O_N_TABLE``, ``S_H_A2_DIGEST``), not things anyone writes in a Superset
# adhoc metric against Databend, and several have no Databend equivalent to map
# onto. Listed rather than silenced so a reviewer can see the whole residue.
KNOWN_UNSUPPORTED = {
    "APPLY",
    "APPROXIMATE_JACCARD_INDEX",
    "A_I_FORECAST",
    "COLUMNS",
    "CONVERT_TO_CHARSET",
    "DATEFROMPARTS",
    "DIV",
    "DYNAMIC_IDENTIFIER",
    "ENDSWITH",
    "EXPLODING_GENERATE_SERIES",
    "FARMFINGERPRINT64",
    "GETBIT",
    "ISINF",
    "ISNAN",
    "ISODOW",
    "IS_ASCII",
    "J_S_O_N_B_OBJECT_AGG",
    "J_S_O_N_EXISTS",
    "J_S_O_N_TABLE",
    "M_L_FORECAST",
    "NEXT_VALUE_FOR",
    "OPEN_J_S_O_N",
    "SPLIT_BY_STRING",
    "STARTSWITH",
    "S_H_A2_DIGEST",
    "TIMEFROMPARTS",
    "TIMESTAMPFROMPARTS",
    "TIMESTAMPLTZFROMPARTS",
    "TIMESTAMPTZFROMPARTS",
    "TIMESTAMP_FROM_PARTS",
    "TIME_FROM_PARTS",
    "UNIX_SECONDS",
    "UTC_TIME",
    "X_M_L_TABLE",
    "YEAROFWEEK",
    "YEAROFWEEKISO",
}

# Postgres renders some rewrites as infix operators rather than calls, which a
# catalogue lookup cannot see. Only spellings Databend has no form of are listed:
# its parser rejects "~", "~*" and ILIKE outright, while the JSON operators
# Postgres also emits (-> ->> #> #>> @> <@ @? @@ #- ? ?| ?&) are all accepted --
# @> means JSON rather than array containment there, which is a semantic
# difference this test is not able to judge.
#
# "~" and "~*" are load-bearing: deleting either regex override turns this sweep
# red. ILIKE is not, and cannot be, because the sweep's population is
# Parser.FUNCTIONS and ILIKE arrives as an operator rather than a call -- it is
# here as a statement of what must never be emitted, with its own test carrying
# the override. Said plainly so the next reader does not mistake it for cover it
# is not giving.
_OPERATORS_DATABEND_LACKS = re.compile(
    r"(?<![<>!])(~\*|~)(?!=)|\bILIKE\b", re.IGNORECASE
)

_CALL = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(")
_POSITION_IN = re.compile(r"POSITION\s*\([^()]*\sIN\s", re.IGNORECASE)


def _names_databend_lacks(sql: str) -> list[str]:
    """
    Spellings in ``sql`` that Databend has no name or syntax for.

    Function calls are checked against the catalogue. Operators are checked
    against a short list instead, because a rewrite does not have to land on a
    function call at all -- Postgres renders several of these as infix operators,
    and a catalogue lookup never sees them.
    """
    unknown = []
    for match in _CALL.finditer(sql):
        name = match.group(1).lower()
        if name == "position":
            if not _POSITION_IN.match(sql[match.start() :]):
                unknown.append(match.group(1))
        elif (
            name not in DATABEND_FUNCTION_CATALOGUE
            and name not in VERIFIED_PRESENT_BUT_UNLISTED
            and name not in SYNTAX_NOT_IN_CATALOGUE
        ):
            unknown.append(match.group(1))

    unknown.extend(_OPERATORS_DATABEND_LACKS.findall(sql))
    return unknown


ARITIES = ("x", "x, y", "x, y, z")


def _round_trips(function_name: str) -> list[tuple[str, str]]:
    """
    Every arity of ``function_name`` that parses, with what it regenerates to.

    All of them, not the first that parses: ``DATE_DIFF(x, y)`` parses and
    ``DATE_DIFF(x, y, z)`` is the form Databend actually uses, so stopping at the
    first success hides whatever the three-argument call does.
    """
    results = []
    for args in ARITIES:
        try:
            generated = sqlglot.transpile(
                f"SELECT {function_name}({args})", read=Databend, write=Databend
            )[0]
        except Exception:  # noqa: BLE001, S112 - wrong arity, try the next one
            continue
        results.append((args, generated[len("SELECT ") :]))
    return results


def _raises_where_clickhouse_did_not(function_name: str, args: str) -> bool:
    """
    Whether this dialect refuses a call the ClickHouse base accepted.

    Swallowing the exception is what let ``to_char(x)`` and ``bit_and(a, b)``
    through: both parsed before the re-base and raise now, and a sweep that skips
    anything which fails to parse cannot see the failure the module docstring
    calls the worse of the two, because it happens inside ``sanitize_clause``
    rather than at the server.

    A raise on its own means nothing -- most names refuse most arities -- so it
    only counts when the dialect being replaced was happy with the same call.
    """
    statement = f"SELECT {function_name}({args})"
    try:
        sqlglot.transpile(statement, read=Databend, write=Databend)
    except Exception:  # noqa: BLE001, S110 - the raise is the measurement
        pass
    else:
        return False

    try:
        sqlglot.transpile(statement, read="clickhouse", write="clickhouse")
    except Exception:  # noqa: BLE001 - both refuse it, so it is not a regression
        return False

    return True


def _is_rewrite(function_name: str, generated: str) -> bool:
    return generated.split("(")[0].strip().upper() != function_name.upper()


def _call_arguments(generated: str) -> list[str] | None:
    """The top-level argument list of ``generated``, or None if it is not one call."""
    open_paren = generated.find("(")
    if open_paren == -1 or not generated.endswith(")"):
        return None

    depth = 0
    current = ""
    arguments = []
    for char in generated[open_paren:-1].removeprefix("("):
        if char in "([":
            depth += 1
        elif char in ")]":
            depth -= 1
            if depth < 0:  # the call closed early, so this is not a single call
                return None
        if char == "," and depth == 0:
            arguments.append(current.strip())
            current = ""
        else:
            current += char
    arguments.append(current.strip())
    return [argument for argument in arguments if argument]


def test_no_transform_emits_a_function_databend_lacks() -> None:
    """
    Enumerate rather than hand-list. Every function name the parser recognises is
    round-tripped, and any *rewrite* must land on a name Databend actually has.

    The dialect began life based on ClickHouse purely to absorb the
    ``SETTINGS (...)`` wrapper, and inherited that dialect's whole generation table
    unreviewed: ``STDDEV`` emitted as ``stddevSamp``, ``SPLIT`` as
    ``splitByString``, ``REGEXP_LIKE`` as ``match`` -- 44 such names in all, each
    rejected outright by the server. A hand-written battery is what let them go
    unnoticed, and it would not catch the next one a sqlglot bump introduces.
    Anything new failing here needs a ``TRANSFORMS`` override, or a deliberate
    entry in ``KNOWN_UNSUPPORTED``.
    """
    regressions = {}
    for name in sorted(Databend.Parser.FUNCTIONS):
        if name in KNOWN_UNSUPPORTED:
            continue
        for args, generated in _round_trips(name):
            if not _is_rewrite(name, generated):
                continue
            if _names_databend_lacks(generated):
                regressions[f"{name}({args})"] = generated

    assert not regressions, (
        "these round-trips emit a name Databend does not have: "
        + "; ".join(f"{k} -> {v}" for k, v in sorted(regressions.items()))
    )


def test_a_kept_name_does_not_gain_or_reorder_arguments() -> None:
    """
    A name surviving a round-trip is not enough; the arguments have to survive too.

    Checking only the name before the paren misses a rewrite that keeps the name
    and changes the call. ``ARRAY_LENGTH(a)`` came back as ``ARRAY_LENGTH(a, 1)``
    -- Databend's takes one argument and rejects that -- and it passed the name
    check untouched.

    Two changes are asserted on, because neither can ever be right: an argument
    the caller did not write appearing, and the caller's arguments coming back in
    a different order. Arguments being *dropped* is not asserted on, because this
    enumeration probes one, two and three arguments against every name, so most
    dropping is a fixed-arity function discarding a nonsense extra rather than a
    defect. A rewrite that changes the name is skipped as well -- ``COUNT_IF(x)``
    legitimately becomes a CASE expression -- leaving this to the name check and
    the per-override tests.
    """
    placeholder = re.compile(r"\b([xyz])\b", re.IGNORECASE)
    regressions = {}
    for name in sorted(Databend.Parser.FUNCTIONS):
        if name in KNOWN_UNSUPPORTED:
            continue
        # Only names Databend has: for anything else the shape is moot, since the
        # call will not run there whatever its arguments look like.
        if name.lower() not in DATABEND_FUNCTION_CATALOGUE:
            continue
        for args, generated in _round_trips(name):
            if _is_rewrite(name, generated):
                continue
            written = _call_arguments(f"{name}({args})")
            emitted = _call_arguments(generated)
            if written is None or emitted is None:
                continue

            written_order = [f.lower() for f in placeholder.findall(" ".join(written))]
            emitted_order = [f.lower() for f in placeholder.findall(" ".join(emitted))]
            gained = len(emitted) > len(written)
            reordered = emitted_order != written_order[: len(emitted_order)]
            if gained or reordered:
                regressions[f"{name}({args})"] = generated

    assert not regressions, (
        "these keep the function name but gain or reorder arguments: "
        + "; ".join(f"{k} -> {v}" for k, v in sorted(regressions.items()))
    )


def test_known_unsupported_list_has_no_stale_entries() -> None:
    """
    Keep the escape hatch honest: an entry that no longer misbehaves -- because a
    sqlglot release fixed it, or an override now covers it -- must be removed, or
    the list slowly becomes somewhere real regressions can hide.
    """
    stale = []
    for name in sorted(KNOWN_UNSUPPORTED):
        if name not in Databend.Parser.FUNCTIONS:
            continue
        round_trips = _round_trips(name)
        if not round_trips:
            continue
        if not any(
            _is_rewrite(name, generated) and _names_databend_lacks(generated)
            for _, generated in round_trips
        ):
            stale.append(name)

    assert not stale, f"no longer unsupported, drop from KNOWN_UNSUPPORTED: {stale}"


@pytest.mark.parametrize(
    "written,expected",
    [
        ("ANY_VALUE(x)", "ANY(x)"),
        ("APPROX_COUNT_DISTINCT(x)", "APPROX_COUNT_DISTINCT(x)"),
        ("ARRAY_CONCAT(a, b)", "ARRAY_CONCAT(a, b)"),
        ("ARRAY_CONTAINS(a, 1)", "ARRAY_CONTAINS(a, 1)"),
        ("ARRAY_INTERSECTION(a, b)", "ARRAY_INTERSECTION(a, b)"),
        ("CURRENT_DATE", "TODAY()"),
        ("DAYOFMONTH(x)", "DAYOFMONTH(x)"),
        ("DAYOFWEEK(x)", "DAYOFWEEK(x)"),
        ("DAYOFYEAR(x)", "DAYOFYEAR(x)"),
        ("JSON_EXTRACT(j, 'a')", "JSON_EXTRACT_PATH_TEXT(j, 'a')"),
        ("MEDIAN(x)", "MEDIAN(x)"),
        ("RAND()", "RAND()"),
        ("REGEXP_LIKE(s, 'a')", "REGEXP_LIKE(s, 'a')"),
        ("SHA2(x, 256)", "SHA2(x, 256)"),
        ("WEEKOFYEAR(x)", "WEEKOFYEAR(x)"),
    ],
)
def test_transform_overrides_emit_databend_spellings(
    written: str, expected: str
) -> None:
    """
    One case per name-level ``TRANSFORMS`` override, with the exact spelling
    asserted. The overrides that reshape rather than rename -- ``Array``,
    ``IntDiv``, ``ParameterizedAgg``, ``JSONExtract`` -- have their own tests
    below, since a spelling table says nothing useful about them.

    Each replacement was run against a live Databend (Query v1.2.790) before being
    chosen.
    Left to itself the Postgres base emits ``ANY_VALUE``, ``APPROX_DISTINCT``,
    ``ARRAY_CAT``, ``= ANY(...)``, ``CURRENT_DATE``, ``DAY_OF_MONTH``,
    ``DAY_OF_WEEK``, ``DAY_OF_YEAR``, ``JSON_EXTRACT_PATH``, ``PERCENTILE_CONT``,
    ``RANDOM``, the ``~`` operator, ``SHA256`` and ``WEEK_OF_YEAR`` -- none of
    which that server accepts.
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == f"SELECT {expected}"


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM t SETTINGS max_threads = 1",
        "SELECT a FROM t WHERE b > 1 SETTINGS max_threads = 1",
    ],
)
def test_trailing_settings_round_trips(sql: str) -> None:
    """
    Databend accepts ClickHouse's *trailing* ``SETTINGS k = v`` as well as the
    leading parenthesised wrapper. Postgres has no such modifier, so re-basing had
    to carry it across explicitly -- including keeping SETTINGS out of
    ``TABLE_ALIAS_TOKENS``, without which ``FROM t SETTINGS ...`` binds it as the
    table's alias and the assignment after it fails to parse.
    """
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


def test_postgres_style_casts_are_preserved() -> None:
    """
    The Postgres base renders casts as ``TEXT`` / ``BIGINT`` / ``DOUBLE PRECISION``
    where the ClickHouse base emitted ``Nullable(String)`` and friends. Databend
    accepts both (verified live), so the re-base leaves CAST rendering intact --
    the largest single surface the base change could have broken.
    """
    generated = sqlglot.transpile(
        "SELECT CAST(a AS TEXT), CAST(b AS BIGINT), CAST(c AS DOUBLE PRECISION)",
        read=Databend,
        write=Databend,
    )[0]

    assert "Nullable" not in generated
    assert "TEXT" in generated
    assert "BIGINT" in generated


# Databend's accepted type names, as the server itself lists them when handed one
# it does not know. Kept beside the function catalogue and used the same way.
#
# This is the parser's offer list, which is a little wider than what it will then
# take: NUMERIC is named here but CAST(NULL AS NUMERIC(10, 2)) is rejected. The
# dialect emits DECIMAL, so nothing depends on it -- the list is what may be
# written, not a promise that every entry resolves.
DATABEND_TYPE_NAMES = {
    "ARRAY",
    "BIGINT",
    "BINARY",
    "BITMAP",
    "BLOB",
    "BOOL",
    "BOOLEAN",
    "CHAR",
    "CHARACTER",
    "DATE",
    "DATETIME",
    "DECIMAL",
    "DOUBLE",
    "FLOAT",
    "FLOAT32",
    "FLOAT64",
    "GEOGRAPHY",
    "GEOMETRY",
    "INT",
    "INT16",
    "INT32",
    "INT64",
    "INT8",
    "INTEGER",
    "INTERVAL",
    "JSON",
    "LONGBLOB",
    "MAP",
    "MEDIUMBLOB",
    "NULLABLE",
    "NUMERIC",
    "REAL",
    "SIGNED",
    "SMALLINT",
    "STRING",
    "TEXT",
    "TIMESTAMP",
    "TINYBLOB",
    "TINYINT",
    "TUPLE",
    "UINT16",
    "UINT32",
    "UINT64",
    "UINT8",
    "UNSIGNED",
    "VARBINARY",
    "VARCHAR",
    "VARIANT",
    "VECTOR",
}

# Names that are only a type once given arguments, so a bare CAST to them is not
# a thing to sweep: ARRAY, MAP, TUPLE and NULLABLE all take a member type, and
# the parameterised spellings are swept explicitly instead. SIGNED and UNSIGNED
# are cast modifiers rather than types.
TYPES_NEEDING_ARGUMENTS = {"ARRAY", "MAP", "NULLABLE", "SIGNED", "TUPLE", "UNSIGNED"}

# Words that appear inside a rendered type without being type names of their own.
RENDERED_TYPE_KEYWORDS = {"PRECISION"}

# Written type name -> what the dialect must emit. Every entry was executed as
# CAST(NULL AS <emitted>) on a live Databend (Query v1.2.790).
TYPE_RENDERINGS = [
    ("ARRAY(INT32)", "ARRAY(INT)"),
    ("ARRAY(STRING)", "ARRAY(TEXT)"),
    ("ARRAY(ARRAY(INT32))", "ARRAY(ARRAY(INT))"),
    ("MAP(STRING, INT32)", "MAP(TEXT, INT)"),
    ("MAP(STRING, VARIANT)", "MAP(TEXT, VARIANT)"),
    ("TUPLE(INT32, STRING)", "TUPLE(INT32, STRING)"),
    ("BINARY", "BINARY"),
    ("VARBINARY", "VARBINARY"),
    ("TINYINT", "TINYINT"),
    ("INT8", "TINYINT"),
    ("FLOAT", "FLOAT"),
    ("VARIANT", "VARIANT"),
    ("BITMAP", "BITMAP"),
    ("GEOMETRY", "GEOMETRY"),
]


@pytest.mark.parametrize("written,expected", TYPE_RENDERINGS)
def test_casts_use_databend_type_spellings(written: str, expected: str) -> None:
    """
    A cast must name a type Databend has, in the syntax Databend takes.

    Postgres writes containers as ``INT[]`` and ``MAP<TEXT, INT>`` and binary as
    ``BYTEA``; the server rejects all three outright. ARRAY, MAP and VARIANT are
    Databend's headline complex types and a cast to one is ordinary in an adhoc
    column, so this is not an edge.

    Two entries are width, not syntax. Postgres reads ``INT8`` as eight bytes
    where Databend reads one, and ``FLOAT`` as double precision where Databend
    reads 32-bit, so both silently widen: ``CAST(300 AS INT8)`` overflows on the
    server but ``CAST(300 AS BIGINT)`` returns 300, which is a query that failed
    now succeeding with a different result.
    """
    generated = sqlglot.transpile(
        f"SELECT CAST(x AS {written})", read=Databend, write=Databend
    )[0]
    assert generated == f"SELECT CAST(x AS {expected})"


def test_no_cast_emits_a_type_databend_lacks() -> None:
    """
    The type-name equivalent of the function sweep, and the same lesson.

    The function guard could not see this surface at all: it probes ``NAME(...)``
    calls, so a type name never entered it, and ``ARRAY``, ``MAP`` and ``BINARY``
    were all being rendered into spellings the server rejects while every test
    passed. Sweeping the type list the way the function list is swept would have
    caught all three without anyone having to think of arrays.

    It sweeps the catalogue, not the fourteen pairs asserted above: iterating
    those made this a second reading of literals already pinned character for
    character one test earlier, so it could not fail while that one passed. That
    is the same shape of mistake as the guard checking names rather than
    round-trips, one surface further along.
    """
    unknown = {}
    for written in sorted(DATABEND_TYPE_NAMES - TYPES_NEEDING_ARGUMENTS) + [
        # The parameterised spellings too: the container types are exactly where
        # the rendering went wrong, and a bare ARRAY says nothing about ARRAY(T).
        "ARRAY(INT32)",
        "ARRAY(ARRAY(INT32))",
        "MAP(STRING, INT32)",
        "TUPLE(INT32, STRING)",
        "DECIMAL(10, 2)",
        "VARCHAR(10)",
        "VECTOR(3)",
        "NULLABLE(INT32)",
    ]:
        generated = sqlglot.transpile(
            f"SELECT CAST(x AS {written})", read=Databend, write=Databend
        )[0]
        emitted = generated[len("SELECT CAST(x AS ") : -1]

        # The punctuation matters as much as the words. Databend writes every
        # container type with parentheses, so a bracket or an angle means the
        # Postgres spelling survived -- and checking names alone missed exactly
        # that, since every word of INT[] and MAP<TEXT, INT> is a real type name.
        if set("[]<>") & set(emitted):
            unknown[written] = emitted

        for name in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", emitted):
            if name.upper() not in DATABEND_TYPE_NAMES | RENDERED_TYPE_KEYWORDS:
                unknown[written] = emitted

    assert not unknown, "these casts name a type Databend does not have: " + "; ".join(
        f"{k} -> {v}" for k, v in sorted(unknown.items())
    )


@pytest.mark.parametrize(
    "written,expected",
    [
        ("JSON_EXTRACT(j, '$.a')", "JSON_EXTRACT_PATH_TEXT(j, 'a')"),
        ("JSON_EXTRACT(j, '$.a.b')", "JSON_EXTRACT_PATH_TEXT(j, 'a.b')"),
        ("JSON_EXTRACT(j, '$.a.b.c')", "JSON_EXTRACT_PATH_TEXT(j, 'a.b.c')"),
        ("JSON_EXTRACT(j, '$.a[0].b')", "JSON_EXTRACT_PATH_TEXT(j, 'a[0].b')"),
        ("JSON_EXTRACT_SCALAR(j, '$.a.b')", "JSON_EXTRACT_PATH_TEXT(j, 'a.b')"),
        ("JSON_EXTRACT_PATH_TEXT(j, 'a.b')", "JSON_EXTRACT_PATH_TEXT(j, 'a.b')"),
        ("j -> 'a'", "JSON_EXTRACT_PATH_TEXT(j, 'a')"),
        ("j ->> 'a'", "JSON_EXTRACT_PATH_TEXT(j, 'a')"),
    ],
)
def test_json_path_segments_are_not_collapsed(written: str, expected: str) -> None:
    """
    A multi-segment JSON path must stay multi-segment.

    Postgres explodes a path into one argument per segment,
    ``JSON_EXTRACT_PATH(j, 'a', 'b')``, while Databend takes exactly two
    arguments with the path as one dotted string, ``JSON_EXTRACT_PATH_TEXT(j,
    'a.b')``. Renaming the function without rebuilding the path concatenates the
    segments into a single key -- ``'a.b'`` became ``'ab'`` -- which is a field
    that does not exist, so the server returns NULL instead of raising. Nested
    JSON access is ordinary in adhoc columns, and this failure is silent, so it
    is asserted per path shape rather than on one representative case.
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == f"SELECT {expected}"


@pytest.mark.parametrize(
    "path",
    [
        "a..b",  # recursive descent
        "a[?(@.x)]",  # filter selector
        "a[1,2]",  # union
        "$..b",
        "$.a[?(@.x)]",
    ],
)
def test_json_path_segments_that_cannot_be_flattened_are_not_dropped(path: str) -> None:
    """
    A path Databend cannot express must fail, not quietly lose a segment.

    Databend's dotted path syntax has no way to write recursive descent, a filter
    selector or a union, and these parse into segments this dialect cannot render.
    Skipping them leaves a shorter path that is still valid SQL -- ``'a..b'``
    becomes ``'a'`` -- so the server reads a different field and returns NULL,
    which is the same silent wrongness that flattening the whole path caused.
    Note the unrooted spellings: ``$..b`` is rejected by sqlglot before generation,
    but ``a..b`` reaches this dialect.
    """
    with pytest.raises(ValueError, match="Unsupported expression type"):
        sqlglot.transpile(
            f"SELECT JSON_EXTRACT(j, '{path}')", read=Databend, write=Databend
        )


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT DATE_ADD(DAY, 1, ds) FROM t",
        "SELECT DATE_SUB(DAY, 1, ds) FROM t",
        "SELECT DATE_DIFF(DAY, a, b) FROM t",
        "SELECT DATEDIFF(DAY, a, b) FROM t",
    ],
)
def test_unit_first_date_functions_round_trip_verbatim(sql: str) -> None:
    """
    Databend's date arithmetic puts the unit first; Postgres reads it last.

    Parsing ``DATE_ADD(DAY, 1, ds)`` as Postgres does takes ``DAY`` for the value
    and ``ds`` for the unit, and regenerates ``DAY + INTERVAL '1 DS'`` -- a
    reference to a column named DAY and an interval in a unit named after the
    date column. ``DATE_DIFF(DAY, a, b)`` fared worse, dropping its third
    argument entirely and comparing the literal unit against a column. Neither
    changes the function name, so a name-only check waves both through; both are
    ordinary in a time-series chart.
    """
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM t QUALIFY ROW_NUMBER() OVER (PARTITION BY a ORDER BY b) = 1",
        "SELECT a FROM t QUALIFY ROW_NUMBER() OVER (PARTITION BY a ORDER BY b) = 1",
    ],
)
def test_qualify_is_not_desugared(sql: str) -> None:
    """
    Databend has QUALIFY; Postgres does not, and its Select transform chain
    rewrites the clause into a subquery carrying a generated ``_w`` column. On an
    explicit column list that is only verbose, but ``SELECT *`` then lifts ``_w``
    into the result set, so the query returns a column nobody asked for. This is
    not confined to SQL Lab: ``Database.apply_limit_to_sql`` regenerates through
    this dialect, as does virtual-dataset column inference.
    """
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


@pytest.mark.parametrize(
    "written,expected",
    [
        ("[1, 2, 3]", "[1, 2, 3]"),
        ("ARRAY_CONTAINS([1, 2], x)", "ARRAY_CONTAINS([1, 2], x)"),
    ],
)
def test_array_literals_keep_databend_syntax(written: str, expected: str) -> None:
    """
    Databend writes an array literal ``[1, 2, 3]``. Postgres wraps it in its own
    constructor, ``ARRAY[1, 2, 3]``, which the server rejects outright:
    "unexpected `[`, expecting `(`".
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == f"SELECT {expected}"


@pytest.mark.parametrize(
    "written,expected",
    [
        ("ARRAY_FILTER(a, x -> x > 1)", "ARRAY_FILTER(a, x -> x > 1)"),
        ("FILTER(a, x -> x > 1)", "ARRAY_FILTER(a, x -> x > 1)"),
        (
            "ARRAY_ANY(a, x -> x > 1)",
            "(ARRAY_LENGTH(a) = 0 OR ARRAY_LENGTH(ARRAY_FILTER(a, x -> x > 1)) <> 0)",
        ),
    ],
)
def test_a_lambda_over_an_array_stays_a_lambda(written: str, expected: str) -> None:
    """
    Postgres has no lambda, so it rewrites one into ``ARRAY(SELECT ... FROM
    UNNEST(a) WHERE ...)``. Databend has no such constructor, and the array
    override then bracketed the subquery, giving ``[SELECT x FROM UNNEST(a) ...]``
    -- valid in no dialect at all.

    ARRAY_ANY is assembled from the same node and so inherited the subquery
    without appearing anywhere by name; it is the reason this is a transform
    rather than a name left unparsed, which would have fixed only what was
    written literally. Both renderings above were run against the server.
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == f"SELECT {expected}"


def test_try_is_not_silently_removed() -> None:
    """
    Postgres drops the wrapper and leaves the expression bare, which is the one
    rewrite that turns a query answering NULL into a query that raises. Databend
    has no general TRY -- only ``try_to_date``, ``try_cast`` and the rest of that
    family -- so the call is left as written for the server to refuse by name.
    """
    generated = sqlglot.transpile("SELECT TRY(a / b)", read=Databend, write=Databend)[0]
    assert generated == "SELECT TRY(a / b)"


@pytest.mark.parametrize(
    "written",
    [
        "{'k': 1}",
        "{'k': 1, 'j': 2}",
        "{'k': {'j': 2}}",
        "{'k': [1, 2]}",
        "{}",
        # The value may be an extraction even though the key's colon is not.
        "{'k': JSON_EXTRACT_PATH_TEXT(v, 'a')}",
    ],
)
def test_object_literals_survive_the_colon_rule(written: str) -> None:
    """
    Databend spells a path extraction ``v:a`` and an object literal ``{'k': 1}``
    with the same character, and the extraction rule wins by default. The literal
    came back as ``STRUCT(JSON_PATH_QUERY_FIRST('k', '1'))``: an object rewritten
    into a lookup on a different value, which the server accepts and answers
    differently rather than refusing.

    Every form here was run against the server; the last is the reason the key
    alone is read with the rule suspended rather than the whole element.
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == f"SELECT {written}"


@pytest.mark.parametrize(
    "written,expected",
    [
        ("STR_TO_DATE(s, '%Y-%m-%d')", "TO_DATE(s, 'YYYY-MM-DD')"),
        (
            "STR_TO_DATE(s, '%Y-%m-%d %H:%M:%S')",
            "TO_DATE(s, 'YYYY-MM-DD HH24:MI:SS')",
        ),
        ("STR_TO_TIME(s, '%Y-%m-%d')", "TO_TIMESTAMP(s, 'YYYY-MM-DD')"),
        (
            "TIME_TO_STR(d, '%Y-%m-%d %H:%M:%S')",
            "TO_CHAR(d, 'YYYY-MM-DD HH24:MI:SS')",
        ),
        # DATE_FORMAT is Databend's own, and its %-style format is left alone.
        ("DATE_FORMAT(d, '%H:%M')", "DATE_FORMAT(d, '%H:%M')"),
    ],
)
def test_format_strings_are_translated_not_carried(written: str, expected: str) -> None:
    """
    Databend takes both the %-style and the Oracle-style spelling, and the two
    agree on the pair that is easy to get wrong -- ``%M`` and ``MI`` are minutes,
    ``%m`` and ``MM`` are months. All of the above were run against the server.

    This is worth pinning because no sweep can see it: the name is checked, the
    argument count is checked, and a format string translated into nonsense is
    still one string argument in the same position. The ClickHouse base dropped
    the format outright -- ``TO_CHAR(d, 'YYYY-MM-DD')`` became
    ``CAST(d AS Nullable(String))``, the default rendering, with the requested
    format gone.
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == f"SELECT {expected}"


@pytest.mark.parametrize(
    "written,quoted",
    [
        ("SELECT 2024_total FROM t", 'SELECT "2024_total" FROM t'),
        ("SELECT 3d FROM t", 'SELECT "3d" FROM t'),
    ],
)
def test_an_unquoted_leading_digit_is_a_number_here_as_on_the_server(
    written: str, quoted: str
) -> None:
    """
    A name beginning with a digit splits into a number and an alias, which looks
    like the digit-separator corruption in reverse and is not: Databend's own
    tokenizer reads the leading digit as a number too, separator and all --
    ``unexpected `2024_``` -- so a column named this way has to be quoted there
    as well. The ClickHouse base kept it as one identifier, which is what
    diverged.

    The shape is asserted rather than the text, because sqlglot 30 renders the
    number ``2024`` where 28 renders ``2024_``, and both are the same value.
    """
    alias = sqlglot.parse_one(written, Databend).selects[0]
    assert isinstance(alias, exp.Alias)
    assert isinstance(alias.this, exp.Literal)

    assert sqlglot.transpile(quoted, read=Databend, write=Databend)[0] == quoted


def test_nothing_new_hides_in_the_dropped_select_chain() -> None:
    """
    ``exp.Select`` is dropped from Postgres's ``TRANSFORMS`` wholesale, so
    anything a future sqlglot adds to that chain is discarded here with no sweep
    able to notice -- it is neither a name nor a type. Today the chain desugars
    QUALIFY and SEMI/ANTI joins, both of which Databend supports natively, and
    that is the entire reason dropping it is safe.

    The chain is reached through the closure because sqlglot exposes it no other
    way. If that shape changes this raises rather than passing quietly, which is
    the wanted outcome: the assumption needs re-checking either way.
    """
    chain = Postgres.Generator.TRANSFORMS[exp.Select]
    preprocessors = next(
        cell.cell_contents
        for cell in chain.__closure__
        if isinstance(cell.cell_contents, list)
    )

    assert [step.__name__ for step in preprocessors] == [
        "eliminate_semi_and_anti_joins",
        "eliminate_qualify",
    ]


@pytest.mark.parametrize(
    "written,expected",
    [
        ("a ILIKE '%x%'", "LOWER(a) LIKE LOWER('%x%')"),
        ("NOT a ILIKE '%x%'", "NOT LOWER(a) LIKE LOWER('%x%')"),
    ],
)
def test_ilike_is_lowered_the_way_the_engine_spec_lowers_it(
    written: str, expected: str
) -> None:
    """
    Databend has no ILIKE operator -- ``'Hello' ILIKE '%ell%'`` is a syntax error
    -- and ``superset/db_engine_specs/databend.py`` already patches
    ``DatabendCompiler`` to emit ``LOWER(x) LIKE LOWER(y)``. Passing ILIKE
    through left the two halves of Superset disagreeing about the same server.

    An operator is the shape the catalogue sweep cannot see, since it looks for
    ``NAME(``; ILIKE joins ``~`` and ``~*`` in the operator list beside it.
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == f"SELECT {expected}"


@pytest.mark.parametrize(
    "written",
    [
        "CONVERT_TIMEZONE('America/Los_Angeles', ts)",
        "CONVERT_TIMEZONE('UTC', 'America/Los_Angeles', ts)",
    ],
)
def test_convert_timezone_keeps_databends_spelling(written: str) -> None:
    """
    Databend's CONVERT_TIMEZONE takes the zone and the timestamp; there is no
    three-argument form. Postgres turns either into ``AT TIME ZONE``, which the
    server rejects -- "unexpected `TIME`" -- so the two-argument call that works
    was broken and the three-argument one stopped failing by name.

    A rewrite into *syntax* is the other thing the name sweep cannot see: the
    output has no call name in it at all.
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == f"SELECT {written}"


def test_try_cast_keeps_its_try_semantics() -> None:
    """
    Postgres has no TRY_CAST and degrades it to CAST, so a column that returned
    NULLs for unparseable values starts raising instead. Databend has ``try_cast``.
    """
    generated = sqlglot.transpile(
        "SELECT TRY_CAST(a AS INT)", read=Databend, write=Databend
    )[0]
    assert generated == "SELECT TRY_CAST(a AS INT)"


@pytest.mark.parametrize("written", ["REGEXP_I_LIKE(s, 'a')", "s ~* 'a'"])
def test_case_insensitive_regex_does_not_become_an_operator(written: str) -> None:
    """
    Postgres renders this as ``x ~* y``. Databend has neither ``~`` nor ``~*`` --
    its parser rejects both, listing the operators it does take -- and expects the
    flags as a third argument to REGEXP_LIKE instead.

    An operator is the one shape the catalogue check cannot see, since it looks
    for ``NAME(``; this and the ``~`` behind the ``RegexpLike`` override are why
    the check now looks for those two operators by hand as well.
    """
    generated = sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
    assert generated == "SELECT REGEXP_LIKE(s, 'a', 'i')"


def test_array_length_keeps_its_single_argument() -> None:
    """
    Postgres emits ``ARRAY_LENGTH(a, 1)``, naming the dimension to measure.
    Databend's takes the array alone and rejects the second argument: "no
    function matches signature `length(Array(UInt8), UInt8)`".
    """
    generated = sqlglot.transpile(
        "SELECT ARRAY_LENGTH(a)", read=Databend, write=Databend
    )[0]
    assert generated == "SELECT ARRAY_LENGTH(a)"


@pytest.mark.parametrize(
    "written",
    [
        "QUANTILE(0.5)(x)",
        "QUANTILE(0.9)(x)",
        "QUANTILE(x)",
        # Several levels, and several arguments: both are valid Databend.
        "QUANTILE(0.5, 0.9)(x)",
        "QUANTILE(0.5)(x, y)",
        # The rest of the family, all in the checked-in catalogue.
        "quantile_cont(0.5)(x)",
        "quantile_disc(0.5)(x)",
        "quantile_tdigest(0.5)(x)",
        "quantile_tdigest_weighted(0.5)(x, y)",
        "histogram(5)(x)",
    ],
)
def test_parametric_aggregates_round_trip_verbatim(written: str) -> None:
    """
    Databend writes parametric aggregates ``NAME(params)(args)``, which Postgres
    has no syntax for: it reads the first list as the arguments and then takes
    the second for an alias, so ``histogram(5)(a)`` became ``HISTOGRAM(5) AS (a)``
    and the server rejected it. The name survives that rewrite and only the
    arguments move, so it is invisible to a name check.

    Handled by shape rather than by name -- the family is the whole point, and
    a per-name hook is what made ``QUANTILE`` work while its four neighbours in
    the catalogue stayed broken. Sweeping every catalogue name through this form
    finds none that regress and 503 that the ClickHouse base mangled.
    """
    assert (
        sqlglot.transpile(f"SELECT {written}", read=Databend, write=Databend)[0]
        == f"SELECT {written}"
    )


def test_json_path_that_is_not_a_literal_path_falls_back() -> None:
    """
    A path given as an expression cannot be flattened into a dotted string, so it
    goes to ``JSON_PATH_QUERY_FIRST``, which accepts a path argument directly.
    """
    generated = sqlglot.transpile(
        "SELECT JSON_EXTRACT(j, path_col)", read=Databend, write=Databend
    )[0]
    assert generated == "SELECT JSON_PATH_QUERY_FIRST(j, path_col)"


@pytest.mark.parametrize(
    "sql,expected",
    [
        ("SELECT * FROM t settings", "SELECT * FROM t AS settings"),
        ("SELECT * FROM t AS settings", "SELECT * FROM t AS settings"),
        (
            "SELECT * FROM (SELECT 1 AS x) settings",
            "SELECT * FROM (SELECT 1 AS x) AS settings",
        ),
        (
            "SELECT a.x FROM t settings JOIN u ON settings.x = u.x",
            "SELECT a.x FROM t AS settings JOIN u ON settings.x = u.x",
        ),
        (
            "SELECT * FROM t SETTINGS max_threads = 1",
            "SELECT * FROM t SETTINGS max_threads = 1",
        ),
    ],
)
def test_settings_works_as_both_clause_and_table_alias(sql: str, expected: str) -> None:
    """
    ``settings`` is a plausible table name, so a bare alias must survive.

    The trailing ``SETTINGS k = v`` clause and an implicit alias both follow a
    table, and only the lookahead for ``=`` tells them apart. Dropping SETTINGS
    from ``TABLE_ALIAS_TOKENS`` to make the clause parse discarded the alias
    without error instead, leaving any qualified reference to it dangling.
    """
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == expected


@pytest.mark.parametrize(
    "sql",
    [
        "SETTINGS (max_execute_time_in_seconds=300) SELECT 1",
        "SETTINGS (a=1, b=2) SELECT 1",
        "SETTINGS (a='x') SELECT 1",
        "SETTINGS (a=-1) SELECT 1",
        "SETTINGS (a=TRUE) SELECT 1",
    ],
)
def test_constant_leading_settings_are_absorbed(sql: str) -> None:
    """Databend's own setting values are constants, and those still round-trip."""
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


def test_leading_settings_rejects_non_constant_values() -> None:
    """
    Only constants may be absorbed, so nothing can hide in the wrapper.

    The clause is re-emitted from source text rather than regenerated from the
    tree, so anything the parser swallowed but did not expose as tree nodes would
    be invisible to the table extraction behind RLS and the denylist, yet still
    be forwarded to the server verbatim. Databend rejects a non-constant here
    anyway ("value must be constant value"), so refusing to absorb it costs
    nothing and keeps the tree an honest account of the statement.
    """
    import sqlglot.errors

    for sql in [
        # The value side, which was already refused.
        "SETTINGS (a = (SELECT secret FROM sensitive)) SELECT 1 FROM public_table",
        # The key side, which was not. This was absorbed and re-emitted with the
        # subquery intact while the tree reported one table, which is precisely
        # what the docstring above says cannot happen.
        "SETTINGS ((SELECT secret FROM sensitive) = 1) SELECT 1 FROM public_table",
        "SETTINGS (f(g) = 1) SELECT 1 FROM public_table",
        # One good pair and one bad one is still bad.
        "SETTINGS (a = 1, (SELECT 1 FROM sensitive) = 2) SELECT 1 FROM public_table",
    ]:
        with pytest.raises(sqlglot.errors.ParseError):
            sqlglot.parse_one(sql, Databend)


def test_nothing_absorbed_is_missing_from_the_tree() -> None:
    """
    State the property directly rather than by listing the shapes that break it.

    Every table named anywhere in the re-emitted statement has to be reachable
    through the tree, or RLS and the denylist are reading a different query from
    the one the server runs.
    """
    sql = "SETTINGS (max_execute_time_in_seconds=300) SELECT a FROM t JOIN u ON a = b"
    parsed = sqlglot.parse_one(sql, Databend)

    assert parsed.sql(dialect=Databend) == sql
    assert sorted(t.name for t in parsed.find_all(exp.Table)) == ["t", "u"]


@pytest.mark.parametrize(
    "sql",
    [
        # A stage is addressed with @, a positional column with $. Postgres
        # renders both with $ and ClickHouse both with @, so a single token turns
        # one into the other -- and @1 is a string constant on the server, so
        # choosing @ returned constants where columns were asked for.
        "SELECT $1, $2 FROM @mystage",
        "SELECT * FROM @mystage",
        "SELECT $1 FROM t",
        "SELECT @var",
    ],
)
def test_stage_and_positional_prefixes_are_distinguished(sql: str) -> None:
    """
    ``@name`` and ``$n`` both parse to a parameter, and they are not the same
    thing: ``SELECT $1, $2 FROM @mystage/data.csv`` reads two columns out of a
    staged file. Rendering them with one prefix compiles, runs, and answers with
    the wrong values -- no error, which is the class this dialect exists to close.
    """
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT quantile(0.5)(a) OVER (PARTITION BY b) FROM t",
        "SELECT histogram(5)(a) OVER (PARTITION BY b) FROM t",
        "SELECT quantile(0.5)(a) OVER (ORDER BY b) FROM t",
    ],
)
def test_parametric_aggregates_take_a_window_clause(sql: str) -> None:
    """
    Both halves are valid Databend and they compose. Only what the function
    parser returns is offered a window, so building the aggregate and handing it
    straight back left this raising inside ``sanitize_clause`` -- before the
    server saw it at all, which is the harder of the two failures.
    """
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


@pytest.mark.parametrize(
    "written,expected",
    [
        # Lexical settings, each verified on the server. A wrong reading here is
        # silent: the literal still parses, as something else.
        ("SELECT 0x1A", "SELECT 0x1A"),
        (r"SELECT 'quote\'s'", "SELECT 'quote''s'"),
        ("SELECT 7 DIV 2", "SELECT 7 DIV 2"),
        ("SELECT a DIV b FROM t", "SELECT a DIV b FROM t"),
        ("SELECT COUNT(DISTINCT a, b) FROM t", "SELECT COUNT(DISTINCT a, b) FROM t"),
        ("COPY INTO t FROM 's3://x'", "COPY INTO t FROM 's3://x'"),
        ("SELECT j:a", "SELECT JSON_EXTRACT_PATH_TEXT(j, 'a')"),
        ("SELECT j:a:b", "SELECT JSON_EXTRACT_PATH_TEXT(j, 'a.b')"),
        ("SELECT CAST(x AS INT8)", "SELECT CAST(x AS TINYINT)"),
        ("SELECT CAST(x AS FLOAT)", "SELECT CAST(x AS FLOAT)"),
        (
            "SELECT * FROM t SEMI JOIN u ON t.id = u.id",
            "SELECT * FROM t SEMI JOIN u ON t.id = u.id",
        ),
        (
            "SELECT * FROM t ANTI JOIN u ON t.id = u.id",
            "SELECT * FROM t ANTI JOIN u ON t.id = u.id",
        ),
    ],
)
def test_lexical_and_rendering_settings(written: str, expected: str) -> None:
    """
    One case per setting where the two bases disagree and Databend follows
    ClickHouse. These arrived as class attributes, which coverage counts as
    exercised merely by being read, so nothing but a case like this can tell
    whether the value is right.

    ``1_000_000`` is the one to keep: without the digit-separator setting it
    parses as ``1`` followed by an alias named ``_000_000``, so a metric reading
    ``revenue / 1_000_000`` quietly divides by one instead.
    """
    assert sqlglot.transpile(written, read=Databend, write=Databend)[0] == expected


@pytest.mark.parametrize(
    "sql", ["SELECT * FROM t SAMPLE ROW (10)", "SELECT * FROM t SAMPLE BLOCK (10)"]
)
def test_sample_clause_is_not_supported(sql: str) -> None:
    """
    Asserted so the limit is deliberate rather than discovered.

    Databend accepts these; this dialect does not. The ClickHouse base parsed
    them and then emitted ``SAMPLE ROW 10``, which the server rejects too, so no
    query worked either way -- but the failure moved from the server to
    ``sanitize_clause``, and that is worth stating rather than leaving to be
    re-found.
    """
    import sqlglot.errors

    with pytest.raises(sqlglot.errors.ParseError):
        sqlglot.parse_one(sql, Databend)


@pytest.mark.parametrize(
    "written,value",
    [
        ("SELECT 1_000_000", 1000000),
        ("SELECT 1_000", 1000),
        ("SELECT 12_34_56", 123456),
    ],
)
def test_digit_separators_keep_their_value(written: str, value: int) -> None:
    """
    The value survives, whatever the spelling.

    Without the digit-separator setting the tokenizer stops at the first
    underscore, so ``1_000_000`` parses as ``1`` followed by an alias named
    ``_000_000``: a metric reading ``revenue / 1_000_000`` quietly divides by one
    instead, with no error to notice. Asserted on the number rather than the text
    because sqlglot re-emits the separators on one pinned version and normalises
    them away on the next, and both are the same million.
    """
    parsed = sqlglot.parse_one(written, Databend).selects[0]

    assert isinstance(parsed, exp.Literal)
    assert int(parsed.this) == value


@pytest.mark.parametrize(
    "written,expected",
    [
        # The two-argument call is what Postgres renders wrongly.
        ("SELECT TRIM(a, 'x')", "SELECT TRIM(a, 'x')"),
        # The position forms are accepted as Postgres writes them, so they are
        # handed back unchanged rather than normalised into LTRIM/RTRIM.
        ("SELECT TRIM(BOTH 'x' FROM a)", "SELECT TRIM(BOTH 'x' FROM a)"),
        ("SELECT TRIM(LEADING 'x' FROM a)", "SELECT TRIM(LEADING 'x' FROM a)"),
        ("SELECT TRIM(TRAILING 'x' FROM a)", "SELECT TRIM(TRAILING 'x' FROM a)"),
        ("SELECT TRIM(a)", "SELECT TRIM(a)"),
    ],
)
def test_trim_keeps_a_form_databend_accepts(written: str, expected: str) -> None:
    """
    ``TRIM(a, 'x')`` was being rewritten into ``TRIM('x' FROM a)``, which the
    server rejects -- "unexpected ``FROM``" -- so an adhoc column that worked
    before the re-base stopped working after it.

    It survived the enumerating guards because TRIM was exempt from the shape
    sweep, in a set of names whose argument order sqlglot changes legitimately.
    Removing that set surfaces this and nothing else
    -- its other three members render without a top-level comma, so the shape
    check reads one argument and never flagged them anyway. An exemption that is
    inert for everything except the one defect it hides is worse than no
    exemption, so it is gone rather than trimmed.
    """
    assert sqlglot.transpile(written, read=Databend, write=Databend)[0] == expected


def test_no_catalogue_name_stops_parsing() -> None:
    """
    A name that used to parse and now raises is a regression, and the loudest
    kind: it fails inside ``sanitize_clause``, so the chart breaks in Superset
    rather than at the server.

    The other sweeps cannot see this. They collect the arities that parse and
    skip the rest, which is how ``to_char(x)`` and ``bit_and(a, b)`` -- both
    valid Databend, both fine before the re-base -- passed a suite written to
    catch exactly this. Measured against ClickHouse rather than in isolation,
    since refusing a nonsense arity is not a defect.
    """
    regressions = {}
    for name in sorted(DATABEND_FUNCTION_CATALOGUE):
        if name.upper() in KNOWN_UNSUPPORTED:
            continue
        if name in CLICKHOUSE_ACCEPTS_UNVALIDATED:
            continue
        for args in ARITIES:
            if _raises_where_clickhouse_did_not(name, args):
                regressions[f"{name}({args})"] = "raises here, parsed under ClickHouse"

    assert not regressions, (
        "these no longer parse but did before the re-base: "
        + "; ".join(sorted(regressions))
    )


@pytest.mark.parametrize(
    "sql",
    [
        # Databend's TO_CHAR takes a value alone; Postgres demands a format and
        # raises without one, inside sanitize_clause rather than at the server.
        "SELECT TO_CHAR(d)",
        "SELECT TO_CHAR(d, 'YYYY')",
        # Two-argument scalars here, one-argument aggregates in Postgres, so the
        # second argument was refused outright.
        "SELECT BIT_AND(a, b)",
        "SELECT BIT_OR(a, b)",
        "SELECT BIT_XOR(a, b)",
    ],
)
def test_names_postgres_arity_would_refuse(sql: str) -> None:
    """
    These parsed before the re-base and raised after it, which is the failure the
    module docstring calls the worse of the two: the chart breaks in Superset
    rather than at the server.

    They walked past every sweep because ``_round_trips`` collected the arities
    that parse and skipped the rest, so a name that stopped parsing looked the
    same as a name with fewer arities. ``test_no_catalogue_name_stops_parsing``
    exists for that, and goes red on its own if these are put back.
    """
    assert sqlglot.parse_one(sql, Databend).sql(dialect=Databend) == sql


def test_count_if_is_not_expanded_into_a_sum() -> None:
    """
    ``COUNT_IF`` and ``SUM(CASE WHEN ... THEN 1 ELSE 0 END)`` are not the same
    aggregate. Over no matching rows Databend answers 0 for the first and NULL
    for the second, so a "count of rows matching X" metric renders blank instead
    of zero the moment the filter matches nothing -- verified on the server.

    Databend has ``count_if``; it is simply absent from ``SHOW FUNCTIONS``, and
    taking that absence for evidence is what let the expansion stand.
    """
    generated = sqlglot.transpile(
        "SELECT COUNT_IF(a > 1) FROM t", read=Databend, write=Databend
    )[0]

    assert generated == "SELECT COUNT_IF(a > 1) FROM t"


def test_timestamp_diff_keeps_databend_spelling() -> None:
    """
    Databend has ``timestamp_diff`` and not ``timestampdiff``, which is what
    Postgres renders the node as. Two timestamps in, an interval out.

    This one was sitting in ``KNOWN_UNSUPPORTED``, put there early on when the
    argument semantics were unclear -- so the name sweep had a real finding and
    the exemption was swallowing it. Found by auditing that list for entries
    naming something Databend actually has, which is the only kind that can hide
    anything.
    """
    assert (
        sqlglot.transpile("SELECT TIMESTAMP_DIFF(a, b)", read=Databend, write=Databend)[
            0
        ]
        == "SELECT TIMESTAMP_DIFF(a, b)"
    )


def test_no_expression_is_generated_away() -> None:
    """
    Whatever a call becomes, it has to remain something.

    ``MAP_FROM_ENTRIES(pairs)`` rendered as nothing at all, leaving ``SELECT FROM
    t`` -- a statement with no select list -- and in DDL a dangling ``DEFAULT``.
    sqlglot reports that by logging a warning and returning an empty string, so
    nothing raises and nothing is caught: the other sweeps compare names and
    arguments, and there is no name left to compare.

    The ClickHouse base loses a select list for no name at all, so zero is the
    right threshold rather than a number to be tuned.
    """
    vanished = []
    for name in sorted(Databend.Parser.FUNCTIONS):
        for args, generated in _round_trips(name):
            if not generated.strip():
                vanished.append(f"{name}({args})")

    assert not vanished, f"these generate away to nothing: {'; '.join(vanished)}"
