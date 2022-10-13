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

- CLIENT_CACHE
- CROSS_REFERENCES
- DASHBOARD_CACHE
- DASHBOARD_NATIVE_FILTERS_SET
- DISABLE_DATASET_SOURCE_EDIT
- DRILL_TO_DETAIL
- ENABLE_ADVANCED_DATA_TYPES
- ENABLE_EXPLORE_JSON_CSRF_PROTECTION
- ENABLE_TEMPLATE_REMOVE_FILTERS
- KV_STORE
- PRESTO_EXPAND_DATA
- REMOVE_SLICE_LEVEL_LABEL_COLORS
- SHARE_QUERIES_VIA_KV_STORE
- TAGGING_SYSTEM

## In Testing

These features are **finished** but currently being tested. They are usable, but may still contain some bugs.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- ALERT_REPORTS: [(docs)](https://superset.apache.org/docs/installation/alerts-reports)
- ALLOW_FULL_CSV_EXPORT
- CACHE_IMPERSONATION
- DASHBOARD_EDIT_CHART_IN_NEW_TAB
- DASHBOARD_FILTERS_EXPERIMENTAL
- DASHBOARD_NATIVE_FILTERS
- DYNAMIC_PLUGINS: [(docs)](https://superset.apache.org/docs/installation/running-on-kubernetes)
- ENABLE_FILTER_BOX_MIGRATION
- ENABLE_JAVASCRIPT_CONTROLS
- GENERIC_CHART_AXES
- GLOBAL_ASYNC_QUERIES [(docs)](https://github.com/apache/superset/blob/master/CONTRIBUTING.md#async-chart-queries)
- RLS_IN_SQLLAB
- USE_ANALAGOUS_COLORS
- UX_BETA
- VERSIONED_EXPORT

## Stable

These features flags are **safe for production** and have been tested.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- ALERTS_ATTACH_REPORTS
- ALLOW_ADHOC_SUBQUERY
- DASHBOARD_CROSS_FILTERS
- DASHBOARD_RBAC [(docs)](https://superset.apache.org/docs/creating-charts-dashboards/first-dashboard#manage-access-to-dashboards)
- DISABLE_LEGACY_DATASOURCE_EDITOR
- DRUID_JOINS
- EMBEDDABLE_CHARTS
- EMBEDDED_SUPERSET
- ENABLE_DND_WITH_CLICK_UX
- ENABLE_EXPLORE_DRAG_AND_DROP
- ENABLE_TEMPLATE_PROCESSING
- ENFORCE_DB_ENCRYPTION_UI
- ESCAPE_MARKDOWN_HTML
- LISTVIEWS_DEFAULT_CARD_VIEW
- SCHEDULED_QUERIES [(docs)](https://superset.apache.org/docs/installation/alerts-reports)
- SQLLAB_BACKEND_PERSISTENCE
- SQL_VALIDATORS_BY_ENGINE [(docs)](https://superset.apache.org/docs/installation/sql-templating)
- THUMBNAILS [(docs)](https://superset.apache.org/docs/installation/cache)

## Deprecated Flags

These features flags currently default to True and **will be removed in a future major release**. For this current release you can turn them off by setting your config to False, but it is advised to remove or set these flags in your local configuration to **True** so that you do not experience any unexpected changes in a future release.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- ALLOW_DASHBOARD_DOMAIN_SHARDING
- DISPLAY_MARKDOWN_HTML
- FORCE_DATABASE_CONNECTIONS_SSL
