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
"""Integration tests for the cross-entity activity-view API (sc-107283).

Three test classes mirror the three endpoint families:

* ``TestDashboardActivityView`` — ``/api/v1/dashboard/<uuid>/activity/``
  (US1, MVP — own + transitive chart-on-dashboard + dataset-via-chart).
* ``TestChartActivityView`` — ``/api/v1/chart/<uuid>/activity/``
  (US2 — own + datasets the chart pointed at during association).
* ``TestDatasetActivityView`` — ``/api/v1/dataset/<uuid>/activity/``
  (US3 — own edits only; no transitive layer in V2 per AV-004).

All test classes use the existing ``load_birth_names_dashboard_with_slices``
autouse fixture (plan §D-18). Per spec T053 / sc-103156 T062, every test
that mutates a fixture entity wraps the test body in ``try``/``finally``
with ``metadata_db.session.rollback()`` in the ``finally``.
"""

from __future__ import annotations

from tests.integration_tests.base_tests import SupersetTestCase  # noqa: F401
