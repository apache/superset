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

# Release Notes for Superset 1.1.0

Superset 1.1.0 continues to build on the [1.0](https://github.com/apache/superset/blob/master/RELEASING/release-notes-1-0/README.md) release with big improvements to user experience, security, dashboard level access, and database connectivity.

- [**User Experience**](#user-experience)
- [**Dashboard Level Security**](#dashboard-level-security)
- [**Database Connectivity**](#database-connectivity)
- [**PR Highlights**](#pr-highlights)
- [**Breaking Changes and Full Changelog**](#breaking-changes-and-full-changelog)

# User Experience

In general, the quality, usability, and aesthetics of the Superset user experience continues to develop in the direction of [SIP-34](https://github.com/apache/superset/issues/8976) and more tests have been added to ui components to ensure usability is maintained.

The migration to Apache ECharts continues with the addition of a [new force-directed graph](https://github.com/apache/superset/pull/13111).

![Force Directed Graph](media/force_directed_graph.jpg)

The ECharts library included with Superset was also bumped to 5.0.2, which includes some [fixes to pie charts.](https://github.com/apache/superset/pull/13052) The overall improvement of chart options and quality can be expected to continue in future releases. New 'sort by' controls have also been [added](https://github.com/apache/superset/pull/13049) to [many charts](https://github.com/apache/superset/pull/13057).

The dashboard native filter feature, [while still behind a feature flag in this release,](https://github.com/apache/superset/blob/master/RELEASING/release-notes-1-0/README.md#feature-flags) has been improved and is ready to test out.

![Native Filter](media/native_filters.jpg)

Since the 1.0 release, we have seen a surge of support from the community around updating Superset's [documentation](https://superset.apache.org/docs/intro) and adding more tests to the UI. Thanks to all who contributed in this area. This is what open-source software is all about!

# Dashboard Level Security

Dashboard providers in an organization with many subgroups need the ability manage user access to dashboards and different levels of permissions (read, write, granter, owner). Improving dashboard level access was proposed (and approved) in [SIP-51](https://github.com/apache/superset/issues/10408).

![SIP 51](media/sip_51.jpg)

In 1.1, some key steps were taken towards the vision laid out in SIP-51. **Note that this functionality is still hidden behind feature flags and is an active area of development.** You can view a list of relevant PR's in [PR Highlights](#pr-highlights)


# Database Connectivity

Superset is only as good as the databases it can query. This release saw the expanded support of existing databases and foundational support for new databases.

- [Opendistro](https://github.com/apache/superset/pull/12602)
- [Trino](https://github.com/apache/superset/pull/13105)
- [CrateDB](https://github.com/apache/superset/pull/13152/files)
- [Apache Pinot](https://github.com/apache/superset/pull/13163)
- [Presto](https://github.com/apache/superset/pull/13214)
- [BigQuery](https://github.com/apache/superset/pull/12581)
- [Postgres](https://github.com/apache/superset/pull/11720)
- [Google Sheets](https://github.com/apache/superset/pull/13185)
- [Athena](https://github.com/apache/superset/pull/13201)

# PR Highlights

**Progress On Dashboard Native Filters**

- feat(chart-data): add rowcount, timegrain and column result types (#[13271](https://github.com/apache/superset/pull/13271))
- feat(native-filters): enable filter indicator and make datasource optional (#[13148](https://github.com/apache/superset/pull/13148))
- feat(native-filters): hide filterBar and toggle icon when in editMode (#[13108](https://github.com/apache/superset/pull/13108))
- feat(native-filters): add storybook entry for select filter (#[13005](https://github.com/apache/superset/pull/13005))
- feat(native-filters): Time native filter (#[12992](https://github.com/apache/superset/pull/12992))
- feat(native-filters): Add defaultValue for Native filters modal (#[12199](https://github.com/apache/superset/pull/12199))
- feat(native-filters): apply scoping of native filters to dashboard (#[12716](https://github.com/apache/superset/pull/12716))

**Progress On Dashboard Level Access**

- feat(dashboard-rbac): dashboard lists (#[12680](https://github.com/apache/superset/pull/12680))
- feat(dashboard-rbac): add support for related roles (#[13035](https://github.com/apache/superset/pull/13035))
- feat(dashboard-rbac): dashboards API support for roles create/update + roles validation (#[12865](https://github.com/apache/superset/pull/12865))
- feat(dashboard-rbac): `dashboard_view` access enforcement (#[12875](https://github.com/apache/superset/pull/12875))

**Improvements to Explore**

- feat: Add sort by metric for charts with multiple metrics (#[13057](https://github.com/apache/superset/pull/13057))
- feat: add sort_by_metric for charts with single metric (#[13058](https://github.com/apache/superset/pull/13058))
- feat: Add sort by for dist bar chart (#[13049](https://github.com/apache/superset/pull/13049))
- feat: reset metrics on dataset change (#[12782](https://github.com/apache/superset/pull/12782))
- feat: clear search on dataset change (#[12909](https://github.com/apache/superset/pull/12909))
- feat: default timepicker to last week when dataset is changed (#[12609](https://github.com/apache/superset/pull/12609))

**Improvements to Developer Experience**

- chore: add non-dev docker-compose workflow (#[13143](https://github.com/apache/superset/pull/13143))
- feat(style-theme): add support for custom superset themes (#[12858](https://github.com/apache/superset/pull/12858))
- feat: Move SQLAlchemy url reference to config (#[13182](https://github.com/apache/superset/pull/13182))
- feat(helm): Evaluate configOverrides as templates (#[13130](https://github.com/apache/superset/pull/13130))
- feat(helm): Helm template for Celery beat (for reporting and alerting) (#[13116](https://github.com/apache/superset/pull/13116))
- feat: Custom superset_config.py + secret envs (#[13096](https://github.com/apache/superset/pull/13096))
- feat: Force pod restart on config changes (#[13056](https://github.com/apache/superset/pull/13056))
- feat: add separate endpoint to fetch function names for autocomplete (#[12840](https://github.com/apache/superset/pull/12840))
- feat: request ids on API related endpoints (#[12663](https://github.com/apache/superset/pull/12663))
- feat: Adding option to `set_database_uri` CLI command (#[12740](https://github.com/apache/superset/pull/12740))
- feat: add decorator to guard public APIs (#[12635](https://github.com/apache/superset/pull/12635))

## Breaking Changes and Full Changelog

- To see the complete changelog in this release, head to [CHANGELOG.MD](https://github.com/apache/superset/blob/master/CHANGELOG.md).
- You can find a list of backwards incompatible changes [here](https://github.com/apache/superset/blob/3d103e66fcaee42a6b4a42b2638e13d5e2208c3b/UPDATING.md).
