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

- ALERT_REPORT_TABS
- ENABLE_ADVANCED_DATA_TYPES
- PRESTO_EXPAND_DATA
- SHARE_QUERIES_VIA_KV_STORE
- TAGGING_SYSTEM
- CHART_PLUGINS_EXPERIMENTAL

## In Testing

These features are **finished** but currently being tested. They are usable, but may still contain some bugs.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- ALERT_REPORTS: [(docs)](https://superset.apache.org/docs/configuration/alerts-reports)
- ALLOW_FULL_CSV_EXPORT
- CACHE_IMPERSONATION
- CONFIRM_DASHBOARD_DIFF
- DYNAMIC_PLUGINS
- DATE_FORMAT_IN_EMAIL_SUBJECT: [(docs)](https://superset.apache.org/docs/configuration/alerts-reports#commons)
- ENABLE_SUPERSET_META_DB: [(docs)](https://superset.apache.org/docs/configuration/databases/#querying-across-databases)
- ESTIMATE_QUERY_COST
- GLOBAL_ASYNC_QUERIES [(docs)](https://github.com/apache/superset/blob/master/CONTRIBUTING.md#async-chart-queries)
- IMPERSONATE_WITH_EMAIL_PREFIX
- PLAYWRIGHT_REPORTS_AND_THUMBNAILS
- RLS_IN_SQLLAB
- SSH_TUNNELING [(docs)](https://superset.apache.org/docs/configuration/setup-ssh-tunneling)
- USE_ANALAGOUS_COLORS

## Stable

These features flags are **safe for production**. They have been tested and will be supported for the at least the current major version cycle.

[//]: # "PLEASE KEEP THESE LISTS SORTED ALPHABETICALLY"

### Flags on the path to feature launch and flag deprecation/removal

- DASHBOARD_VIRTUALIZATION

### Flags retained for runtime configuration

Currently some of our feature flags act as dynamic configurations that can changed
on the fly. This acts in contradiction with the typical ephemeral feature flag use case,
where the flag is used to mature a feature, and eventually deprecated once the feature is
solid. Eventually we'll likely refactor these under a more formal "dynamic configurations" managed
independently. This new framework will also allow for non-boolean configurations.

- ALERTS_ATTACH_REPORTS
- ALLOW_ADHOC_SUBQUERY
- DASHBOARD_RBAC [(docs)](https://superset.apache.org/docs/using-superset/creating-your-first-dashboard#manage-access-to-dashboards)
- DATAPANEL_CLOSED_BY_DEFAULT
- DRILL_BY
- DRUID_JOINS
- EMBEDDABLE_CHARTS
- EMBEDDED_SUPERSET
- ENABLE_TEMPLATE_PROCESSING
- ESCAPE_MARKDOWN_HTML
- LISTVIEWS_DEFAULT_CARD_VIEW
- SCHEDULED_QUERIES [(docs)](https://superset.apache.org/docs/configuration/alerts-reports)
- SLACK_ENABLE_AVATARS (see `superset/config.py` for more information)
- SQLLAB_BACKEND_PERSISTENCE
- SQL_VALIDATORS_BY_ENGINE [(docs)](https://superset.apache.org/docs/configuration/sql-templating)
- THUMBNAILS [(docs)](https://superset.apache.org/docs/configuration/cache)

## Deprecated Flags

These features flags currently default to True and **will be removed in a future major release**. For this current release you can turn them off by setting your config to False, but it is advised to remove or set these flags in your local configuration to **True** so that you do not experience any unexpected changes in a future release.

[//]: # "PLEASE KEEP THE LIST SORTED ALPHABETICALLY"

- AVOID_COLORS_COLLISION
- DRILL_TO_DETAIL
- ENABLE_JAVASCRIPT_CONTROLS
- KV_STORE
