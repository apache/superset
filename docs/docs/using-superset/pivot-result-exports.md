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

Pivot Table result aggregation summarizes the grouped metric values returned by
the chart query. For example, with grouped values 1, 9, 20 and 100, a saved
**Median** aggregation produces a grand summary of 14.5. It does not calculate the median
of intermediate subtotals. Query filters and row limits apply before this step.

## Saved aggregation settings

The chart control panel exposes **Show values as**, but does not expose a
result-aggregation selector. This export behavior applies to charts whose saved
configuration already contains an `aggregateFunction`, for example from a
version with an aggregation selector. This page does not describe a new control
available in the chart editor.

A missing, unrecognized or **Metric** setting keeps metric-definition behavior.
Saved settings such as **Sum**, **Average** and **Median** apply a second
aggregation to the returned grouped results.

Row and column subtotals can be enabled independently of grand totals. A shared
total combining different metrics is blank because those metrics do not have a
single meaningful aggregate. This also applies when metrics are placed on rows
or the table is transposed.

## Fractions and formatting

**Sum as Fraction of Total**, **Rows** or **Columns**, and the corresponding
**Count** choices, use only their own metric in the denominator. Result
aggregation takes precedence over the separate **Show values as** setting.
Without a saved result aggregation, that setting applies to database-computed
metric values.

Formatted results display fractions as percentages, including when a metric has
a currency override. CSV exports retain raw numeric ratios. Excel fractions
remain numeric cells with a percentage number format, so they can be used in
formulas. Other formatted results retain their configured formats; AUTO currency formatting uses the currencies of the
records contributing to each cell or subtotal.

## Missing values

Numeric result reducers ignore NULL observations. **First** takes the first
non-NULL value, while **Last** retains the final value even when it is NULL.
Sample variance and sample standard deviation are zero for a single numeric
observation. Stored database totals are not additional observations: result
aggregation uses the leaf query results.
