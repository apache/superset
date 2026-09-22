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

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from superset.sql.parse import sanitize_clause

if TYPE_CHECKING:
    from superset.db_engine_specs.base import BaseEngineSpec


class CommentConversionError(ValueError):
    """The fast comment converter cannot safely rewrite an expression.

    Raised when :class:`SqlCommentConverter` meets input it will not rewrite in
    place -- a line comment that already contains a ``*/`` sequence, or an
    unterminated string/quoted/dollar region. It subclasses ``ValueError`` so
    existing ``pytest.raises(ValueError, ...)`` call sites keep matching, while
    letting ``normalize_custom_metric`` catch only this signal and defer to the
    slower SQLGlot-based sanitizer rather than swallowing unrelated errors.
    """


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
            raise CommentConversionError("Line comment cannot be converted safely")
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
            raise CommentConversionError(f"Unterminated SQL region: {delimiter}")
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
        raise CommentConversionError("Unterminated SQL string")


def normalize_custom_metric(
    expression: str,
    engine: str,
    db_engine_spec: type[BaseEngineSpec],
) -> NormalizedMetric:
    """
    Normalize custom metric SQL and determine whether source can be preserved.

    The engine spec decides both halves: ``normalize_custom_sql_metric`` rewrites
    the expression into the engine's canonical form, and
    ``preserves_custom_sql_metric_source`` declares whether that normalized text
    may be embedded verbatim (after comment conversion) instead of being
    re-rendered by ``sanitize_clause``. Keeping the policy on the spec means
    every engine that inherits the normalization hook inherits the matching
    source-preservation policy, rather than relying on a fixed list of engine
    names that subclasses can silently fall outside of.
    """
    normalized_expression = db_engine_spec.normalize_custom_sql_metric(expression)
    if not db_engine_spec.preserves_custom_sql_metric_source:
        return NormalizedMetric(normalized_expression, False)

    try:
        return SqlCommentConverter(normalized_expression).convert()
    except CommentConversionError:
        # The fast in-place converter bailed on an expression it cannot rewrite
        # safely (a ``*/`` inside a line comment, or an unterminated region). Fall
        # back to the SQLGlot-based sanitizer, which either re-renders the comments
        # into a safe form or raises QueryClauseValidationException for genuinely
        # invalid SQL -- so the failure is never swallowed, only the fast path is
        # given up. Source can no longer be preserved because it was re-rendered.
        return NormalizedMetric(
            sanitize_clause(normalized_expression, engine),
            False,
        )
