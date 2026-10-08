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

"""Portable, diagnostic-free signals for deliberate provider query rejection."""

from enum import Enum


class SemanticQueryErrorCode(str, Enum):
    """Finite validation categories; presentation belongs to the consuming host."""

    UNSUPPORTED_QUERY = "UNSUPPORTED_QUERY"
    UNSUPPORTED_OFFSET = "UNSUPPORTED_OFFSET"
    INVALID_FILTER = "INVALID_FILTER"
    INVALID_QUERY = "INVALID_QUERY"


class SemanticQueryRejectedError(Exception):
    """Reject query input without exporting provider diagnostics to consumers."""

    def __init__(
        self, code: SemanticQueryErrorCode | str = SemanticQueryErrorCode.INVALID_QUERY
    ) -> None:
        self.code: SemanticQueryErrorCode
        try:
            self.code = SemanticQueryErrorCode(code)
        except ValueError:
            self.code = SemanticQueryErrorCode.INVALID_QUERY
        super().__init__(self.code.value)

    def __str__(self) -> str:
        """Return a stable explanation without arbitrary provider text."""
        return "Semantic query rejected."
