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
*This is a list of the current Superset optional features. See config.py for default values. These features can be turned on/off by setting your preferred values in superset_config.py to True/False respectively*

## In Development
*These features are considered **unfinished** and should only be used on development environments.*

- **CLIENT_CACHE** *Introduces a client (browser) cache*
- **DISABLE_DATASET_SOURCE_EDIT**
- **DYNAMIC_PLUGINS**
- **ENABLE_EXPLORE_JSON_CSRF_PROTECTION**
- **ENABLE_TEMPLATE_PROCESSING**
- **KV_STORE**
- **PRESTO_EXPAND_DATA**
- **DASHBOARD_CACHE**
- **REMOVE_SLICE_LEVEL_LABEL_COLORS**
- **SHARE_QUERIES_VIA_KV_STORE**
- **TAGGING_SYSTEM**
- **LISTVIEWS_DEFAULT_CARD_VIEW** *Enables the replacement React views for all the FAB views (list, edit, show) with designs introduced in https://github.com/apache/superset/issues/8976 (SIP-34).*
- **ESCAPE_MARKDOWN_HTML**
- **DASHBOARD_NATIVE_FILTERS**
- **DASHBOARD_CROSS_FILTERS**
- **DASHBOARD_NATIVE_FILTERS_SET**
- **GLOBAL_ASYNC_QUERIES**
- **VERSIONED_EXPORT**
- **ROW_LEVEL_SECURITY**
- **DASHBOARD_RBAC**

## In Testing
*These features are **finished** but currently being tested. They are usable, but may still contain some bugs.*

- **ALERT_REPORTS** *Alerts and reports*
- **OMNIBAR** *Feature to search for other dashboards*

## Stable
*These features flags are **safe for production** and have been tested.*

- **SQLLAB_BACKEND_PERSISTENCE**
- **THUMBNAILS** *Exposes API endpoint to compute thumbnails*

## Deprecated
*These features flags currently default to True and **will be removed in a future major release**. For this current release you can turn them off by setting your config to False, but it is advised to remove or set these flags in your local configuration to **True** so that you do not experience any unexpected changes in a future release.*

- **ALLOW_DASHBOARD_DOMAIN_SHARDING** *Allow dashboard to use sub-domains to send chart request*
  - *you also need to ENABLE_CORS and SUPERSET_WEBSERVER_DOMAINS for a list of domains*
- **DISPLAY_MARKDOWN_HTML** *Escapes HTML (rather than rendering it) in Markdown components*
- **ENABLE_REACT_CRUD_VIEWS** *Allows display of HTML tags in Markdown components*
