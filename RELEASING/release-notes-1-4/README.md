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

# Release Notes for Superset 1.4

Superset 1.4 focuses heavily on continuing to polish the core Superset experience. This release has a very very long list of fixes from across the community.

- [**User Experience**](#user-facing-features)
- [**Database Experience**](#database-experience)
- [**Breaking Changes and Full Changelog**](#breaking-changes-and-full-changelog)

## User Facing Features

- Charts and dashboards in Superset can now be certified! In addition, the Edit Dataset modal more accurately reflects state of Certification (especially for Calculated Columns). ([#17335](https://github.com/apache/superset/pull/17335), [#16454](https://github.com/apache/superset/pull/16454))

![Tab Column](media/calc.png)

- Parquet files can now be uploaded into an existing connected database that has Data Upload enabled. Eventually, the contributor hopes that this foundation can be used to accommodate `feather` and `orc` files. ([#14449](https://github.com/apache/superset/pull/14449))

- Tabs can now be added to Column elements in dashboards. ([#16593](https://github.com/apache/superset/pull/16593))

![Tab Column](media/tab_column.jpg)

- The experience of using alerts and reports have improved in a few minor ways. ([#16335](https://github.com/apache/superset/pull/16335),[#16281](https://github.com/apache/superset/pull/16281))

- Drag and drop now has a clickable ghost button for an improved user experience. ([#16119](https://github.com/apache/superset/pull/16119))

## Database Experience

- Apache Drill: Superset can now connect to Apache Drill (thru ODBC / JDBC) and impersonate the currently logged in user. ([#17353](https://github.com/apache/superset/pull/17353/files)).

- Firebolt: Superset now supports the cloud data warehouse Firebolt! ([#16903](https://github.com/apache/superset/pull/16903)).

- Databricks: Superset now supports the new [SQL Endpoints in Databricks](https://docs.databricks.com/sql/admin/sql-endpoints.html). ([#16862](https://github.com/apache/superset/pull/16862))

- Apache Druid: Superset Explore now can take advantage of support for JOIN's in Druid (note: the `DRUID_JOINS` feature flag needs to be 	enabled). ([#16770](https://github.com/apache/superset/pull/16770))

- AWS Aurora: Superset now has a separate db_engine_spec for Amazon Aurora. ([#16535](https://github.com/apache/superset/pull/16535))

- Clickhouse: Superset now includes function names in the auto-complete for SQL Lab. ([#16234](https://github.com/apache/superset/pull/16234))

- Google Sheets: Better support for private Google Sheets was added. ([#16228](https://github.com/apache/superset/pull/16628))


## Developer Experience

- The `Makefile` for Superset has gone through a number of improvements. ([#16327](https://github.com/apache/superset/pull/16327), [#16533](https://github.com/apache/superset/pull/16533))

- Add Python instrumentation to pages, showing method calls used to build the page & how long each one took. This requires a configuration flag (see PR for more info). ([#16136](https://github.com/apache/superset/pull/16136))

![Pyinstrument](media/pyinstrument.png)

## Breaking Changes and Full Changelog

**Breaking Changes**

- [16660](https://github.com/apache/superset/pull/16660): The `columns` Jinja parameter has been renamed `table_columns` to make the columns query object parameter available in the Jinja context.
- [16711](https://github.com/apache/superset/pull/16711): The url_param Jinja function will now by default escape the result. For instance, the value `O'Brien` will now be changed to `O''Brien`. To disable this behavior, call `url_param` with `escape_result` set to `False: url_param("my_key", "my default", escape_result=False)`.

**Changelog**

To see the complete changelog in this release, head to [CHANGELOG.MD](https://github.com/apache/superset/blob/master/CHANGELOG.md). As mentioned earlier, this release has a MASSIVE amount of bug fixes. The full changelog lists all of them!
