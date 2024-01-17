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

# Superset Feature Flags

This is a list of the current Superset optional features. See config.py for default values. These features can be turned on/off by setting your preferred values in superset_config.py to True/False respectively

## In Development

These features are considered **unfinished** and should only be used on development environments.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- ENABLE_ADVANCED_DATA_TYPES
- PRESTO_EXPAND_DATA
- SHARE_QUERIES_VIA_KV_STORE
- TAGGING_SYSTEM

## In Testing

These features are **finished** but currently being tested. They are usable, but may still contain some bugs.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- ALERT_REPORTS: [(docs)](https://superset.apache.org/docs/installation/alerts-reports)
- ALLOW_FULL_CSV_EXPORT
- CACHE_IMPERSONATION
- CONFIRM_DASHBOARD_DIFF
- DRILL_TO_DETAIL
- DYNAMIC_PLUGINS: [(docs)](https://superset.apache.org/docs/installation/running-on-kubernetes)
- ESTIMATE_QUERY_COST
- GENERIC_CHART_AXES
- GLOBAL_ASYNC_QUERIES [(docs)](https://github.com/apache/superset/blob/master/CONTRIBUTING.md#async-chart-queries)
- HORIZONTAL_FILTER_BAR
- PLAYWRIGHT_REPORTS_AND_THUMBNAILS
- RLS_IN_SQLLAB
- SSH_TUNNELING [(docs)](https://superset.apache.org/docs/installation/setup-ssh-tunneling)
- USE_ANALAGOUS_COLORS

## Stable

These features flags are **safe for production**. They have been tested and will be supported for the foreseeable future.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- ALERTS_ATTACH_REPORTS
- ALLOW_ADHOC_SUBQUERY
- DASHBOARD_CROSS_FILTERS
- DASHBOARD_RBAC [(docs)](https://superset.apache.org/docs/creating-charts-dashboards/first-dashboard#manage-access-to-dashboards)
- DASHBOARD_VIRTUALIZATION
- DATAPANEL_CLOSED_BY_DEFAULT
- DISABLE_LEGACY_DATASOURCE_EDITOR
- DRILL_BY
- DRUID_JOINS
- EMBEDDABLE_CHARTS
- EMBEDDED_SUPERSET
- ENABLE_TEMPLATE_PROCESSING
- ESCAPE_MARKDOWN_HTML
- LISTVIEWS_DEFAULT_CARD_VIEW
- SCHEDULED_QUERIES [(docs)](https://superset.apache.org/docs/installation/alerts-reports)
- SQLLAB_BACKEND_PERSISTENCE
- SQL_VALIDATORS_BY_ENGINE [(docs)](https://superset.apache.org/docs/installation/sql-templating)
- THUMBNAILS [(docs)](https://superset.apache.org/docs/installation/cache)

## Deprecated Flags

These features flags currently default to True and **will be removed in a future major release**. For this current release you can turn them off by setting your config to False, but it is advised to remove or set these flags in your local configuration to **True** so that you do not experience any unexpected changes in a future release.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- DASHBOARD_FILTERS_EXPERIMENTAL
- DASHBOARD_NATIVE_FILTERS
- ENABLE_EXPLORE_JSON_CSRF_PROTECTION
- ENABLE_JAVASCRIPT_CONTROLS
- ENABLE_TEMPLATE_REMOVE_FILTERS
- GENERIC_CHART_AXES
- KV_STORE
- REMOVE_SLICE_LEVEL_LABEL_COLORS
- VERSIONED_EXPORT
