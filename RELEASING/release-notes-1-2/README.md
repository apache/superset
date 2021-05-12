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

Superset 1.2 continues the Apache ECharts migration by introducing a number of chart types. It also brings with it tons of user experience improvements, API improvements, bug-fixes, and continued development of experimental features included in previous releases. Keep reading for more details on these categories:

- [**User Experience**](#user-experience)
- [**Dashboard Level Security**](#dashboard-level-security)
- [**Database Connectivity**](#database-connectivity)
- [**Developer Experience**](#developer-experience)
- [**PR Highlights**](#pr-highlights)
- [**Breaking Changes and Full Changelog**](#breaking-changes-and-full-changelog)

# User Experience

The migration to Apache ECharts continues by introducing a number of new high-quality visualizations in this release.

The mixed time-series multichart allows different kinds of time-series visualization to be overlayed.

![mixed time series](media/time_series_multichart.png)

The radar chart provides a good way to compare two or more groups over various features of interest.

![radar chart](media/radar_chart.png)

By popular demand, we have introduced a new and improved version of the pivot table visualization as well.

![pivot table](media/pivot_table_v2.png)

A number of UI tweaks in explore and sql lab made it into this release as well, including new buttons and menu options to make common workflows easier, as well as more communicative error messages, particularly in the database connection menus.

The dashboard native filter feature, [while still behind a feature flag in this release](https://github.com/apache/superset/blob/master/RELEASING/release-notes-1-0/README.md#feature-flags), has received plenty of new functionality and is closer than ever to being ready for prime-time. This feature provides a way to apply and manipulate filters over many charts at the dashboard level. 1.2 adds more controls, more options for aggregations, and better support for temporal filters, among other things.

![Native Filter](media/native_filters.png)

![Native Filter](media/native_filters_temporal.png)

Last but not least, the alerts and reports feature and its dependencies have been added to the [docker-compose](https://superset.apache.org/docs/installation/installing-superset-using-docker-compose) setup, making it easier to use outside of well-supported enterprise deployments.


# Dashboard Level Security

Superset has so far relied on a role based access system implemented at the dataset level. While this provides granular security options that satisfy many use cases, some organizations need more options. [SIP-51](https://github.com/apache/superset/issues/10408) lays out a vision for dashboard level role based access control as a fully backwards compatible extension to Superset's security options.

The 1.1 release saw steps taken in the direction of this vision, and 1.2 builds on that with new permissions for sharing charts and dashboards that can be assigned to roles. **Note that this functionality is still experimental and hidden behind a feature flag as of 1.2.**

![dashboard rbac](media/dashboard_rbac.png)

# Database Connectivity
The 1.2 release adds support for [Crate DB](https://github.com/apache/superset/pull/13152) and the [Databricks DB](https://github.com/apache/superset/pull/13682) engine spec.


# Developer Experience
Expanding the API has been an ongoing effort, and 1.2 introduces a number of new API routes to allow developers to get available databases, get a given dashboard's charts, and import saved queries, among other things.

# PR Highlights

**New Charts and User Experience**


**Progress On Dashboard Native Filters**


**Progress On Dashboard Level Access**


**Improvements to Developer Experience**


## Breaking Changes and Full Changelog

- To see the complete changelog in this release, head to [CHANGELOG.MD](https://github.com/apache/superset/blob/master/CHANGELOG.md).
- In line with the semantic versioning scheme adopted by the community, 1.2.0 does not contain any backwards incompatible changes.


