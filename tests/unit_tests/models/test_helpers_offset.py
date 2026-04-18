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
from pathlib import Path


def test_helpers_guards_offset_with_allows_offset_fetch_flag() -> None:
    """
    Structural regression test: the .offset() call in get_sqla_query must
    be guarded by db_engine_spec.allows_offset_fetch. Removing the guard
    regresses Elasticsearch drill-to-detail pagination (crashes on page 2+
    with 'mismatched input OFFSET').

    We assert on the source file rather than invoking get_sqla_query
    directly because the full call path requires an SqlaTable with
    columns/metrics/database — overkill for a one-line guard.
    """
    source = Path("superset/models/helpers.py").read_text()

    guard_line = (
        "if row_offset and self.database.db_engine_spec.allows_offset_fetch:"
    )
    assert guard_line in source, (
        "The OFFSET guard is missing from superset/models/helpers.py — "
        "Elasticsearch (and any other engine with allows_offset_fetch=False) "
        "will crash when drill-to-detail requests page 2+."
    )
