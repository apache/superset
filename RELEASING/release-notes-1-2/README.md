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

# Release Notes for Superset 1.2

Superset 1.2 continues the Apache ECharts migration by introducing several chart types. It also brings with it tons of user experience improvements, API improvements, bug fixes, and continued development of experimental features included in previous releases. Keep reading for more details on these categories:

- [**User Experience**](#user-experience)
- [**Dashboard Level Security**](#dashboard-level-security)
- [**Database Connectivity**](#database-connectivity)
- [**Developer Experience**](#developer-experience)
- [**PR Highlights**](#pr-highlights)
- [**Breaking Changes and Full Changelog**](#breaking-changes-and-full-changelog)

# User Experience

The migration to Apache ECharts continues by introducing several new high-quality visualizations in this release.

The mixed time-series multi chart allows different kinds of time-series visualization to be overlayed.

![mixed time series](media/time_series_multichart.png)

The radar chart provides a good way to compare two or more groups over various features of interest.

![radar chart](media/radar_chart.png)

By popular demand, we have introduced a new and improved version of the pivot table visualization as well.

![pivot table](media/pivot_table_v2.png)

Several UI tweaks in Explore and SQL Lab made it into this release as well, including new buttons and menu options to make common workflows easier, as well as more communicative error messages, particularly in the database connection menus.

The dashboard native filter feature, [while still behind a feature flag in this release](https://github.com/apache/superset/blob/master/RELEASING/release-notes-1-0/README.md#feature-flags), has received plenty of new functionality and is closer than ever to being ready for prime-time. This feature provides a way to apply and manipulate filters over many charts at the dashboard level. 1.2 adds more controls, more options for aggregations, and better support for temporal filters, among other things.

![Native Filter](media/native_filters.png)

![Native Filter](media/native_filters_temporal.png)

Last but not least, the alerts and reports feature and its dependencies have been added to the [docker-compose](https://superset.apache.org/docs/installation/installing-superset-using-docker-compose) setup, making it easier to use outside of well-supported enterprise deployments.


# Dashboard Level Security

Superset has so far relied on a role-based access system implemented at the dataset level. While this provides granular security options that satisfy many use cases, some organizations need more options. [SIP-51](https://github.com/apache/superset/issues/10408) lays out a vision for dashboard-level role-based access control as a fully backwards compatible extension to Superset's security options.

The 1.1 release saw steps taken in the direction of this vision, and 1.2 builds on that with new permissions for sharing charts and dashboards that can be assigned to roles. **Note that this functionality is still experimental and hidden behind a feature flag as of 1.2.**

![dashboard rbac](media/dashboard_rbac.png)

# Database Connectivity
The 1.2 release adds support for [Crate DB](https://github.com/apache/superset/pull/13152) and the [Databricks DB](https://github.com/apache/superset/pull/13682) engine spec.


# Developer Experience
Expanding the API has been an ongoing effort, and 1.2 introduces several new API routes to allow developers to get available databases, get a given dashboard's charts, and import saved queries, among other things.

# PR Highlights

**New Charts and User Experience**

- [14197](https://github.com/apache/superset/pull/14197) feat(viz): add mixed and radar chart (#14197) (@Ville Brofeldt)
- [14187](https://github.com/apache/superset/pull/14187) Enable the new pivot table (#14187) (@Kamil Gabryjelski)
- [13210](https://github.com/apache/superset/pull/13210) feat(explore): ColumnSelectControl with drag-and-drop (#13210) (@Yongjie Zhao)
- [13598](https://github.com/apache/superset/pull/13598) feat(explore): Drag and drop UX improvements (#13598) (@Kamil Gabryjelski)
- [13294](https://github.com/apache/superset/pull/13294) feat(explore): Postgres datatype conversion (#13294) (@Nikola Gigić)
- [13758](https://github.com/apache/superset/pull/13758) feat(explore): adhoc column formatting for Table chart (#13758) (@Jesse Yang)

**Progress On Dashboard Native Filters**

- [13726](https://github.com/apache/superset/pull/13726) feat(native-filters): Add default first value to select filter (#13726) (@simcha90)
- [14461](https://github.com/apache/superset/pull/14461) feat(native-filters): Auto apply changes in FiltersConfigModal (#14461) (@simcha90)
- [13507](https://github.com/apache/superset/pull/13507) feat(native-filters): Filter set tabs (#13507) (@simcha90)
- [14313](https://github.com/apache/superset/pull/14313) feat(native-filters): Implement adhoc filters and time picker in Range and Select native filters (#14313) (@Kamil Gabryjelski)
- [14261](https://github.com/apache/superset/pull/14261) feat(native-filters): Show/Hide filter bar by metadata ff (#14261) (@simcha90)
- [13506](https://github.com/apache/superset/pull/13506) feat(native-filters): Update filter bar buttons (#13506) (@simcha90)
- [14374](https://github.com/apache/superset/pull/14374) feat(native-filters): Use datasets in dashboard as default options for native filters (#14374) (@Kamil Gabryjelski)
- [14314](https://github.com/apache/superset/pull/14314) feat(native-filters): add option to create value in select filter (#14314) (@Ville Brofeldt)
- [14346](https://github.com/apache/superset/pull/14346) feat(native-filters): add optional sort metric to select filter (#14346) (@Ville Brofeldt)
- [14375](https://github.com/apache/superset/pull/14375) feat(native-filters): add refresh button to default value picker (#14375) (@Ville Brofeldt)
- [13569](https://github.com/apache/superset/pull/13569) feat(native-filters): add sort option to select filter (#13569) (@Ville Brofeldt)
- [13622](https://github.com/apache/superset/pull/13622) feat(native-filters): add temporal support to select filter (#13622) (@Ville Brofeldt)
- [13484](https://github.com/apache/superset/pull/13484) feat(native-filters): add timegrain and column filter (#13484) (@Ville Brofeldt)
- [14312](https://github.com/apache/superset/pull/14312) feat(native-filters): add tooltip to control values (#14312) (@Ville Brofeldt)
- [14217](https://github.com/apache/superset/pull/14217) feat(native-filters): select group by support (#14217) (@Amit Miran)

**Progress On Dashboard Level Access**

- [13145](https://github.com/apache/superset/pull/13145) feat(dashboard_rbac): manage roles for dashboard (#13145) (@simcha90)
- [13992](https://github.com/apache/superset/pull/13992) feat(dashboard_rbac): provide data access based on dashboard access (#13992) (@Amit Miran)
- [#12865](https://github.com/apache/superset/pull/12865) feat(dashboard_rbac): dashboards API support for roles create/update + roles validation (@amitmiran137)


**Improvements to Developer Experience**

- [14208](https://github.com/apache/superset/pull/14208) feat: add endpoint to fetch available DBs (#14208) (@Beto Dealmeida)
- [13331](https://github.com/apache/superset/pull/13331) fix(query-object): extra time-range-endpoints (#13331) (@John Bodley)
- [13893](https://github.com/apache/superset/pull/13893) feat: create backend routes and API for importing saved queries (#13893) (@AAfghahi)
- [13960](https://github.com/apache/superset/pull/13960) feat: initial work to make v1 API compatible with SIP-40 and SIP-41 (#13960) (@Beto Dealmeida)
- [13444](https://github.com/apache/superset/pull/13444) fix: API to allow importing old exports (JSON/YAML) (#13444) (@Beto Dealmeida)
- [13893](https://github.com/apache/superset/pull/13893) feat: create backend routes and API for importing saved queries (#13893) (@AAfghahi)


## Breaking Changes and Full Changelog

- To see the complete changelog in this release, head to [CHANGELOG.MD](https://github.com/apache/superset/blob/master/CHANGELOG.md).
- In line with the semantic versioning scheme adopted by the community, 1.2.0 does not contain any backwards incompatible changes.
