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

- CLIENT_CACHE
- DASHBOARD_CACHE
- DASHBOARD_NATIVE_FILTERS_SET
- DISABLE_DATASET_SOURCE_EDIT
- ENABLE_EXPLORE_JSON_CSRF_PROTECTION
- KV_STORE
- PRESTO_EXPAND_DATA
- REMOVE_SLICE_LEVEL_LABEL_COLORS
- SHARE_QUERIES_VIA_KV_STORE
- TAGGING_SYSTEM
- ENABLE_TEMPLATE_REMOVE_FILTERS

## In Testing
These features are **finished** but currently being tested. They are usable, but may still contain some bugs.

- ALERT_REPORTS: [(docs)](https://superset.apache.org/docs/installation/alerts-reports)
- DYNAMIC_PLUGINS: [(docs)](https://superset.apache.org/docs/installation/running-on-kubernetes)
- DASHBOARD_NATIVE_FILTERS
- GLOBAL_ASYNC_QUERIES [(docs)](https://github.com/apache/superset/blob/master/CONTRIBUTING.md#async-chart-queries)
- OMNIBAR
- VERSIONED_EXPORT
- ENABLE_JAVASCRIPT_CONTROLS

## Stable
These features flags are **safe for production** and have been tested.

- DASHBOARD_CROSS_FILTERS
- DASHBOARD_RBAC [(docs)](https://superset.apache.org/docs/creating-charts-dashboards/first-dashboard#manage-access-to-dashboards)
- ESCAPE_MARKDOWN_HTML
- ENABLE_TEMPLATE_PROCESSING
- LISTVIEWS_DEFAULT_CARD_VIEW
- ROW_LEVEL_SECURITY
- SCHEDULED_QUERIES [(docs)](https://superset.apache.org/docs/installation/alerts-reports)
- SQL_VALIDATORS_BY_ENGINE [(docs)](https://superset.apache.org/docs/installation/sql-templating)
- SQLLAB_BACKEND_PERSISTENCE
- THUMBNAILS [(docs)](https://superset.apache.org/docs/installation/cache)

## Deprecated Flags
These features flags currently default to True and **will be removed in a future major release**. For this current release you can turn them off by setting your config to False, but it is advised to remove or set these flags in your local configuration to **True** so that you do not experience any unexpected changes in a future release.

- ALLOW_DASHBOARD_DOMAIN_SHARDING
- DISPLAY_MARKDOWN_HTML
- ENABLE_REACT_CRUD_VIEWS
