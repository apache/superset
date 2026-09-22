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
Databend dialect.

Databend has no built-in sqlglot dialect, so ``SQLGLOT_DIALECTS`` had no entry for
it and every Databend query fell back to the generic dialect. Superset regenerates
each adhoc column and metric through that dialect (``sanitize_clause``, called from
``_process_sql_expression`` in ``superset/models/helpers.py``), so the fallback's
rendering reached the server on every compile.

The base is Postgres, which matches ``databend-sqlalchemy``: its
``DatabendCompiler`` and ``DatabendIdentifierPreparer`` derive from ``PGCompiler``
and ``PGIdentifierPreparer``, so the SQL Superset compiles and the SQL this dialect
regenerates come from the same family.

ClickHouse looks like the closer fit -- Databend borrows much of its surface
syntax, including ``SETTINGS`` and the ``to_start_of_*`` date helpers -- but its
generator renames a large number of functions to spellings Databend does not
have, ``argMax`` and ``countIf`` among them.

What Postgres still gets wrong is overridden below. The sweeps in the test file
are what keep that list honest across a sqlglot bump: they enumerate the server's
own function catalogue and type list rather than re-reading a set of pairs
somebody wrote down.

Databend's ``SAMPLE ROW (n)`` and ``SAMPLE BLOCK (n)`` are not supported and
raise. Parsing them faithfully means carrying the clause through generation as
well, which is more than the sampling is worth until somebody asks for it.
"""

from __future__ import annotations

import typing as t

from sqlglot import exp, generator
from sqlglot.dialects.dialect import rename_func
from sqlglot.dialects.postgres import Postgres
from sqlglot.tokens import TokenType

# Names left unparsed so Databend's own spelling survives a round-trip; see
# ``Parser.FUNCTIONS``.
#
# The date functions are unit-first in Databend and argument-first in Postgres.
# QUANTILE is a parametric aggregate: sqlglot maps the bare name to a typed node,
# which would take the level list for its arguments and leave the real argument
# list stranded, so it has to reach the generic parametric parse as an anonymous
# call like the rest of its family.
LEFT_UNPARSED = {
    "QUANTILE",
    "DATEADD",
    "DATEDIFF",
    "DATESUB",
    "DATE_ADD",
    "DATE_DIFF",
    "DATE_SUB",
    # Databend's bitwise helpers are two-argument scalars; Postgres has the same
    # names as one-argument aggregates, so it refuses the second argument and the
    # expression never reaches the server at all.
    "BIT_AND",
    "BIT_OR",
    "BIT_XOR",
    # Databend's TO_CHAR takes a value alone as well as a value and a format;
    # Postgres requires the format and raises without it.
    "TO_CHAR",
    # Not a name Databend has, but Postgres renders it as nothing at all -- the
    # select list disappears, or a DDL DEFAULT is left dangling. Left unparsed so
    # it reaches the server and is refused there instead.
    "MAP_FROM_ENTRIES",
    # Postgres splices the argument's *name* into an interval literal --
    # INTERVAL 'days DAY' -- so a column reference silently becomes a string.
    "DATE_FROM_UNIX_DATE",
    # Postgres has no TRY and removes it, leaving the bare expression: TRY(a / b)
    # became a / b, so a cell that answered NULL on a division by zero starts
    # failing the whole query instead. Databend has no general TRY either -- only
    # the try_to_* family -- so there is nothing to rewrite it to, and reaching
    # the server unchanged at least fails loudly.
    "TRY",
    # Databend's CONVERT_TIMEZONE takes the zone and the timestamp, and has no
    # three-argument form: "no function matches signature `convert_timezone(
    # String, String, Timestamp)`". Postgres turns the call into AT TIME ZONE,
    # which Databend's parser rejects outright -- "unexpected `TIME`" -- so
    # neither arity survived the rewrite.
    "CONVERT_TIMEZONE",
    # Databend's TIMESTAMP_DIFF takes two timestamps and answers an
    # interval. Postgres renders the node as TIMESTAMPDIFF, which is not a
    # name Databend has, so its own spelling is kept instead.
    "TIMESTAMP_DIFF",
}


def _date_format(args: list[t.Any]) -> exp.Expression:
    """
    Parse ``formatDateTime(...)`` as Databend's ``DATE_FORMAT(...)``.

    ClickHouse's parser folded both spellings onto ``exp.TimeToStr`` and its
    generator emitted ``formatDateTime``, so charts authored while that rewrite
    was in effect may have the ClickHouse spelling stored. Databend rejects it --
    "no function matches the given name: 'formatdatetime', do you mean
    'date_format'?" -- so it is healed on the way through. Both spellings take
    the same ``%``-style format string, which is passed along untouched.
    """
    return exp.Anonymous(this="DATE_FORMAT", expressions=args)


def _sha2(self: generator.Generator, expression: exp.SHA2) -> str:
    """Databend spells this ``SHA2(x, 256)``; Postgres emits ``SHA256(x)``."""
    return self.func("SHA2", expression.this, expression.args.get("length"))


def _struct(self: generator.Generator, expression: exp.Struct) -> str:
    """
    Write Databend's object literal, ``{'k': 1}``.

    Postgres has no such literal and renders the node as ``STRUCT(1 AS k)``.
    Databend has no ``struct`` function at all -- ``object_construct`` and
    ``tuple`` are the nearest names it has -- so that call is rejected outright.

    An empty literal, ``{}``, is written the same way and is valid on the server.
    A struct whose fields are not named is a different thing and is left to the
    base generator.
    """
    fields = expression.expressions
    if any(not isinstance(field, exp.PropertyEQ) for field in fields):
        return self.struct_sql(expression)

    pairs = ", ".join(
        f"{self.sql(exp.Literal.string(field.name))}: {self.sql(field.expression)}"
        for field in fields
    )
    return f"{{{pairs}}}"


def _ilike(self: generator.Generator, expression: exp.ILike) -> str:
    """
    Spell a case-insensitive match the way the engine spec already does.

    Databend has no ILIKE operator -- "unexpected `'%ell%'`" -- and
    ``superset/db_engine_specs/databend.py`` patches ``DatabendCompiler`` to emit
    ``LOWER(x) LIKE LOWER(y)`` for exactly that reason. Passing ILIKE through
    left the two halves of Superset disagreeing about the same server: a filter
    built from the UI worked and the same comparison written into an adhoc column
    did not.
    """
    return self.sql(
        exp.Like(
            this=exp.Lower(this=expression.this),
            expression=exp.Lower(this=expression.expression),
        )
    )


def _json_extract(
    self: generator.Generator, expression: exp.JSONExtract | exp.JSONExtractScalar
) -> str:
    """
    Render a JSON path the way Databend spells it.

    Postgres explodes a path into one argument per segment --
    ``JSON_EXTRACT_PATH(j, 'a', 'b')`` -- but Databend's
    ``JSON_EXTRACT_PATH_TEXT`` takes exactly two arguments, the second a dotted
    path string: ``JSON_EXTRACT_PATH_TEXT(j, 'a.b')``. Renaming the function
    without rebuilding the path silently collapses the segments into one key
    (``'a.b'`` becoming ``'ab'``), which reads a field that is not there and
    returns NULL rather than failing.

    Only keys and subscripts can be written that way. Recursive descent, filter
    selectors and unions cannot, and dropping them would repeat the same failure
    one level down -- ``'a..b'`` flattening to ``'a'`` reads the wrong field and
    returns NULL. Those, and a path given as an expression rather than a literal,
    go to ``JSON_PATH_QUERY_FIRST``, which takes a path argument directly; if
    sqlglot cannot render the path either, it raises, which is the right outcome
    for a path this dialect cannot faithfully express.

    One ambiguity is inherited from the parse and cannot be resolved here.
    Databend's own ``JSON_EXTRACT_PATH_TEXT(j, 'a.b')``, meaning the path ``a``
    then ``b``, and the quoted ``$."a.b"``, meaning the single key ``a.b``, both
    parse to one ``JSONPathKey`` holding ``a.b`` -- the spellings are already
    indistinguishable by the time generation runs. The dotted form is emitted,
    which keeps Databend's own syntax round-tripping unchanged; a literal key
    containing a dot has to be written with Databend's bracketed ``j['a.b']``,
    which passes through this dialect unparsed.
    """
    path = expression.expression
    segments: list[str] = []
    flattened = isinstance(path, exp.JSONPath)

    if flattened:
        for segment in path.expressions:
            if isinstance(segment, exp.JSONPathSubscript):
                segments.append(f"[{segment.this}]")
            elif isinstance(segment, exp.JSONPathKey):
                segments.append(f".{segment.this}" if segments else str(segment.this))
            elif not isinstance(segment, exp.JSONPathRoot):
                flattened = False
                break

    if flattened and segments:
        return self.func(
            "JSON_EXTRACT_PATH_TEXT",
            expression.this,
            exp.Literal.string("".join(segments)),
        )

    return self.func("JSON_PATH_QUERY_FIRST", expression.this, path)


def _is_constant_assignment(expression: exp.Expression) -> bool:
    """
    Return whether ``expression`` is a ``key = <constant>`` pair.

    Databend requires constants here -- it answers anything else with "value
    must be constant value" -- and the restriction matters beyond tidiness. The
    leading clause is re-emitted from source text rather than from the tree, so
    anything the parser accepts but the tree does not expose would be invisible
    to the table extraction that RLS and the denylist rely on, yet still be sent
    to the server verbatim. Accepting only constants keeps that from arising.

    Both sides have to be checked. Reading only the value left the key free to be
    anything at all: ``SETTINGS ((SELECT x FROM secret) = 1) SELECT a FROM t``
    was absorbed, re-emitted with the subquery intact, and reported one table.
    Databend happens to refuse a non-identifier key, but a guard that relies on
    the server to enforce what its own docstring promises is not a guard.

    A node that is not an assignment -- ``SETTINGS (foo)`` parses to a column --
    has neither a value nor a key to read, so it is rejected by the same check.
    """
    value = expression.expression
    if isinstance(value, exp.Neg):
        value = value.this

    return isinstance(expression.this, exp.Column) and isinstance(
        value, (exp.Literal, exp.Boolean, exp.Null)
    )


# Postgres's own rendering of a positional TRIM, kept for the branch below that
# still wants it.
_POSTGRES_TRIM = Postgres.Generator.TRANSFORMS[exp.Trim]


class Databend(Postgres):
    # Databend writes digit groups the way ClickHouse does. Without this the
    # tokenizer stops at the first underscore, so 1_000_000 parses as 1 followed
    # by an alias named _000_000 -- a literal silently reduced to a millionth of
    # itself, with no error anywhere.
    NUMBERS_CAN_BE_UNDERSCORE_SEPARATED = True

    class Tokenizer(Postgres.Tokenizer):
        # Databend accepts backtick-quoted identifiers as well as the
        # double-quoted form Postgres uses.
        IDENTIFIERS = ['"', "`"]

        # A backslash escapes inside both strings and identifiers, as it does in
        # ClickHouse. Postgres treats it as an ordinary character, so 'don't'
        # ends the string early and the remainder fails to tokenize at all --
        # a TokenError rather than a parse error, out of a very common spelling.
        STRING_ESCAPES = ["'", "\\"]
        IDENTIFIER_ESCAPES = ["\\"]

        # 0x1A is an integer in Databend, as the server confirms by returning 26.
        # Postgres reads x'1A' as a bit string, so leaving this alone changes the
        # literal's type as well as its spelling.
        HEX_STRINGS = [("0x", ""), ("0X", "")]

        # Two width spellings mean different things in the two dialects, and
        # both widen silently if left alone. Postgres reads INT8 as eight bytes
        # where Databend reads one, so CAST(300 AS INT8) -- which overflows on
        # the server -- would become CAST(300 AS BIGINT) and quietly succeed.
        # Postgres reads FLOAT as double precision where Databend reads it as
        # 32-bit. Confirmed with typeof() on the server; INT16/INT32/INT64
        # already agree.
        KEYWORDS = {
            **Postgres.Tokenizer.KEYWORDS,
            "INT8": TokenType.TINYINT,
            "FLOAT": TokenType.FLOAT,
            # Databend documents DIV alongside + - * / %. Postgres has no
            # such operator, so the expression failed to parse at all --
            # inside sanitize_clause, before the server ever saw it.
            "DIV": TokenType.DIV,
        }

    class Parser(Postgres.Parser):
        # Databend's colon reads a field out of a VARIANT, as Snowflake's does.
        # Postgres reads it as the start of a named bind parameter, so ``j:a``
        # became ``j AS %(a)s`` -- a pyformat placeholder on its way to a DBAPI,
        # which is a worse thing to emit than a syntax error.
        COLON_IS_VARIANT_EXTRACT = True

        # Postgres's table minus the names in LEFT_UNPARSED, which carries the
        # reason for each. Leaving a name out of the table keeps Databend's own
        # spelling intact through a round-trip, which is what Superset does with
        # every adhoc column and metric.
        FUNCTIONS: dict[str, t.Callable[..., exp.Expression]] = {
            key: value
            for key, value in {
                **Postgres.Parser.FUNCTIONS,
                "FORMATDATETIME": _date_format,
            }.items()
            if key not in LEFT_UNPARSED
        }

        def _parse_bracket_key_value(
            self, is_map: bool = False
        ) -> exp.Expression | None:
            """
            Read an object literal's key with ``:`` meaning key-value.

            Databend spells a path extraction ``v:a`` and an object literal
            ``{'k': 1}`` with the same character, and the extraction is resolved
            first, so the literal came back as
            ``STRUCT(JSON_PATH_QUERY_FIRST('k', '1'))`` -- an object rewritten
            into a lookup, which the server accepts and answers differently.

            Only the key is read with extraction disabled, so a value that is
            itself an extraction, ``{'k': v:a}``, still parses as one. Both forms
            were run against the server.
            """
            if not is_map:
                return super()._parse_bracket_key_value(is_map=is_map)

            self.COLON_IS_VARIANT_EXTRACT = False
            try:
                key = self._parse_alias(self._parse_disjunction(), explicit=True)
            finally:
                self.COLON_IS_VARIANT_EXTRACT = True

            return self._parse_slice(key)

        def _parse_function(
            self, *args: t.Any, **kwargs: t.Any
        ) -> exp.Expression | None:
            """
            Parse Databend's parametric aggregates, ``NAME(params)(args)``.

            Postgres has no such syntax, so the base parser reads the first list
            as the arguments and then takes the second for an alias:
            ``histogram(5)(a)`` becomes ``HISTOGRAM(5) AS (a)``, which the server
            rejects. The whole family is affected -- quantile, quantile_cont,
            quantile_disc, quantile_tdigest and histogram are all in the
            catalogue -- so this is handled by shape rather than by name, which
            also allows several parameters and several arguments.

            The trigger is the shape alone -- an anonymous call followed by a
            second parenthesised list -- so it is not confined to the select
            list. A column-alias list, ``FROM my_udtf(1) (a, b)``, has the same
            shape and is read the same way; that is not valid input to either
            dialect, and ``AS g(x)`` round-trips, so it is a note rather than a
            defect.

            The window clause is attached here as well. Only what this method
            returns is offered one, so building the aggregate and handing it
            straight back left ``quantile(0.5)(a) OVER (...)`` -- valid
            Databend -- failing to parse at all.
            """
            this = super()._parse_function(*args, **kwargs)

            if (
                isinstance(this, exp.Anonymous)
                and self._curr
                and self._curr.token_type == TokenType.L_PAREN
            ):
                aggregate = exp.ParameterizedAgg(
                    this=this.this,
                    expressions=self._parse_wrapped_csv(self._parse_lambda),
                    params=this.expressions,
                )
                return self._parse_window(aggregate)

            return this

        # Databend accepts ClickHouse's trailing ``SETTINGS k = v``.
        QUERY_MODIFIER_PARSERS = {
            **Postgres.Parser.QUERY_MODIFIER_PARSERS,
            TokenType.SETTINGS: lambda self: (
                "settings",
                self._advance() or self._parse_csv(self._parse_assignment),
            ),
        }

        def _starts_settings_clause(self) -> bool:
            """Whether the SETTINGS ahead opens a clause rather than being an alias."""
            if not self._curr or self._curr.token_type != TokenType.SETTINGS:
                return False
            return bool(
                self._index + 2 < len(self._tokens)
                and self._tokens[self._index + 2].token_type == TokenType.EQ
            )

        def _parse_table_alias(
            self, alias_tokens: t.Collection[TokenType] | None = None
        ) -> exp.TableAlias | None:
            # SETTINGS is both a clause keyword and an ordinary identifier, so
            # ``FROM t SETTINGS max_threads = 1`` and ``FROM t settings`` (a table
            # aliased ``settings``) both have to work. Look ahead for the ``=``
            # that only the clause has, the way the base parser disambiguates
            # LIMIT and OFFSET. Removing SETTINGS from ``TABLE_ALIAS_TOKENS``
            # instead would drop the alias silently and leave any reference to it
            # dangling.
            if self._starts_settings_clause():
                return None
            return super()._parse_table_alias(alias_tokens)

        def _parse_statement(self) -> exp.Expression | None:
            # Databend also accepts a *leading* ``SETTINGS (...)`` clause before
            # the statement -- e.g.
            # ``SETTINGS (max_execute_time_in_seconds=300) SELECT ...`` -- which no
            # built-in dialect parses. It is absorbed here and re-emitted verbatim
            # in ``Generator.generate``.
            settings = None
            if self._curr and self._curr.token_type == TokenType.SETTINGS:
                index = self._index
                start = self._curr
                self._advance()
                if self._curr and self._curr.token_type == TokenType.L_PAREN:
                    assignments = self._parse_wrapped_csv(self._parse_assignment)
                    if assignments and all(
                        _is_constant_assignment(assignment)
                        for assignment in assignments
                    ):
                        settings = self._find_sql(start, self._prev)
                    else:
                        self._retreat(index)
                else:
                    self._retreat(index)

            statement = super()._parse_statement()
            if settings and statement:
                statement.set("leading_settings", settings)
            return statement

    class Generator(Postgres.Generator):
        # Rendering flags where the two bases disagree and Databend follows
        # ClickHouse. Each was found by diffing the two generators rather than by
        # meeting the symptom: COPY INTO needs its INTO; COUNT(DISTINCT a, b)
        # is written
        # directly rather than through a CASE that also drops rows where either
        # column is null; ARRAY_LENGTH takes no dimension; MEDIAN exists.
        COPY_HAS_INTO_KEYWORD = True
        MULTI_ARG_DISTINCT = True
        ARRAY_SIZE_DIM_REQUIRED = False
        SUPPORTS_MEDIAN = True
        STRUCT_DELIMITER = ("(", ")")

        # Postgres renders these as spellings Databend's parser rejects, or as a
        # wider type than was written. Each replacement is a name the server
        # itself listed when asked for a bad one.
        TYPE_MAPPING = {
            **Postgres.Generator.TYPE_MAPPING,
            exp.DataType.Type.BINARY: "BINARY",
            exp.DataType.Type.VARBINARY: "VARBINARY",
            exp.DataType.Type.FLOAT: "FLOAT",
            exp.DataType.Type.TINYINT: "TINYINT",
        }

        # Postgres renames these to spellings Databend's catalogue does not have.
        # Each replacement was checked against a live Databend (Query v1.2.790).
        # Postgres has neither QUALIFY nor, in its own grammar, SEMI and ANTI
        # joins, so its exp.Select chain rewrites both away: QUALIFY into a
        # subquery carrying a generated _w column, which a SELECT * then lifts
        # into the result set, and SEMI/ANTI into WHERE EXISTS. Databend has all
        # three, and the base generator renders SEMI/ANTI natively once that
        # chain is gone, so the entry is dropped rather than trimmed.
        TRANSFORMS = {
            **{
                key: value
                for key, value in Postgres.Generator.TRANSFORMS.items()
                if key is not exp.Select
            },
            exp.AnyValue: rename_func("ANY"),
            # Databend writes an array literal [1, 2, 3]; ARRAY[1, 2, 3] is
            # Postgres-only and the server rejects it outright.
            exp.Array: lambda self, e: f"[{self.expressions(e, flat=True)}]",
            exp.ApproxDistinct: rename_func("APPROX_COUNT_DISTINCT"),
            exp.ArrayConcat: rename_func("ARRAY_CONCAT"),
            exp.ArrayContains: rename_func("ARRAY_CONTAINS"),
            # Postgres has no lambda, so it rewrites one into ARRAY(SELECT ... FROM
            # UNNEST(a) WHERE ...) -- and ARRAY_ANY is built out of this node, so it
            # inherited the subquery too. Databend takes the lambda as written.
            exp.ArrayFilter: rename_func("ARRAY_FILTER"),
            exp.ArrayIntersect: rename_func("ARRAY_INTERSECTION"),
            exp.CurrentDate: rename_func("TODAY"),
            # Databend has COUNT_IF. Postgres does not, and expands it to
            # SUM(CASE WHEN ... THEN 1 ELSE 0 END), which is not the same
            # aggregate: over no matching rows COUNT_IF answers 0 and the SUM
            # answers NULL, so a chart that read zero starts reading blank.
            exp.CountIf: rename_func("COUNT_IF"),
            exp.DayOfMonth: rename_func("DAYOFMONTH"),
            exp.DayOfWeek: rename_func("DAYOFWEEK"),
            exp.DayOfYear: rename_func("DAYOFYEAR"),
            # DIV is an operator in Databend, not a callable: DIV(7, 2) is
            # answered with "missing lhs or rhs for the binary operator".
            exp.ILike: _ilike,
            exp.IntDiv: lambda self, e: (
                f"{self.sql(e, 'this')} DIV {self.sql(e, 'expression')}"
            ),
            exp.JSONExtract: _json_extract,
            exp.JSONExtractScalar: _json_extract,
            exp.ParameterizedAgg: lambda self, e: (
                f"{e.this}({self.expressions(e, key='params', flat=True)})"
                f"({self.expressions(e, flat=True)})"
            ),
            exp.Rand: rename_func("RAND"),
            exp.RegexpLike: rename_func("REGEXP_LIKE"),
            # Postgres spells these as the ~ and ~* operators, neither of
            # which Databend has; its REGEXP_LIKE takes the flags instead.
            exp.RegexpILike: lambda self, e: self.func(
                "REGEXP_LIKE", e.this, e.expression, exp.Literal.string("i")
            ),
            exp.SHA2: _sha2,
            exp.Struct: _struct,
            # Postgres has no TRY_CAST and degrades it to CAST, turning a
            # column that returned NULLs into one that raises. Databend has
            # try_cast.
            exp.TryCast: lambda self, e: self.cast_sql(e, safe_prefix="TRY_"),
            # Databend takes TRIM(x, chars) or a direction keyword, and rejects
            # the bare TRIM(chars FROM x) that Postgres emits for the two-argument
            # call: "unexpected `FROM`". LEADING, TRAILING and BOTH are accepted as
            # Postgres already writes them, so those are handed back to it rather
            # than rewritten.
            exp.Trim: lambda self, e: (
                self.func("TRIM", e.this, e.expression)
                if e.expression and not e.args.get("position")
                else _POSTGRES_TRIM(self, e)
            ),
            exp.WeekOfYear: rename_func("WEEKOFYEAR"),
        }

        def parameter_sql(self, expression: exp.Parameter) -> str:
            """
            Tell Databend's two prefixes apart: ``@stage`` and ``$1``.

            ``@name`` addresses a stage and ``$n`` is a positional column
            reference -- the documented way to read a staged file,
            ``SELECT $1, $2 FROM @mystage``. Postgres renders both with
            ``$`` and ClickHouse both with ``@``, so either single token turns one
            into the other, and ``@1`` is a string constant on the server: picking
            ``@`` returned constants where the user asked for columns, with no
            error anywhere. The parse already separates them -- a positional
            reference holds a literal, a stage holds a var -- so the prefix is
            taken from that rather than fixed.
            """
            prefix = "$" if isinstance(expression.this, exp.Literal) else "@"
            return f"{prefix}{self.sql(expression, 'this')}"

        def datatype_sql(self, expression: exp.DataType) -> str:
            """
            Render the container types the way Databend spells them.

            Postgres writes ``INT[]`` and ``MAP<TEXT, INT>``, which Databend
            rejects outright -- "unexpected `[`" and "unexpected `<`". Only the
            container is rewritten, so what comes out is ``ARRAY(INT)`` and
            ``MAP(TEXT, INT)``: the element types are left to the mapping above,
            and Databend accepts those spellings as aliases of its own INT32 and
            STRING. ARRAY and MAP are its headline complex types, and a cast to
            one is ordinary in an adhoc column.
            """
            if expression.expressions and expression.is_type(
                exp.DataType.Type.ARRAY, exp.DataType.Type.MAP
            ):
                name = "ARRAY" if expression.is_type(exp.DataType.Type.ARRAY) else "MAP"
                return f"{name}({self.expressions(expression, flat=True)})"

            return super().datatype_sql(expression)

        def after_limit_modifiers(self, expression: exp.Expression) -> list[str]:
            """Re-emit a trailing ``SETTINGS k = v`` absorbed by the parser."""
            modifiers = super().after_limit_modifiers(expression)
            if not expression.args.get("settings"):
                return modifiers

            return modifiers + [
                self.seg("SETTINGS ")
                + self.expressions(expression, key="settings", flat=True)
            ]

        def generate(self, expression: exp.Expression, copy: bool = True) -> str:
            # Re-emit the absorbed leading ``SETTINGS (...)`` at the statement
            # root, so it survives regardless of the root's type -- a bare
            # SELECT, a UNION, a parenthesized subquery, or a non-query
            # statement. ``select_sql`` alone would drop it on anything but a
            # plain SELECT.
            settings = (
                expression.args.get("leading_settings")
                if isinstance(expression, exp.Expression)
                else None
            )
            sql = super().generate(expression, copy=copy)
            return f"{settings} {sql}" if settings else sql
