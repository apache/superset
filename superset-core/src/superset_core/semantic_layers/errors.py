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
"""Errors semantic-layer providers raise to signal result guarantees to the host."""

from __future__ import annotations

from typing import get_args, Literal, TypeAlias

SemanticResultCompletenessReason: TypeAlias = Literal["incomplete", "unverified"]


class SemanticResultCompletenessError(Exception):
    """
    Raise from ``get_table``, ``get_values`` or ``get_row_count`` when a result is
    incomplete (``"incomplete"``) or its completeness cannot be verified
    (``"unverified"``).

    The host converts this error into its own client-facing error with fixed,
    translated guidance, so do not put upstream diagnostic text in it. Never return
    a partial result or retry a failed filtered request without its filter instead
    of raising.
    """

    def __init__(self, reason: SemanticResultCompletenessReason) -> None:
        if reason not in get_args(SemanticResultCompletenessReason):
            raise ValueError("Unknown completeness reason")
        super().__init__(reason)
        self.reason: SemanticResultCompletenessReason = reason
