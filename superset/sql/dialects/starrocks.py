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
StarRocks dialect for Superset, extending sqlglot's built-in StarRocks dialect.

sqlglot's StarRocks parser inherits almost all of its grammar from MySQL, which
doesn't model a long tail of StarRocks-only syntax: catalog-qualified schema
references, aggregate/primary-key column shorthand, admin/ops statements, and
several ALTER/CREATE/SHOW clause variants. Each override below closes one gap
found while auditing StarRocks' SQL reference against this dialect; see the
docstring on each method for the specific construct it fixes.

The Generator override closes a related gap: sqlglot's stock StarRocks
generator round-trips some of the AST shapes built above (REFRESH
CONNECTIONS, ALTER TABLE ADD ROLLUP, dual-bound range partitions, TIME_SLICE)
incorrectly. That matters beyond cosmetics -- SQL Lab regenerates SQL from
this AST via `format()` for every statement it executes, so an incorrect
round-trip sends malformed or semantically wrong SQL to the database.
"""

from __future__ import annotations

from sqlglot import exp
from sqlglot.dialects.starrocks import StarRocks as _StarRocks
from sqlglot.errors import ParseError
from sqlglot.generators.starrocks import StarRocksGenerator as _StarRocksGenerator
from sqlglot.helper import seq_get
from sqlglot.parsers.starrocks import StarRocksParser as _StarRocksParser
from sqlglot.tokens import TokenType

# Head keywords for StarRocks statements that sqlglot's MySQL-derived grammar
# doesn't model at all (no dedicated TokenType, no STATEMENT_PARSERS entry).
# Without this, the parser tries to read them as a generic expression/alias
# and raises a ParseError. Mapping them to TokenType.COMMAND opts them into
# the same generic "slurp the rest of the statement as an opaque command"
# fallback already used by CALL/EXPLAIN/OPTIMIZE/PREPARE/VACUUM, producing a
# structured-enough `exp.Command` instead of crashing. This is safe only for
# words that have no other meaning elsewhere in the grammar -- ADD and DELETE
# are handled separately below because they're already meaningful keywords.
_STARROCKS_COMMAND_KEYWORDS = (
    "ADMIN",
    "BACKUP",
    "RESTORE",
    "RECOVER",
    "CANCEL",
    "EXPORT",
    "SUBMIT",
    "PAUSE",
    "RESUME",
    "STOP",
    "DEALLOCATE",
)

# Column-level aggregate-function markers on AGGREGATE KEY / UNIQUE KEY table
# columns, e.g. `v2 INT SUM`. See
# https://docs.starrocks.io/docs/table_design/table_types/aggregate_table/
_STARROCKS_AGGREGATE_COLUMN_CONSTRAINTS = (
    "SUM",
    "MAX",
    "MIN",
    "REPLACE",
    "REPLACE_IF_NOT_NULL",
    "BITMAP_UNION",
    "HLL_UNION",
)


class StarRocksMaterializedViewRefresh(exp.Refresh):
    """
    `REFRESH MATERIALIZED VIEW mv [PARTITION START (...) END (...)] [FORCE]
    [WITH {SYNC|ASYNC} MODE]` -- sqlglot's generic `exp.Refresh(this, kind)`
    shape has no room for these StarRocks-only clauses, so the base parser
    only consumes (without modeling) them; a subclass with its own args is
    used instead of adding to `exp.Refresh` directly, since Superset can't
    change the arg_types of a class owned by the installed sqlglot package.
    https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/REFRESH_MATERIALIZED_VIEW/
    """

    arg_types = {
        **exp.Refresh.arg_types,
        "force": False,
        "partition_start": False,
        "partition_end": False,
        "mode": False,
    }


class StarRocksParser(_StarRocksParser):
    # StarRocks accepts a bare `AS <expr>` generated-column definition, not
    # just the parenthesized `AS (<expr>)` form MySQL requires.
    # https://docs.starrocks.io/docs/sql-reference/sql-statements/generated_columns/
    WRAPPED_TRANSFORM_COLUMN_CONSTRAINT = False

    FUNCTIONS = {
        **_StarRocksParser.FUNCTIONS,
        # StarRocks' 2-arg `time_slice(dt, INTERVAL n unit [, boundary])` packs
        # the interval into a single argument, unlike sqlglot's generic
        # TimeSlice(this, expression, unit, kind) shape, which expects the
        # numeric amount and unit as separate positional arguments.
        "TIME_SLICE": lambda args: exp.TimeSlice(
            this=seq_get(args, 0),
            expression=seq_get(args, 1).this
            if isinstance(seq_get(args, 1), exp.Interval)
            else seq_get(args, 1),
            unit=seq_get(args, 1).args.get("unit")
            if isinstance(seq_get(args, 1), exp.Interval)
            else seq_get(args, 2),
            kind=seq_get(args, 2)
            if isinstance(seq_get(args, 1), exp.Interval)
            else seq_get(args, 3),
        ),
    }

    CONSTRAINT_PARSERS = {
        **_StarRocksParser.CONSTRAINT_PARSERS,
        **{
            keyword: (lambda keyword: lambda self: exp.var(keyword))(keyword)
            for keyword in _STARROCKS_AGGREGATE_COLUMN_CONSTRAINTS
        },
        # Overrides MySQL's "KEY" (always a named inline secondary index) to
        # also accept StarRocks' bare `KEY` column attribute, which marks the
        # column as part of the primary/duplicate key with no name or column
        # list, e.g. `ADD COLUMN c INT KEY DEFAULT '0' FIRST`.
        "KEY": lambda self: self._parse_starrocks_key_constraint(),
    }

    def _parse_starrocks_key_constraint(self) -> exp.Expr:
        index = self._index

        is_index_def = self._match(TokenType.L_PAREN, advance=False)
        if not is_index_def and self._match_set(self.ID_VAR_TOKENS, advance=False):
            self._advance()
            self._match(TokenType.USING) and self._advance_any()
            is_index_def = self._match(TokenType.L_PAREN, advance=False)
            self._retreat(index)

        if is_index_def:
            return self._parse_index_constraint()

        return exp.var("KEY")

    def _parse_kill(self) -> exp.Kill:
        # StarRocks additionally supports `KILL ANALYZE <task_id>` to cancel a
        # running ANALYZE job, alongside MySQL's CONNECTION/QUERY forms.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/cbo_stats/KILL_ANALYZE/
        kind = (
            exp.var(self._prev.text)
            if self._match_texts(("CONNECTION", "QUERY", "ANALYZE"))
            else None
        )
        return self.expression(exp.Kill(this=self._parse_primary(), kind=kind))

    def _parse_refresh(self) -> exp.Refresh | exp.Command:
        # Extends sqlglot's generic REFRESH (EXTERNAL TABLE | TABLE |
        # MATERIALIZED VIEW) with StarRocks' DICTIONARY and CONNECTIONS forms,
        # and models the optional FORCE / PARTITION START(...) END(...) /
        # WITH {SYNC|ASYNC} MODE clauses on REFRESH MATERIALIZED VIEW via
        # `StarRocksMaterializedViewRefresh`'s dedicated args, rather than
        # just consuming them, so a regenerated statement doesn't silently
        # drop them. Only the MATERIALIZED VIEW target is parsed with
        # `_parse_table_parts` instead of `_parse_table`: the latter also
        # tries to parse a trailing `FORCE`/`PARTITION` as a MySQL index
        # hint and raises before this method ever sees those tokens, whereas
        # REFRESH EXTERNAL TABLE's own `PARTITION(...)` clause is meant to be
        # parsed by `_parse_table` as usual.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/REFRESH_MATERIALIZED_VIEW/
        if self._match_text_seq("DICTIONARY"):
            return self.expression(
                exp.Refresh(this=self._parse_table_parts(), kind="DICTIONARY")
            )
        if self._match_text_seq("CONNECTIONS"):
            return self.expression(
                exp.Refresh(this=exp.var("CONNECTIONS"), kind="CONNECTIONS")
            )

        if self._match_text_seq("EXTERNAL", "TABLE"):
            kind = "EXTERNAL TABLE"
        elif self._match(TokenType.TABLE):
            kind = "TABLE"
        elif self._match_text_seq("MATERIALIZED", "VIEW"):
            kind = "MATERIALIZED VIEW"
        else:
            kind = ""

        if kind == "MATERIALIZED VIEW":
            this = self._parse_string() or self._parse_table_parts()
        else:
            this = self._parse_string() or self._parse_table()

        if not kind and not isinstance(this, exp.Literal):
            return self._parse_as_command(self._prev)

        if kind != "MATERIALIZED VIEW":
            return self.expression(exp.Refresh(this=this, kind=kind))

        return self.expression(
            self._parse_materialized_view_refresh_clauses(this, kind)
        )

    def _parse_materialized_view_refresh_clauses(
        self, this: exp.Expr | None, kind: str
    ) -> StarRocksMaterializedViewRefresh:
        force = self._match_text_seq("FORCE")
        partition_start = None
        partition_end = None
        if self._match_text_seq("PARTITION", "START"):
            partition_start = self._parse_wrapped(self._parse_string)
            self._match_text_seq("END")
            partition_end = self._parse_wrapped(self._parse_string)
            force = self._match_text_seq("FORCE") or force

        mode = None
        if self._match_text_seq("WITH"):
            mode = self._match_texts(("SYNC", "ASYNC")) and self._prev.text.upper()
            self._match_text_seq("MODE")

        return StarRocksMaterializedViewRefresh(
            this=this,
            kind=kind,
            force=force or None,
            partition_start=partition_start,
            partition_end=partition_end,
            mode=mode,
        )

    def _parse_show_mysql(
        self,
        this: str,
        target: bool | str = False,
        full: bool | None = None,
        global_: bool | None = None,
    ) -> exp.Show:
        json = self._match_text_seq("JSON")

        if target:
            if isinstance(target, str):
                self._match_text_seq(*target.split(" "))
            target_id = self._parse_id_var()
        else:
            target_id = None

        index = self._index
        if self._match_text_seq("IN"):
            log = self._parse_string()
            if log is None:
                self._retreat(index)
        else:
            log = None

        if this in ("BINLOG EVENTS", "RELAYLOG EVENTS"):
            position = self._parse_number() if self._match_text_seq("FROM") else None
            db = None
        else:
            position = None
            db = None

            if self._match(TokenType.FROM) or self._match_text_seq("IN"):
                db = self._parse_table_parts(is_db_reference=True)
            elif self._match(TokenType.DOT):
                db = target_id
                target_id = self._parse_id_var()

        # `SHOW CREATE FUNCTION`/`SHOW CREATE PROCEDURE` require a
        # parenthesized argument-type list to disambiguate overloads,
        # e.g. `SHOW CREATE FUNCTION db.my_add(BIGINT)`.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/Function/SHOW_CREATE_FUNCTION/
        if this in ("CREATE FUNCTION", "CREATE PROCEDURE") and self._match(
            TokenType.L_PAREN, advance=False
        ):
            self._parse_wrapped_csv(self._parse_types)

        channel = (
            self._parse_id_var() if self._match_text_seq("FOR", "CHANNEL") else None
        )

        like = self._parse_string() if self._match_text_seq("LIKE") else None
        where = self._parse_where()

        if this == "PROFILE":
            types = self._parse_csv(
                lambda: self._parse_var_from_options(self.PROFILE_TYPES)
            )
            query = (
                self._parse_number() if self._match_text_seq("FOR", "QUERY") else None
            )
            offset = self._parse_number() if self._match_text_seq("OFFSET") else None
            limit = self._parse_number() if self._match_text_seq("LIMIT") else None
        else:
            types, query = None, None
            offset, limit = self._parse_oldstyle_limit()

        mutex = True if self._match_text_seq("MUTEX") else None
        mutex = False if self._match_text_seq("STATUS") else mutex

        for_table = (
            self._parse_id_var() if self._match_text_seq("FOR", "TABLE") else None
        )
        for_group = (
            self._parse_string() if self._match_text_seq("FOR", "GROUP") else None
        )
        for_user = self._parse_string() if self._match_text_seq("FOR", "USER") else None
        for_role = self._parse_string() if self._match_text_seq("FOR", "ROLE") else None
        into_outfile = (
            self._parse_string() if self._match_text_seq("INTO", "OUTFILE") else None
        )

        return self.expression(
            exp.Show(
                this=this,
                target=target_id,
                full=full,
                log=log,
                position=position,
                db=db,
                channel=channel,
                like=like,
                where=where,
                types=types,
                query=query,
                offset=offset,
                limit=limit,
                mutex=mutex,
                for_table=for_table,
                for_group=for_group,
                for_user=for_user,
                for_role=for_role,
                into_outfile=into_outfile,
                json=json,
                global_=global_,
            )
        )

    def _parse_index_constraint(  # noqa: C901
        self, kind: str | None = None
    ) -> exp.IndexColumnConstraint:
        if kind:
            self._match_texts(("INDEX", "KEY"))

        this = self._parse_id_var(any_token=False)
        index_type = (
            self._match(TokenType.USING) and self._advance_any() and self._prev.text
        )
        expressions = self._parse_wrapped_csv(self._parse_ordered)

        options = []
        while True:
            if self._match_text_seq("KEY_BLOCK_SIZE"):
                self._match(TokenType.EQ)
                opt = exp.IndexConstraintOption(key_block_size=self._parse_number())
            elif self._match(TokenType.USING):
                opt = exp.IndexConstraintOption(
                    using=self._advance_any() and self._prev.text
                )
                # StarRocks' GIN/NGRAM full-text indexes take an inline
                # properties list after the index type, which MySQL's
                # grammar doesn't expect: `USING GIN ('parser' = 'english')`.
                # https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/CREATE_INDEX/
                if self._match(TokenType.L_PAREN, advance=False):
                    self._parse_wrapped_properties()
            elif self._match_text_seq("WITH", "PARSER"):
                opt = exp.IndexConstraintOption(parser=self._parse_var(any_token=True))
            elif self._match(TokenType.COMMENT):
                opt = exp.IndexConstraintOption(comment=self._parse_string())
            elif self._match_text_seq("VISIBLE"):
                opt = exp.IndexConstraintOption(visible=True)
            elif self._match_text_seq("INVISIBLE"):
                opt = exp.IndexConstraintOption(visible=False)
            elif self._match_text_seq("ENGINE_ATTRIBUTE"):
                self._match(TokenType.EQ)
                opt = exp.IndexConstraintOption(engine_attr=self._parse_string())
            elif self._match_text_seq("SECONDARY_ENGINE_ATTRIBUTE"):
                self._match(TokenType.EQ)
                opt = exp.IndexConstraintOption(
                    secondary_engine_attr=self._parse_string()
                )
            else:
                opt = None

            if not opt:
                break

            options.append(opt)

        return self.expression(
            exp.IndexColumnConstraint(
                this=this,
                expressions=expressions,
                kind=kind,
                index_type=index_type,
                options=options,
            )
        )

    def _parse_drop(self, exists: bool = False) -> exp.Drop | exp.Command:
        start = self._prev
        temporary = self._match(TokenType.TEMPORARY)
        materialized = self._match_text_seq("MATERIALIZED")
        iceberg = self._match_text_seq("ICEBERG")

        kind = self._match_set(self.CREATABLES) and self._prev.text.upper()
        if not kind or (iceberg and kind and kind != "TABLE"):
            return self._parse_as_command(start)

        concurrently = self._match_text_seq("CONCURRENTLY")
        if_exists = exists or self._parse_exists()

        if kind == "COLUMN":
            this = self._parse_column()
        else:
            this = self._parse_table_parts(
                schema=True, is_db_reference=kind == "SCHEMA"
            )

        if kind == "INDEX" and self._match(TokenType.ON):
            # MySQL's grammar treats `ON` after DROP INDEX as an "ON CLUSTER"
            # style property (a bare id, optionally with a column list), but
            # StarRocks' `DROP INDEX idx ON db.table` names a dotted table.
            # https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/DROP_INDEX/
            cluster = self.expression(exp.OnProperty(this=self._parse_table_parts()))
        else:
            cluster = self._parse_on_property() if self._match(TokenType.ON) else None

        if self._match(TokenType.L_PAREN, advance=False):
            expressions = self._parse_wrapped_csv(self._parse_types)
        else:
            expressions = None

        cascade_or_restrict = (
            self._match_texts(("CASCADE", "RESTRICT")) and self._prev.text.upper()
        )

        return self.expression(
            exp.Drop(
                exists=if_exists,
                this=this,
                expressions=expressions,
                kind=self.dialect.CREATABLE_KIND_MAPPING.get(kind) or kind,
                temporary=temporary,
                materialized=materialized,
                cascade=cascade_or_restrict == "CASCADE",
                restrict=cascade_or_restrict == "RESTRICT",
                constraints=self._match_text_seq("CONSTRAINTS"),
                purge=self._match_text_seq("PURGE"),
                cluster=cluster,
                concurrently=concurrently,
                sync=self._match_text_seq("SYNC"),
                iceberg=iceberg,
                force=self._match_text_seq("FORCE"),
            )
        )

    def _parse_delete(self) -> exp.Delete:
        # `DELETE FROM t PARTITION p1 WHERE ...` -- StarRocks allows scoping a
        # DELETE to a partition, which the base parser's DELETE target
        # doesn't request (unlike ALTER TABLE, it doesn't pass
        # parse_partition=True).
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/data-manipulation/DELETE/
        hint = self._parse_hint()

        tables = None
        if not self._match(TokenType.FROM, advance=False):
            tables = self._parse_csv(self._parse_table) or None

        returning = self._parse_returning()

        return self.expression(
            exp.Delete(
                hint=hint,
                tables=tables,
                this=self._match(TokenType.FROM)
                and self._parse_table(joins=True, parse_partition=True),
                using=self._match(TokenType.USING)
                and self._parse_csv(lambda: self._parse_table(joins=True)),
                cluster=self._match(TokenType.ON) and self._parse_on_property(),
                where=self._parse_where(),
                returning=returning or self._parse_returning(),
                order=self._parse_order(),
                limit=self._parse_limit(),
            )
        )

    def _parse_insert_table(self) -> exp.Expr | None:
        # StarRocks' `WITH LABEL <name>` names the load job for an INSERT and
        # can appear before an explicit target column list, which the base
        # parser doesn't expect anywhere in the INSERT grammar:
        #   INSERT OVERWRITE t PARTITION(p1) WITH LABEL `l1` SELECT ...
        #   INSERT OVERWRITE t WITH LABEL `l1` (c1, c2) SELECT ...
        # `schema=True` (the base default) is tried first since it already
        # correctly resolves the common `t (c1, c2)` column-list form; it
        # only fails for a table-function target like `INSERT INTO
        # FILES(...)`, whose key=value call arguments don't fit a
        # column-schema list. That's caught and retried with schema=False,
        # parsing the target the same way a FROM-clause table reference
        # would.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/loading_unloading/INSERT/
        index = self._index
        try:
            this = self._parse_table(schema=True, parse_partition=True)
        except ParseError:
            self._retreat(index)
            this = self._parse_table(schema=False, parse_partition=True)

        # Unlike a FROM-clause table reference, `schema=True` doesn't parse a
        # trailing alias itself (it would be ambiguous with the column-schema
        # list), so it's handled explicitly here instead.
        if isinstance(this, exp.Table) and self._match(TokenType.ALIAS, advance=False):
            this.set("alias", self._parse_table_alias())

        if self._match_text_seq("WITH", "LABEL"):
            self._parse_id_var()

        if isinstance(this, exp.Table) and self._match(
            TokenType.L_PAREN, advance=False
        ):
            columns = self._parse_wrapped_id_vars()
            this = self.expression(exp.Schema(this=this, expressions=columns))

        return this

    def _parse_alter_table_add(self) -> list[exp.Expr]:
        # `ALTER TABLE t ADD ROLLUP r1(col1, col2) [FROM base_index] [PROPERTIES (...)]`
        # is a distinct ALTER action from the CREATE-TABLE-level ROLLUP
        # property (already handled by `_parse_rollup_property`).
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/ALTER_TABLE/#rollup
        if self._match_text_seq("ROLLUP"):
            return self._parse_csv(self._parse_add_rollup_index)

        # StarRocks accepts a parenthesized multi-column list after the
        # singular `ADD COLUMN` (MySQL requires the plural `ADD COLUMNS` for
        # that form): `ADD COLUMN (c1 INT DEFAULT '0', c2 INT DEFAULT '0')`.
        index = self._index
        if self._match_text_seq("COLUMN") and self._match(
            TokenType.L_PAREN, advance=False
        ):
            schema = self._parse_schema()
            if schema:
                return [schema]
        self._retreat(index)

        return super()._parse_alter_table_add()

    def _parse_add_rollup_index(self) -> exp.RollupIndex:
        return self.expression(
            exp.RollupIndex(
                this=self._parse_id_var(),
                expressions=self._parse_wrapped_id_vars(),
                from_index=self._parse_id_var()
                if self._match_text_seq("FROM")
                else None,
                properties=self.expression(
                    exp.Properties(expressions=self._parse_wrapped_properties())
                )
                if self._match_text_seq("PROPERTIES")
                else None,
            )
        )

    def _parse_partition(self) -> exp.Partition | None:
        # `ALTER TABLE t DROP PARTITION p1` / `DELETE FROM t PARTITION p1 ...`
        # -- StarRocks also accepts a bare, unparenthesized single partition
        # name, not just the parenthesized `PARTITION (p1, p2)` list form.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/ALTER_TABLE/#drop-partition
        if not self._match_texts(self.PARTITION_KEYWORDS):
            return None

        subpartition = self._prev.text.upper() == "SUBPARTITION"

        if self._match(TokenType.L_PAREN, advance=False):
            expressions = self._parse_wrapped_csv(self._parse_disjunction)
        else:
            expressions = [self._parse_disjunction()]

        return self.expression(
            exp.Partition(subpartition=subpartition, expressions=expressions)
        )

    def _parse_partition_range_value(self) -> exp.Expr | None:
        self._match_text_seq("PARTITION")
        name = self._parse_id_var()

        if self._match_text_seq("VALUES", "LESS", "THAN"):
            if self._match_text_seq("MAXVALUE"):
                values: list[exp.Expr] = [exp.var("MAXVALUE")]
            else:
                values = self._parse_wrapped_csv(self._parse_expression)
                if (
                    len(values) == 1
                    and isinstance(values[0], exp.Column)
                    and values[0].name.upper() == "MAXVALUE"
                ):
                    values = [exp.var("MAXVALUE")]

            part_range = self.expression(
                exp.PartitionRange(this=name, expressions=values)
            )
            return self.expression(exp.Partition(expressions=[part_range]))

        if self._match_text_seq("VALUES") and self._match(TokenType.L_BRACKET):
            # Dual-bound range partition, e.g.
            # `PARTITION p1 VALUES [("2021-01-01"), ("2021-01-31"))` -- the
            # mismatched `[ ... )` denotes an inclusive-lower/exclusive-upper
            # bound; both bounds are still ordinary parenthesized tuples.
            # https://docs.starrocks.io/docs/table_design/data_distribution/#range-partitioning
            lower = self._parse_wrapped_csv(self._parse_expression)
            self._match(TokenType.COMMA)
            upper = self._parse_wrapped_csv(self._parse_expression)
            self._match(TokenType.R_PAREN)
            part_range = self.expression(
                exp.PartitionRange(
                    this=name,
                    expressions=[
                        exp.Tuple(expressions=lower),
                        exp.Tuple(expressions=upper),
                    ],
                )
            )
            return self.expression(exp.Partition(expressions=[part_range]))

        return name

    def _parse_refresh_property(self) -> exp.RefreshTriggerProperty:
        method = (
            self._match_texts(("DEFERRED", "IMMEDIATE")) and self._prev.text.upper()
        )
        # StarRocks also allows a cron-style `SCHEDULE START (...) EVERY (...)`
        # trigger alongside ASYNC/MANUAL; the START/EVERY clauses below are
        # already parsed unconditionally, so recognizing the keyword is
        # enough to keep the rest of the CREATE MATERIALIZED VIEW parseable.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/CREATE_MATERIALIZED_VIEW/
        kind = (
            self._match_texts(("ASYNC", "MANUAL", "SCHEDULE"))
            and self._prev.text.upper()
        )
        start = self._match_text_seq("START") and self._parse_wrapped(
            self._parse_string
        )
        if self._match_text_seq("EVERY"):
            self._match_l_paren()
            self._match_text_seq("INTERVAL")
            every = self._parse_number()
            unit = self._parse_var(any_token=True)
            self._match_r_paren()
        else:
            every = None
            unit = None
        return self.expression(
            exp.RefreshTriggerProperty(
                method=method, kind=kind, starts=start, every=every, unit=unit
            )
        )

    def _parse_statement(self) -> exp.Expr | None:
        # `ADD SQLBLACKLIST|BACKEND BLACKLIST|COMPUTE NODE BLACKLIST` and the
        # matching `DELETE ...` forms manage cluster-wide denylists. ADD and
        # DELETE already have dedicated meanings elsewhere in the grammar
        # (ALTER TABLE ADD ..., the DML DELETE statement), so -- unlike the
        # keywords in _STARROCKS_COMMAND_KEYWORDS -- they can't be remapped to
        # TokenType.COMMAND outright; this peeks for the specific StarRocks
        # phrasing instead and only then treats it as an opaque command.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/cluster-management/sql_blacklist/
        # https://docs.starrocks.io/docs/administration/management/BE_blacklist/
        if self._match_texts(("ADD", "DELETE"), advance=False):
            index = self._index
            start = self._curr
            self._advance()
            is_blacklist_command = (
                self._match_text_seq("SQLBLACKLIST")
                or self._match_text_seq("BACKEND", "BLACKLIST")
                or self._match_text_seq("COMPUTE", "NODE", "BLACKLIST")
            )
            self._retreat(index)

            if is_blacklist_command:
                self._advance()
                return self._parse_as_command(start)

        # `TRANSLATE TRINO <select_statement>` translates a Trino SELECT into
        # StarRocks SQL and returns it as a result set -- a read, not a
        # mutation. Like ADD/DELETE above, this can't be remapped to
        # TokenType.COMMAND outright: TRANSLATE is also the ordinary
        # TRANSLATE(string, from, to) scalar function, and mapping the
        # keyword globally would corrupt every call to it anywhere in a
        # query, not just at statement start. Peeking for the literal
        # two-word phrase is safe because a bare `TRANSLATE(...)` call can
        # never be the first token of a top-level statement on its own --
        # it only ever appears nested inside an expression.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/TRANSLATE_TRINO/
        if self._match_text_seq("TRANSLATE", "TRINO", advance=False):
            return self._parse_as_command(self._curr)

        return super()._parse_statement()


class StarRocksGenerator(_StarRocksGenerator):
    # sqlglot's SQLStatement.format()/SQLScript.format() -- used both for
    # SQL Lab's Jinja-template-comment-stripping validation step and, for
    # every engine, to build the actual statement text sent to the DB-API
    # cursor -- regenerate SQL from the AST built by `StarRocksParser`
    # above. The overrides below fix five constructs the parser produces an
    # AST for that sqlglot's stock StarRocks generator round-trips
    # incorrectly, which would otherwise send malformed or semantically
    # wrong SQL to StarRocks for anything routed through SQL Lab.

    TRANSFORMS = {
        **_StarRocksGenerator.TRANSFORMS,
        # `StarRocksMaterializedViewRefresh` isn't registered under sqlglot's
        # own class-name-to-method dispatch convention (it isn't a class
        # sqlglot itself defines), so it's routed to `refresh_sql` below
        # explicitly.
        StarRocksMaterializedViewRefresh: lambda self, e: self.refresh_sql(e),
    }

    def refresh_sql(self, expression: exp.Refresh) -> str:
        # `REFRESH CONNECTIONS` has no separate target name -- `this` is only
        # set (to a placeholder Var) because the base Refresh expression
        # requires it -- so the generic `REFRESH {kind} {this}` rendering
        # would otherwise duplicate the word twice.
        if expression.args.get("kind") == "CONNECTIONS":
            return "REFRESH CONNECTIONS"

        sql = super().refresh_sql(expression)

        # REFRESH MATERIALIZED VIEW's own FORCE / PARTITION START(...)
        # END(...) / WITH {SYNC|ASYNC} MODE clauses, set by `_parse_refresh`
        # on a `StarRocksMaterializedViewRefresh`. FORCE always renders after
        # PARTITION, regardless of which side of the partition clause it
        # appeared on in the source -- StarRocks accepts either position,
        # but only one is worth preserving.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/REFRESH_MATERIALIZED_VIEW/
        partition_start = expression.args.get("partition_start")
        partition_end = expression.args.get("partition_end")
        if partition_start and partition_end:
            sql += (
                f" PARTITION START ({self.sql(partition_start)}) "
                f"END ({self.sql(partition_end)})"
            )

        if expression.args.get("force"):
            sql += " FORCE"

        if mode := expression.args.get("mode"):
            sql += f" WITH {mode} MODE"

        return sql

    def rollupindex_sql(self, expression: exp.RollupIndex) -> str:
        sql = super().rollupindex_sql(expression)
        # As a standalone `ALTER TABLE ... ADD ROLLUP r1(...)` action (as
        # opposed to an item inside a CREATE TABLE ROLLUP (...) property
        # list), the ADD ROLLUP keywords live on the RollupIndex node itself
        # rather than being added by the enclosing property/action.
        # https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/ALTER_TABLE/#rollup
        if isinstance(expression.parent, exp.Alter):
            return f"ADD ROLLUP {sql}"
        return sql

    def partitionrange_sql(self, expression: exp.PartitionRange) -> str:
        # Dual-bound `VALUES [(...), (...))` range partition -- `expressions`
        # holds exactly the two bound tuples built by
        # `_parse_partition_range_value` above.
        # https://docs.starrocks.io/docs/table_design/data_distribution/#range-partitioning
        name = self.sql(expression, "this")
        values = expression.expressions

        if (
            len(values) == 2
            and isinstance(values[0], exp.Tuple)
            and isinstance(values[1], exp.Tuple)
        ):
            bounds = ", ".join(self.sql(v) for v in values)
            return f"PARTITION {name} VALUES [{bounds})"

        return super().partitionrange_sql(expression)

    def timeslice_sql(self, expression: exp.TimeSlice) -> str:
        # StarRocks' `time_slice(dt, INTERVAL n unit [, boundary])` packs the
        # amount/unit into a single INTERVAL argument, unlike the generic
        # TimeSlice(this, expression, unit, kind) shape's separate positional
        # this/expression/unit/kind arguments.
        # https://docs.starrocks.io/docs/sql-reference/sql-functions/date-time-functions/time_slice/
        interval = exp.Interval(
            this=expression.args.get("expression"), unit=expression.args.get("unit")
        )
        args = [expression.this, interval]
        if kind := expression.args.get("kind"):
            args.append(kind)
        return self.func("TIME_SLICE", *args)


class StarRocks(_StarRocks):
    Parser = StarRocksParser
    Generator = StarRocksGenerator

    class Tokenizer(_StarRocks.Tokenizer):
        KEYWORDS = {
            **_StarRocks.Tokenizer.KEYWORDS,
            **dict.fromkeys(_STARROCKS_COMMAND_KEYWORDS, TokenType.COMMAND),
        }
