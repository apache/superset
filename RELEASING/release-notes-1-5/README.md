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

# Release Notes for Superset 1.5

Superset 1.5 focuses on polishing the dashboard native filters experience, while
improving performance and stability. Superset 1.5 is likely the last minor release of
version 1 of Superset, and will be succeeded by Superset 2.0. The 1.5 branch
introduces the notion of a Long Term Support (LTS) version of Superset, and will
receive security and other critical fixes even after Superset 2.x is released.
Therefore, users will have the choice of staying on the 1.5 branch or upgrading to 2.x
when available.

- [**User Experience**](#user-facing-features)
- [**Feature flags**](#feature-flags)
- [**Database Experience**](#database-experience)
- [**Breaking Changes and Full Changelog**](#breaking-changes-and-full-changelog)

## User Facing Features

- Complex dashboards with lots of native filters and charts will render considerably
  faster. See the videos that shows the rendering time of a complex dashboard go from
  11 to 3 seconds: [#19064](https://github.com/apache/superset/pull/19064). In
  addition, applying filters and switching tabs is also much smoother.
- The Native Filter Bar has been redesigned, along with moving the "Apply" and
  "Clear all" buttons to the bottom:

![Filter bar](media/filter_bar.png)

- Native filters can now be made dependent on multiple filters. This makes it possible
  to restrict the available values in a filter based on the selection of other filters.

![Dependent filters](media/dependent_filters.png)

- In addition to being able to write Custom SQL for adhoc metrics and filters, the
  column control now also features a Custom SQL tab. This makes it possible to write
  custom expressions directly in charts without adding them to the dataset as saved
  expressions.

![Adhoc columns](media/adhoc_columns.png)

- A new `SupersetMetastoreCache` has been added which makes it possible to cache data
  in the Superset Metastore without the need for running a dedicated cache like Redis
  or Memcached. The new cache will be used by default for required caches, but can also
  be used for caching chart or other data. See the
  [documentation](https://superset.apache.org/docs/installation/cache#caching) for
  details on using the new cache.
- Previously it was possible for Dashboards with lots of filters to cause an error.
  A similar issue existed on Explore. Now Superset stores Dashboard and Explore state
  in the cache (as opposed to the URL), eliminating the infamous
  [Long URL Problem](https://github.com/apache/superset/issues/17086).
- Previously permanent links to Dashboard and Explore pages were in fact shortened URLS
  that relied on state being stored in the URL (see Long URL Problem above). In
  addition, the links used numerical ids and didn't check user permissions making it
  easy to iterate through links that were stored in the metastore. Now permanent links
  state is stored as JSON objects in the metastore, making it possible to store
  arbitrarily large Dashboard and Explore state in permalinks. In addition, the ids
  are encoded using [`hashids`](https://hashids.org/) and check permissions, making
  permalink state more secure.

![Dashboard permalink](media/permalink.png)

## Feature flags

- A new feature flag `GENERIC_CHART_AXES` has been added that makes it possible to
  use a non-temporal x-axis on the ECharts Timeseries chart
  ([#17917](https://github.com/apache/superset/pull/17917)). When enabled, a new
  control "X Axis" is added to the control panel of ECharts line, area, bar, step and
  scatter charts, which makes it possible to use categorical or numerical x-axes on
  those charts.

![Categorical line chart](media/categorical_line.png)

## Database Experience

- DuckDB: Add support for database:
  [#19317](https://github.com/apache/superset/pull/19317)

- Kusto: Add support for Azure Data Explorer (Kusto):
  [#17898](https://github.com/apache/superset/pull/17898)

- Trino: Add server cert support and new auth methods:
  [#17593](https://github.com/apache/superset/pull/17593) and
  [#16346](https://github.com/apache/superset/pull/16346)

- Microsoft SQL Server (MSSQL): support using CTEs in virtual tables:
  [#18567](https://github.com/apache/superset/pull/18567)

- Teradata and MSSQL: add support for TOP limit syntax:
  [#18746](https://github.com/apache/superset/pull/18746) and
  [#18240](https://github.com/apache/superset/pull/18240)

- Apache Drill: User impersonation using `drill+sadrill`:
  [#19252](https://github.com/apache/superset/pull/19252)

## Developer Experience

- `superset-ui` has now been integrated into the Superset codebase as per
  [SIP-58](https://github.com/apache/superset/issues/13013) dubbed "Monorepo". This
  makes development of plugins that ship with Superset considerably simpler. In
  addition, it makes it possible to align `superset-ui` releases with official Superset
  releases.

## Breaking Changes and Full Changelog

**Breaking Changes**

- Bump `mysqlclient` from v1 to v2:
  [#17556](https://github.com/apache/superset/pull/17556)
- Single and double quotes will no longer be removed from filter values:
  [#17881](https://github.com/apache/superset/pull/17881)
- Previously `QUERY_COST_FORMATTERS_BY_ENGINE`, `SQL_VALIDATORS_BY_ENGINE` and
  `SCHEDULED_QUERIES` were expected to be defined in the feature flag dictionary in
  the `config.py` file. These should now be defined as a top-level config, with the
  feature flag dictionary being reserved for boolean only values:
  [#15254](https://github.com/apache/superset/pull/15254)
- All Superset CLI commands (init, load_examples and etc) require setting the
  `FLASK_APP` environment variable (which is set by default when `.flaskenv` is loaded):
  [#17539](https://github.com/apache/superset/pull/17539)

**Changelog**

To see the complete changelog in this release, head to
[CHANGELOG.MD](https://github.com/apache/superset/blob/master/CHANGELOG/1.5.0.md).
As mentioned earlier, this release has a MASSIVE amount of bug fixes. The full
changelog lists all of them!
