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

# Release Notes for Superset 4.1.0

Superset 4.1.0 brings a range of new features and quality of life improvements.  This release is a minor version, meaning it doesn't include any breaking changes to ensure a seamless transition for our users. Here are some of the highlights of this release.

### Big Number With Time Period Updates

We released a [Big Number with Comparison](https://github.com/apache/superset/pull/26908) chart as part of Superset 4.0. With the latest update, there are now [color options](https://github.com/apache/superset/pull/27524) for comparisons. The chart now also uses [standardize controls](https://github.com/apache/superset/pull/27193) such that when switching charts will maintain the selected metrics. To enable the new chart, you'll need to enable the `CHART_PLUGINS_EXPERIMENTAL` feature flag.

<div>
    <image src="media/big_number_chart.png" alt="Image" width="100%">
</div>

### Time Comparisson With Table
Added functionality to do [table time comparisons](https://github.com/apache/superset/pull/28057) behind the `CHART_PLUGINS_EXPERIMENTAL` feature flag. This will help improve and facilitate efficient data analysis.

<div>
    <image src="media/table_with_time.png" alt="Image" width="100%">
</div>

### New ECharts Versions

The new ECharts [Heatmap](https://github.com/apache/superset/pull/25353) has been added. Compared to the legacy Heatmap, it has more accurate percentage calculations, server side sorting to respect row limits, and a more interactive legend control that allows selecting a subset of values.

<div>
    <image src="media/heatmap.png" alt="Image" width="100%">
</div>

We also added a new ECharts [Histogram](https://github.com/apache/superset/pull/28652) chart. The new chart will help visualize patterns, clusters, and outliers in the data and provides insights into its shape, central tendency, and spread.

<div>
    <image src="media/histogram.png" alt="Image" width="100%">
</div>

Both the [Heatmap](https://github.com/apache/superset/pull/27771) and [Histogram](https://github.com/apache/superset/pull/28780) migration logic have been added to the CLI if you wish to migrate ahead of time.

### Improved Upload Forms

We've made design changes to the [CSV](https://github.com/apache/superset/pull/27840), [Excel](https://github.com/apache/superset/pull/28105), and [Columnar](https://github.com/apache/superset/pull/28192
) upload modals to improve user experience and to be more performant. The new designs has the following goals:

- Improved error handling.
- Better backend parameter validation.
- More aligned with our other modal dialogs

#### CSV
<div>
    <img src="media/csv_modal_1.png" alt="Image" width="25%">
    <img src="media/csv_modal_2.png" alt="Image" width="25%">
    <img src="media/csv_modal_3.png" alt="Image" width="25%">
    <img src="media/csv_modal_4.png" alt="Image" width="25%">
</div>

#### Excel
<div>
    <img src="media/excel_modal_1.png" alt="Image" width="25%">
    <img src="media/excel_modal_2.png" alt="Image" width="25%">
    <img src="media/excel_modal_3.png" alt="Image" width="25%">
    <img src="media/excel_modal_4.png" alt="Image" width="25%">
</div>

#### Columnar
<div>
    <img src="media/columnar_modal_1.png" alt="Image" width="33%">
    <img src="media/columnar_modal_2.png" alt="Image" width="33%">
    <img src="media/columnar_modal_3.png" alt="Image" width="33%">
</div>


### OAuth2 For Databases

You now have the ability to enable [OAuth2](https://github.com/apache/superset/pull/27631) for databases like BigQuery, Snowflake, Dremio, Databricks, Google Sheets, etc. When enabled, it will allow users to connect to Oauth2 enabled databases with their own credentials.

### Catalog Support For Databases

Added support for the [catalog heirachy](https://github.com/apache/superset/pull/28317) for databases that support it, such as [BigQuery (projects), Databricks, Presto, Snowflake, and Trino](https://github.com/apache/superset/pull/28416). Once enabled, users will see catalogs when selecting tables in [SQL Lab, datasets](https://github.com/apache/superset/pull/28376), and when setting up Data Access Roles
