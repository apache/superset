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

# Release Notes for Superset 0.38

## What's new
- [New features](#new-features)
- [Bugfixes](#bugfixes)
- [Breaking Changes](#breaking-changes)
- [Complete Changelog](#complete-changelog)

### New features
**DATABASES, DATASETS, QUERIES**

[SIP-40] Proposal for Custom Error Messages #9194 ([SIP](https://github.com/apache/superset/issues/9194))
- feat: improve presto query perf  (#[11069](https://github.com/apache/superset/pull/11069))
- feat: more specific presto error messages  (#[11099](https://github.com/apache/superset/pull/11099))
- feat: refactor error components and add database issue code  (#[10473](https://github.com/apache/superset/pull/10473))
- feat: welcome presto to the suite of tested databases  (#[10498](https://github.com/apache/superset/pull/10498))


Certification of Data Entities ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/73))
- feat: add certification to metrics  (#[10630](https://github.com/apache/superset/pull/10630))
- feat: add extra column to tables and sql_metrics  (#[10592](https://github.com/apache/superset/pull/10592))
- feat: bump superset-ui for certified tag  (#[10650](https://github.com/apache/superset/pull/10650))


Database CRUD screen refactor/redesign ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/14))
- feat: add/edit database modal form sections UI  (#[10745](https://github.com/apache/superset/pull/10745))
- feat: base tabbed modal for new database CRUD UI  (#[10668](https://github.com/apache/superset/pull/10668))


Database list view refactor/redesign ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/55))
- feat: database delete warning  (#[10800](https://github.com/apache/superset/pull/10800))\
<kbd><img alt="10800" src="media/10800.gif" width="400"/></kbd>
- feat: filters for database list view  (#[10772](https://github.com/apache/superset/pull/10772))
- feat: SIP-34 table list view for databases  (#[10705](https://github.com/apache/superset/pull/10705))


Database list view refactor/redesign #55 ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/55))
- feat(api): database schemas migration to new API   (#[10436](https://github.com/apache/superset/pull/10436))
- feat(database): POST, PUT, DELETE API endpoints  (#[10741](https://github.com/apache/superset/pull/10741))
- feat(databases): test connection api  (#[10723](https://github.com/apache/superset/pull/10723))


Datasets CRUD screen refactor/redesign ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/13))
- feat: dataset editor improvements  (#[10444](https://github.com/apache/superset/pull/10444))\
<kbd><img alt="10444" src="media/10444.gif" width="400"/></kbd>


Datasets CRUD screen refactor/redesign #13 ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/13))
- feat(datasource): remove deleted columns and update column type on metadata refresh  (#[10619](https://github.com/apache/superset/pull/10619))\
  <kbd><img alt="10619" src="media/10619.png" width="400"/></kbd>


Datasets list view refactor/redesign #12 ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/12))
- feat: update dataset editor modal  (#[10347](https://github.com/apache/superset/pull/10347))\
  <kbd><img alt="10347" src="media/10347.gif" width="400"/></kbd>


- feat(datasets): REST API bulk delete  (#[11237](https://github.com/apache/superset/pull/11237))


Saved queries CRUD screen + list view refactor/redesign #15 ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/15))
- feat: CRUD REST API for saved queries  (#[10777](https://github.com/apache/superset/pull/10777))
- feat: saved query list actions  (#[11109](https://github.com/apache/superset/pull/11109))\
<kbd><img alt="11109" src="media/11109.gif" width="400"/></kbd>

- feat: saved query list view + sort/filters  (#[11005](https://github.com/apache/superset/pull/11005))
- feat: SavedQuery REST API for bulk delete and new API fields  (#[10793](https://github.com/apache/superset/pull/10793))
- feat: update saved query backend routing + add savedquery list  (#[10922](https://github.com/apache/superset/pull/10922))
- feat(saved_queries): add custom api filter for all string & text fields  (#[11031](https://github.com/apache/superset/pull/11031))


Other features
- feat: dataset REST API for distinct values  (#[10595](https://github.com/apache/superset/pull/10595))


**EXPLORE, CHARTS, DASHBOARDS**

[SIP-40] Proposal for Custom Error Messages #9194 ([SIP](https://github.com/apache/superset/issues/9194))
- feat: add download as image button to explore  (#[10297](https://github.com/apache/superset/pull/10297))\
<kbd><img alt="10297" src="media/10297.gif" width="400"/></kbd>


[SIP-34] Proposal to establish a new design direction, system, and process for Superset ([SIP](https://github.com/apache/superset/issues/8976))
- feat: SIP-34 explore save modal  (#[10355](https://github.com/apache/superset/pull/10355))\
<kbd><img alt="10355" src="media/10355.gif" width="400"/></kbd>


Charts list view refactor/redesign ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/47))
- feat(charts): modify custom api filter to include more fields  (#[11054](https://github.com/apache/superset/pull/11054))


Echarts integration ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/48))
- feat: add linear color scale to sunburst chart  (#[10474](https://github.com/apache/superset/pull/10474))\
<kbd><img alt="10474" src="media/10474.gif" width="400"/></kbd>

- feat: add optional prophet forecasting functionality to chart data api  (#[10324](https://github.com/apache/superset/pull/10324))
- feat(viz): add ECharts Timeseries chart  (#[10752](https://github.com/apache/superset/pull/10752))\
<kbd><img alt="10752" src="media/10752.gif" width="400"/></kbd>


Improvements to cache handling #74 ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/74))
- feat: add ECharts Pie chart  (#[10966](https://github.com/apache/superset/pull/10966))\
<kbd><img alt="10966" src="media/10966.gif" width="400"/></kbd>

- feat: implement cache invalidation api  (#[10761](https://github.com/apache/superset/pull/10761))
- feat: Adding extra_filters to warm_up_cache  (#[10675](https://github.com/apache/superset/pull/10675))


[SIP-34] Proposal to establish a new design direction, system, and process for Superset ([SIP](https://github.com/apache/superset/issues/8976))
- feat: add favorite star to dashboard and chart lists  (#[10510](https://github.com/apache/superset/pull/10510))\
<kbd><img alt="10510" src="media/10510.png" width="400"/></kbd>

- feat: use svg for checkbox component  (#[10799](https://github.com/apache/superset/pull/10799))\
<kbd><img alt="10799" src="media/10799.gif" width="400"/></kbd>


Other features
- feat(table-viz): translation and metric column header align right  (#[10549](https://github.com/apache/superset/pull/10549))


- feat: adding dashboard toggle fullscreen button  (#[10840](https://github.com/apache/superset/pull/10840))\
<kbd><img alt="10840" src="media/10840.png" width="400"/></kbd>
- feat: enable ETag header for dashboard GET requests  (#[10963](https://github.com/apache/superset/pull/10963))
- feat: move ace-editor and mathjs to async modules  (#[10837](https://github.com/apache/superset/pull/10837))
- feat: server side dashboard css for less repaint  (#[10850](https://github.com/apache/superset/pull/10850))
- feat: use shorten url in standalone iframe  (#[10651](https://github.com/apache/superset/pull/10651))


**SQL LAB**
- feat: Adding table comment and columns comment for SQLLab  (#[10844](https://github.com/apache/superset/pull/10844))


**SYSTEM, OTHER**
- feat: add TXT as default CSV extension  (#[10371](https://github.com/apache/superset/pull/10371))


[SIP-34] Proposal to establish a new design direction, system, and process for Superset ([SIP](https://github.com/apache/superset/issues/8976))
- feat: card view bulk select  (#[10607](https://github.com/apache/superset/pull/10607))
- feat: custom favorite filter for dashboards, charts and saved queries  (#[11083](https://github.com/apache/superset/pull/11083))
- feat: SIP-34 card/grid views for dashboards and charts   (#[10526](https://github.com/apache/superset/pull/10526))
- feat(listviews): SIP-34 Bulk Select  (#[10298](https://github.com/apache/superset/pull/10298))
- feat(listviews): SIP-34 filters for charts, dashboards, datasets  (#[10335](https://github.com/apache/superset/pull/10335))


[SIP-40] Proposal for Custom Error Messages #9194 ([SIP](https://github.com/apache/superset/issues/9194))
- feat: update timeout error UX  (#[10274](https://github.com/apache/superset/pull/10274))


Alerts (send notification when a condition is met) ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/54))
- feat: add test email functionality to SQL-based email alerts  (#[10476](https://github.com/apache/superset/pull/10476))
- feat: refractored SQL-based alerting framework  (#[10605](https://github.com/apache/superset/pull/10605))


[SIP-34] Proposal to establish a new design direction, system, and process for Superset ([SIP](https://github.com/apache/superset/issues/8976))
- feat: adding all icons from the design system to the codebase  (#[11033](https://github.com/apache/superset/pull/11033))
- feat: storybook for Icon component  (#[10515](https://github.com/apache/superset/pull/10515))


[SIP-48] Using Ant Design as our primary component library ([SIP](https://github.com/apache/superset/issues/10254))
- feat: Add antd to the codebase  (#[10508](https://github.com/apache/superset/pull/10508))


Alerts (send notification when a condition is met) ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/54))
- feat: updated email format for SQL-based email alerts  (#[10512](https://github.com/apache/superset/pull/10512))


Superset Component library - Phase 1 ([Roadmap](https://github.com/apache-superset/superset-roadmap/issues/23))
- feat: adding Storybook to Superset  (#[10383](https://github.com/apache/superset/pull/10383))


Other
- feat: Allow tests files in  /src (plus Label component tests)  (#[10634](https://github.com/apache/superset/pull/10634))
- feat: Getting fancier with Storybook  (#[10647](https://github.com/apache/superset/pull/10647))


### Bugfixes

- fix(permissions): alpha role has all full features  (#[10241](https://github.com/apache/superset/pull/10241))
- fix: broken glyphicons used in react-json-schema  (#[10267](https://github.com/apache/superset/pull/10267))
- fix: add additional ui tweaks  (#[10275](https://github.com/apache/superset/pull/10275))
- fix: saving custom CSS correctly  (#[10289](https://github.com/apache/superset/pull/10289))
- fix: fetch datasets list after dataset created successfully  (#[10290](https://github.com/apache/superset/pull/10290))
- fix: update community Slack link  (#[10360](https://github.com/apache/superset/pull/10360))
- fix: allow creating table option and remove schema requirement in dataset add modal  (#[10369](https://github.com/apache/superset/pull/10369))
- fix(datasets): sort and humanized modified by  (#[10380](https://github.com/apache/superset/pull/10380))
- fix(api): fixes perf on charts and introduces sorting by database on datasets  (#[10392](https://github.com/apache/superset/pull/10392))
- fix(api): fixes openapi spec errors and adds a test to validate all spec  (#[10393](https://github.com/apache/superset/pull/10393))
- fix(charts): disable CSRF for chart data endpoint  (#[10397](https://github.com/apache/superset/pull/10397))
- fix: dataset list filters bug  (#[10398](https://github.com/apache/superset/pull/10398))
- fix: remove FAB rendered menu in favor of react based one  (#[10401](https://github.com/apache/superset/pull/10401))
- fix: show label for filters in filter box in explore  (#[10412](https://github.com/apache/superset/pull/10412))
- fix: Implement updates to SQL-based email alerts  (#[10454](https://github.com/apache/superset/pull/10454))
- fix(presto): Handle ROW data stored as string  (#[10456](https://github.com/apache/superset/pull/10456))
- fix: change "add new slice" copy to "add new chart"  (#[10457](https://github.com/apache/superset/pull/10457))
- fix(sqllab): button width isn't wide enough for 'Run Selection'  (#[10461](https://github.com/apache/superset/pull/10461))
- fix: timeout error message  (#[10478](https://github.com/apache/superset/pull/10478))
- fix: enforce mandatory chart name on save and edit  (#[10482](https://github.com/apache/superset/pull/10482))
- fix: More tweaks needed after adding Doctype tag  (#[10504](https://github.com/apache/superset/pull/10504))
- fix: explore panel missing padding  (#[10505](https://github.com/apache/superset/pull/10505))
- fix: refactored SQL-based alerts to not pass sqlalchemy objects as args  (#[10506](https://github.com/apache/superset/pull/10506))
- fix(sqllab): Handle long table names in SQL Lab  (#[10518](https://github.com/apache/superset/pull/10518))
- fix: make SQL-based alert email links user friendly  (#[10519](https://github.com/apache/superset/pull/10519))
- fix(dashboard): changing the chart title, except not  (#[10527](https://github.com/apache/superset/pull/10527))
- fix: misaligned LimitControl buttons and port jsx->tsx  (#[10529](https://github.com/apache/superset/pull/10529))
- fix: Resolves #10535  (#[10536](https://github.com/apache/superset/pull/10536))
- fix: add retry to SQL-based alerting celery task  (#[10542](https://github.com/apache/superset/pull/10542))
- fix: Updating Dockerfile to work with updated python requirements.  (#[10550](https://github.com/apache/superset/pull/10550))
- fix(thumbnails): missing field, logging and new config var  (#[10562](https://github.com/apache/superset/pull/10562))
- fix: add translate for dropdown menu  (#[10573](https://github.com/apache/superset/pull/10573))
- fix: error message modal overflow  (#[10580](https://github.com/apache/superset/pull/10580))
- fix: add None checking to cast_to_num  (#[10584](https://github.com/apache/superset/pull/10584))
- fix: removing unsupported modal sizes  (#[10625](https://github.com/apache/superset/pull/10625))
- fix: remove duplicated params and cache_timeout from list_columns; add viz_type to list_columns  (#[10643](https://github.com/apache/superset/pull/10643))
- fix: controls scroll issue  (#[10644](https://github.com/apache/superset/pull/10644))
- fix(db_engine_specs): improve Presto column type matching  (#[10658](https://github.com/apache/superset/pull/10658))
- fix(db_engine_specs): mysql longtext type should not be numeric  (#[10661](https://github.com/apache/superset/pull/10661))
- fix: change public role like gamma procedure  (#[10674](https://github.com/apache/superset/pull/10674))
- fix(sqllab): log exceptions caused by the user as debug and not error  (#[10676](https://github.com/apache/superset/pull/10676))
- fix: only call signal if executing on the main thread  (#[10677](https://github.com/apache/superset/pull/10677))
- fix: layout flexiness  (#[10681](https://github.com/apache/superset/pull/10681))
- fix: SubMenu css  (#[10682](https://github.com/apache/superset/pull/10682))
- fix: dashboard extra filters  (#[10692](https://github.com/apache/superset/pull/10692))
- fix: shorten url with extra request parameters  (#[10693](https://github.com/apache/superset/pull/10693))
- fix: card view failed cypress tests  (#[10699](https://github.com/apache/superset/pull/10699))
- fix: deprecation warnings due to invalid escape sequences.  (#[10710](https://github.com/apache/superset/pull/10710))
- fix: move menu reorg logic from crud app into Menu component  (#[10717](https://github.com/apache/superset/pull/10717))
- fix: local docker deployment  (#[10738](https://github.com/apache/superset/pull/10738))
- Fix: Rejiggering some dependencies, trying to get CI to pass  (#[10747](https://github.com/apache/superset/pull/10747))
- fix(presto): default unknown types to string type  (#[10753](https://github.com/apache/superset/pull/10753))
- fix: add validator information to email/slack alerts  (#[10762](https://github.com/apache/superset/pull/10762))
- fix: re-installing local superset in cache image  (#[10766](https://github.com/apache/superset/pull/10766))
- fix: can not type `0.05` in `TextControl`  (#[10778](https://github.com/apache/superset/pull/10778))
- fix: MVC show saved query  (#[10781](https://github.com/apache/superset/pull/10781))
- fix: disable domain sharding on explore view  (#[10787](https://github.com/apache/superset/pull/10787))
- fix: Database API missing allow none on fields  (#[10795](https://github.com/apache/superset/pull/10795))
- fix: bump node version on Dockerfile to be on par with docker-compose  (#[10813](https://github.com/apache/superset/pull/10813))
- fix(tests): export dataset tests fails with presto  (#[10818](https://github.com/apache/superset/pull/10818))
- fix: use nullpool in the celery workers  (#[10819](https://github.com/apache/superset/pull/10819))
- fix: Making the database read-only  (#[10823](https://github.com/apache/superset/pull/10823))
- fix(databases): test connection api endpoint  (#[10824](https://github.com/apache/superset/pull/10824))
- fix: update the time filter for 'Last Year' option in explore  (#[10829](https://github.com/apache/superset/pull/10829))
- fix(test): missing auth on tests  (#[10842](https://github.com/apache/superset/pull/10842))
- fix(cypress): wait for filterValues request  (#[10884](https://github.com/apache/superset/pull/10884))
- fix: superset alerting misc fixes  (#[10891](https://github.com/apache/superset/pull/10891))
- fix(cypress): prevent CI failure on codecov failure  (#[10892](https://github.com/apache/superset/pull/10892))
- fix:  front end CI tests and test runner  (#[10897](https://github.com/apache/superset/pull/10897))
- fix: babel script broken by format string  (#[10902](https://github.com/apache/superset/pull/10902))
- fix: several disabled pylint rules in models/helpers.py  (#[10909](https://github.com/apache/superset/pull/10909))
- fix: spelling in docs homepage  (#[10912](https://github.com/apache/superset/pull/10912))
- fix: address all disabled pylint checks in charts/api.py  (#[10932](https://github.com/apache/superset/pull/10932))
- fix: use nullpool even for user lookup in the celery  (#[10938](https://github.com/apache/superset/pull/10938))
- fix: update pylint disabled checks in common/query_context.py  (#[10941](https://github.com/apache/superset/pull/10941))
- fix: setting specific exceptions common/query_context.py  (#[10942](https://github.com/apache/superset/pull/10942))
- fix: re-enabling several globally disabled lint rules  (#[10957](https://github.com/apache/superset/pull/10957))
- fix: removed disabled lint rule `too-many-locals` in connectors/base/models.py  (#[10958](https://github.com/apache/superset/pull/10958))
- fix: typo in prefer typescript  (#[10959](https://github.com/apache/superset/pull/10959))
- fix: pylint checks in connectors/sqla/models.py  (#[10974](https://github.com/apache/superset/pull/10974))
- fix: pylint disabled rules in dashboard/api.py  (#[10976](https://github.com/apache/superset/pull/10976))
- fix: changes a pylint check in dashboard module  (#[10978](https://github.com/apache/superset/pull/10978))
- fix: changed disabled rules in datasets module  (#[10979](https://github.com/apache/superset/pull/10979))
- fix: Add Item Overflow on Dataset Editor  (#[10983](https://github.com/apache/superset/pull/10983))
- fix: enable pylint rules in db_engine_specs module  (#[10998](https://github.com/apache/superset/pull/10998))
- fix: enable several pylint rules partially in db_engines_specs module  (#[11000](https://github.com/apache/superset/pull/11000))
- fix: unbreak ci  (#[11003](https://github.com/apache/superset/pull/11003))
- fix: timer component, fixes #10849, closes #11002  (#[11004](https://github.com/apache/superset/pull/11004))
- fix: menu shows a 0 when there are not settings  (#[11009](https://github.com/apache/superset/pull/11009))
- fix: reenable pylint rule `unused-import` in charts and connectors modules  (#[11014](https://github.com/apache/superset/pull/11014))
- fix: query search low privileged user search access denied  (#[11017](https://github.com/apache/superset/pull/11017))
- fix(api): unable to delete virtual dataset, wrong permission name  (#[11019](https://github.com/apache/superset/pull/11019))
- fix: [dashboard] should not show edit button when user has no edit permit  (#[11024](https://github.com/apache/superset/pull/11024))
- fix: dashboard edit button (again)  (#[11029](https://github.com/apache/superset/pull/11029))
- fix: sql lab autocomplete width  (#[11063](https://github.com/apache/superset/pull/11063))
- fix: fix table existence validation function  (#[11066](https://github.com/apache/superset/pull/11066))
- fix: database list checkboxes  (#[11068](https://github.com/apache/superset/pull/11068))
- fix: Adding timeout to flaky cypress test, to wait for animation to complete  (#[11074](https://github.com/apache/superset/pull/11074))
- fix: surface connection error messages on the client  (#[11077](https://github.com/apache/superset/pull/11077))
- fix(jest): using UTC mock date  (#[11079](https://github.com/apache/superset/pull/11079))
- fix: double scroll bars on dataset editor  (#[11095](https://github.com/apache/superset/pull/11095))
- fix: echarts timeseries groupby  (#[11103](https://github.com/apache/superset/pull/11103))
- fix: Disabling timezone of dataframe before passing Prophet  (#[11107](https://github.com/apache/superset/pull/11107))
- fix(chart-data-api): ignore missing filters  (#[11112](https://github.com/apache/superset/pull/11112))
- fix: alembic migration error msg trying to delete constraint on tables  (#[11115](https://github.com/apache/superset/pull/11115))
- fix: remove extra flash import  (#[11121](https://github.com/apache/superset/pull/11121))
- fix: Revert "Replace reactable with DataTable from superset-ui in QueryTable (#10981)"  (#[11125](https://github.com/apache/superset/pull/11125))
- fix: SpatialControl popover won't open  (#[11127](https://github.com/apache/superset/pull/11127))
- fix: Alembic migration 18532d70ab98  (#[11136](https://github.com/apache/superset/pull/11136))
- fix(examples): missing expressions in birth_names  (#[11141](https://github.com/apache/superset/pull/11141))
- fix: Fix Time Column dropdown for date filter  (#[11149](https://github.com/apache/superset/pull/11149))
- fix(dataset): update user list endpoint  (#[11221](https://github.com/apache/superset/pull/11221))
- fix(crud): set default extra value  (#[11262](https://github.com/apache/superset/pull/11262))
- fix(sqla): allow 'unknown' type queries in explore view  (#[11365](https://github.com/apache/superset/pull/11365))
- fix: prior npm font source had a glitch  (#[11724](https://github.com/apache/superset/pull/11724))


## Breaking Changes
[List of backwards incompatible changes](https://github.com/apache/superset/blob/master/UPDATING.md#0380)

## Complete Changelog
For the complete changelog please see [apache/superset/CHANGELOG.md](https://github.com/apache/superset/blob/master/CHANGELOG.md)
