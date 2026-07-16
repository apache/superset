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

import re
from collections.abc import Callable
from dataclasses import dataclass

from superset.sql.parse import sanitize_clause

POSTGRES_FAMILY_ENGINES: frozenset[str] = frozenset(
    {"postgres", "postgresql", "redshift"}
)


@dataclass(frozen=True)
class NormalizedMetric:
    """A normalized metric expression and its source-preservation policy."""

    expression: str
    may_preserve_source: bool


class SqlCommentConverter:
    """Convert SQL line comments while preserving quoted regions verbatim."""

    def __init__(self, expression: str):
        self.expression = expression
        self.result: list[str] = []
        self.index = 0

    def convert(self) -> NormalizedMetric:
        while self.index < len(self.expression):
            if self._copy_block_comment():
                continue
            if self._convert_line_comment():
                continue
            if self._copy_quoted_region():
                continue
            self.result.append(self.expression[self.index])
            self.index += 1
        expression = "".join(self.result).rstrip().rstrip(";").rstrip()
        return NormalizedMetric(expression, True)

    def _copy_block_comment(self) -> bool:
        if not self.expression.startswith("/*", self.index):
            return False
        return self._copy_delimited_region("*/", self.index + 2)

    def _convert_line_comment(self) -> bool:
        if not self.expression.startswith("--", self.index):
            return False
        line_end = min(
            (
                position
                for separator in ("\n", "\r")
                if (position := self.expression.find(separator, self.index + 2)) >= 0
            ),
            default=len(self.expression),
        )
        contents = self.expression[self.index + 2 : line_end]
        if "*/" in contents:
            raise ValueError("Line comment cannot be converted safely")
        self.result.append(f"/*{contents} */")
        self.index = line_end
        return True

    def _copy_quoted_region(self) -> bool:
        if self.expression[self.index] in {"'", '"'}:
            return self._copy_string(self.expression[self.index])
        if self.expression[self.index] != "$":
            return False
        match = re.match(
            r"\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$",
            self.expression[self.index :],
        )
        return bool(
            match
            and self._copy_delimited_region(
                match.group(0), self.index + len(match.group(0))
            )
        )

    def _copy_delimited_region(self, delimiter: str, content_start: int) -> bool:
        end = self.expression.find(delimiter, content_start)
        if end < 0:
            raise ValueError(f"Unterminated SQL region: {delimiter}")
        region_end = end + len(delimiter)
        self.result.append(self.expression[self.index : region_end])
        self.index = region_end
        return True

    def _copy_string(self, quote: str) -> bool:
        backslash_escapes = (
            quote == "'"
            and self.index > 0
            and self.expression[self.index - 1] in {"E", "e"}
            and (self.index == 1 or not self.expression[self.index - 2].isalnum())
        )
        start = self.index
        self.index += 1
        while self.index < len(self.expression):
            character = self.expression[self.index]
            self.index += 1
            if (
                backslash_escapes
                and character == "\\"
                and self.index < len(self.expression)
            ):
                self.index += 1
            elif character == quote:
                if (
                    self.index < len(self.expression)
                    and self.expression[self.index] == quote
                ):
                    self.index += 1
                else:
                    self.result.append(self.expression[start : self.index])
                    return True
        raise ValueError("Unterminated SQL string")


def normalize_custom_metric(
    expression: str,
    engine: str,
    normalizer: Callable[[str], str],
) -> NormalizedMetric:
    """Normalize custom metric SQL and determine whether source can be preserved."""
    normalized_expression = normalizer(expression)
    if engine not in POSTGRES_FAMILY_ENGINES:
        return NormalizedMetric(normalized_expression, False)

    try:
        return SqlCommentConverter(normalized_expression).convert()
    except ValueError:
        return NormalizedMetric(
            sanitize_clause(normalized_expression, engine),
            False,
        )
