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
from collections.abc import Iterable
from sqlglot import exp, parse_one, parse, Dialects, ParseError
from sqlglot.optimizer.scope import traverse_scope, Scope, ScopeType


class Table:
    table: str
    schema: str | None = None
    catalog: str | None = None


def is_cte(source: exp.Table, scope: Scope) -> bool:
    parent_sources = scope.parent.sources if scope.parent else {}
    ctes_in_scope = {
        name
        for name, parent_scope in parent_sources.items()
        if isinstance(parent_scope, Scope) and parent_scope.scope_type == ScopeType.CTE
    }

    return source.name in ctes_in_scope


def extract_tables(sql, dialect: Dialects | None = None) -> list[Table]:
    statements = parse(sql, dialect=dialect)
    return [
        table
        for statement in statements
        for table in extract_tables_from_statement(statement, dialect)
    ]


def extract_tables_from_statement(
    statement: exp.Expression,
    dialect: Dialects | None,
) -> set[Table]:
    sources: Iterable[exp.Table]

    if isinstance(statement, exp.Describe):
        sources = statement.find_all(exp.Table)
    elif isinstance(statement, exp.Command):
        literal = statement.find(exp.Literal)
        if not literal:
            return set()

        try:
            pseudo_query = parse_one(f"SELECT {literal.this}", dialect=dialect)
        except ParseError:
            return set()
        sources = pseudo_query.find_all(exp.Table)
    else:
        sources = [
            source
            for scope in traverse_scope(statement)
            for source in scope.sources.values()
            if isinstance(source, exp.Table) and not is_cte(source, scope)
        ]

    return {
        Table(
            source.name,
            source.db if source.db != "" else None,
            source.catalog if source.catalog != "" else None,
        )
        for source in sources
    }
