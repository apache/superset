<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Pivot result aggregation exports

This backend follow-up to #44660 extracts the result reducers and export tests
from #44647. It does not restore frontend controls or add another migration.
The frontend restoration must ship with this work before result selections can
be expected to agree across browser and tabular export paths.

Each cell, subtotal and grand summary is reduced from its original contributing
grouped metric values. Query filters and limits have already been applied.
Shared totals combining different metrics are blank; a fraction's denominator
uses only its own metric. Transposition and metric placement do not change that
rule. Stored GROUPING SETS data is split into leaves before result aggregation,
so stored database rollups are not counted as additional observations.

Explicit `Metric`, missing and unrecognised selections retain metric-definition
behavior. Applying database rollups in Actual Values mode overlaps with #44631;
once that merges, retain its behavior behind the non-result-mode guard. Its
regression fixtures using `aggregateFunction: "Average"` need to use `Metric`
when they intend database totals: Average becomes an explicit result reducer.

## Integration decisions still open

At frontend revision `66ccb82b4bc4c39cb4efb49f143ed7e44c921d75`, #44660
reuses the existing JavaScript reducers without the numeric-input normalization
in #44647. For example, JavaScript Median coerces null to zero, while this
backend ignores null numeric observations. First/Last and text inputs also need
an agreed contract before claiming complete parity.

This extraction retains #44647's separate `showValuesAs` transformation for
result aggregations, with historical fraction choices taking precedence.
#44660 currently selects its result factory ahead of that transformation.
Choose one contract and verify matching browser/export examples before release.

Unit tests cover all result choices, mixed metric corners and per-metric
fractions in both metric layouts. Live CSV/Excel downloads, scheduled report
query rebuilding after the migration, and large-result performance remain
integration checks, not claims of completed validation.
