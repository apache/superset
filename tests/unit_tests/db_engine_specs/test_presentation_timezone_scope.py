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
"""Guard rails for which engines expose the presentation-time-zone feature."""

from superset.connectors.sqla.models import TableColumn
from superset.db_engine_specs import load_engine_specs
from superset.db_engine_specs.base import BaseEngineSpec

# Engines whose per-engine SQL generation has been written and verified. New
# engines (or PG-derived dialects that inherit the flag) must be added here
# deliberately, with their own tests — not by accidental inheritance.
VERIFIED_ENGINES = {"postgresql", "impala"}


def _supporting_specs() -> list[type[BaseEngineSpec]]:
    return [spec for spec in load_engine_specs() if spec.supports_presentation_timezone]


def test_only_verified_engines_support_presentation_timezone() -> None:
    engines = {spec.engine for spec in _supporting_specs()}
    assert engines == VERIFIED_ENGINES, (
        f"Unexpected engines expose presentation time zone: "
        f"{engines ^ VERIFIED_ENGINES}. A PG-derived subclass may be inheriting "
        f"the capability — set supports_presentation_timezone = False on it "
        f"until its dialect SQL is verified, or add it to VERIFIED_ENGINES."
    )


def test_presentation_timezone_concept_stays_on_tablecolumn() -> None:
    """The zone concept must live only on ``TableColumn``.

    ``get_time_filter`` (shared via ``ExploreMixin`` with the SQL Lab ``Query``
    datasource) applies the zone only when ``time_col`` has
    ``_presentation_timezone``. If a refactor moved that onto the shared base,
    the out-of-scope SQL Lab path would silently start zoning — this pins the
    seam so that change fails loudly.
    """
    assert "_presentation_timezone" in vars(TableColumn)
    assert "is_tz_aware" in vars(TableColumn)


def test_supporting_specs_override_the_zone_hooks() -> None:
    """Any engine that opts in must implement both per-engine hooks."""
    for spec in _supporting_specs():
        assert (
            spec.presentation_timezone_column
            is not BaseEngineSpec.presentation_timezone_column
        ), f"{spec.engine} sets the flag but does not override the column hook"
        assert (
            spec.presentation_timezone_bound
            is not BaseEngineSpec.presentation_timezone_bound
        ), f"{spec.engine} sets the flag but does not override the bound hook"
