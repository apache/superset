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

from sqlglot import Tokenizer
from sqlglot.errors import TokenError
from sqlglot.tokens import Token, TokenType

_DATE_TRUNC_UNITS: frozenset[str] = frozenset(
    {"second", "minute", "hour", "day", "week", "month", "quarter", "year"}
)


def _is_unqualified_date_trunc(
    tokens: list[Token],
    index: int,
    function: Token,
    left_parenthesis: Token,
) -> bool:
    return (
        function.token_type is TokenType.VAR
        and function.text.upper() == "DATE_TRUNC"
        and (index == 0 or tokens[index - 1].token_type is not TokenType.DOT)
        and left_parenthesis.token_type is TokenType.L_PAREN
    )


def _normalized_date_trunc_unit(
    expression: str,
    tokens: list[Token],
    index: int,
) -> tuple[int, int, str] | None:
    function, left_parenthesis, unit = tokens[index : index + 3]
    normalized_unit = unit.text.lower()
    raw_literal = expression[unit.start : unit.end + 1]
    if (
        _is_unqualified_date_trunc(tokens, index, function, left_parenthesis)
        and unit.token_type is TokenType.STRING
        and normalized_unit in _DATE_TRUNC_UNITS
        and raw_literal == f"'{unit.text}'"
        and normalized_unit != unit.text
    ):
        return unit.start + 1, unit.end, normalized_unit
    return None


def normalize_date_trunc_units(expression: str) -> str:
    """Lowercase PostgreSQL DATE_TRUNC unit literals without regenerating SQL."""
    try:
        tokens = Tokenizer(dialect="postgres").tokenize(expression)
    except TokenError:
        return expression

    replacements = [
        replacement
        for index in range(len(tokens) - 2)
        if (replacement := _normalized_date_trunc_unit(expression, tokens, index))
    ]
    for start, end, normalized_unit in reversed(replacements):
        expression = f"{expression[:start]}{normalized_unit}{expression[end:]}"
    return expression
