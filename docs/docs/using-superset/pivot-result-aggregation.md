---
title: Pivot table aggregation
---

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


Pivot tables support two calculations through **Aggregation function**:

- **Use metric definition** evaluates each metric at the cell or summary scope.
  For example, AVG(sales) summarizes all underlying sales records and a distinct
  count deduplicates across groups.
- **Average**, **Median**, and the other result functions aggregate the returned
  grouped metric values. Each result contributes once, regardless of how many
  source records produced it. This also applies to body cells when they have
  multiple contributing results.

For grouped averages of 10 and 100, Average displays a summary of 55. It does not
recompute the average of the underlying records. Each subtotal and grand summary
is calculated independently from contributing results, never from other summaries.
Numeric result functions skip null and nonnumeric values; Sum preserves text-only cells. Count counts returned
results, including results whose metric is null.

Query filters, ordering, and limits apply before result aggregation. Increasing a
row limit can therefore change a result summary. Changing the aggregation function
runs a new query because metric mode can require database rollups while result
mode requires only the original grouped results.

Saved charts with an `aggregateFunction` retain that selection automatically; no
metadata migration or metric rewrite is required. Charts without the setting use
the metric definition. Selecting Use metric definition explicitly saves `Metric`.
Existing row and column summary visibility settings are preserved.

Show values as is a separate percentage transformation. With a result aggregation,
its denominator uses the selected summary calculation; percentages of an average
or median are not additive shares and need not sum to 100%. The historical Sum/Count
as Fraction options include their own percentage calculation and take precedence
over Show values as, avoiding a second division.

The restored path also handles tabular exports from original grouped results.
An old stored query containing database rollups is split to its leaf records first.
A stored leaf-only query cannot reconstruct missing database totals for a
non-additive metric: regenerate the query by opening and saving the chart when
switching to Use metric definition.
