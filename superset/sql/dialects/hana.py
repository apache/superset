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
SAP HANA dialect.

HANA has no first-party sqlglot dialect, so Superset maps it to Postgres.
Postgres normalizes function-call names to uppercase on generation
(``NORMALIZE_FUNCTIONS = "upper"``). HANA calculation-view invocations are
addressed as a quoted, case-sensitive identifier followed by a PLACEHOLDER
parameter list, e.g. ``"zbw.10_001/INVENTORY"('PLACEHOLDER' = (...))`` --
sqlglot parses that shape as a function call, so the inherited
normalization silently re-cases the quoted identifier to
``"ZBW.10_001/INVENTORY"``. HANA resolves calculation-view names
case-sensitively, so the re-cased identifier no longer exists and the
query fails at execution time.
"""

from __future__ import annotations

from sqlglot.dialects.postgres import Postgres


class Hana(Postgres):
    """
    SAP HANA dialect.

    Extends PostgreSQL but disables function-name case normalization, since
    HANA calculation-view calls are quoted, case-sensitive identifiers that
    sqlglot's parser treats as function names.
    """

    NORMALIZE_FUNCTIONS = False
