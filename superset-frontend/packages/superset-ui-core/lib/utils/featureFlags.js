/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
// We can codegen the enum definition based on a list of supported flags that we
// check into source control. We're hardcoding the supported flags for now.
export var FeatureFlag;
(function (FeatureFlag) {
    FeatureFlag["ALLOW_DASHBOARD_DOMAIN_SHARDING"] = "ALLOW_DASHBOARD_DOMAIN_SHARDING";
    FeatureFlag["ALERT_REPORTS"] = "ALERT_REPORTS";
    FeatureFlag["OMNIBAR"] = "OMNIBAR";
    FeatureFlag["CLIENT_CACHE"] = "CLIENT_CACHE";
    FeatureFlag["DYNAMIC_PLUGINS"] = "DYNAMIC_PLUGINS";
    FeatureFlag["SCHEDULED_QUERIES"] = "SCHEDULED_QUERIES";
    FeatureFlag["SQL_VALIDATORS_BY_ENGINE"] = "SQL_VALIDATORS_BY_ENGINE";
    FeatureFlag["ESTIMATE_QUERY_COST"] = "ESTIMATE_QUERY_COST";
    FeatureFlag["SHARE_QUERIES_VIA_KV_STORE"] = "SHARE_QUERIES_VIA_KV_STORE";
    FeatureFlag["SQLLAB_BACKEND_PERSISTENCE"] = "SQLLAB_BACKEND_PERSISTENCE";
    FeatureFlag["THUMBNAILS"] = "THUMBNAILS";
    FeatureFlag["LISTVIEWS_DEFAULT_CARD_VIEW"] = "LISTVIEWS_DEFAULT_CARD_VIEW";
    FeatureFlag["ENABLE_REACT_CRUD_VIEWS"] = "ENABLE_REACT_CRUD_VIEWS";
    FeatureFlag["DISABLE_DATASET_SOURCE_EDIT"] = "DISABLE_DATASET_SOURCE_EDIT";
    FeatureFlag["DISPLAY_MARKDOWN_HTML"] = "DISPLAY_MARKDOWN_HTML";
    FeatureFlag["ESCAPE_MARKDOWN_HTML"] = "ESCAPE_MARKDOWN_HTML";
    FeatureFlag["DASHBOARD_NATIVE_FILTERS"] = "DASHBOARD_NATIVE_FILTERS";
    FeatureFlag["DASHBOARD_CROSS_FILTERS"] = "DASHBOARD_CROSS_FILTERS";
    FeatureFlag["DASHBOARD_NATIVE_FILTERS_SET"] = "DASHBOARD_NATIVE_FILTERS_SET";
    FeatureFlag["DASHBOARD_FILTERS_EXPERIMENTAL"] = "DASHBOARD_FILTERS_EXPERIMENTAL";
    FeatureFlag["ENABLE_FILTER_BOX_MIGRATION"] = "ENABLE_FILTER_BOX_MIGRATION";
    FeatureFlag["VERSIONED_EXPORT"] = "VERSIONED_EXPORT";
    FeatureFlag["GLOBAL_ASYNC_QUERIES"] = "GLOBAL_ASYNC_QUERIES";
    FeatureFlag["ENABLE_TEMPLATE_PROCESSING"] = "ENABLE_TEMPLATE_PROCESSING";
    FeatureFlag["ENABLE_EXPLORE_DRAG_AND_DROP"] = "ENABLE_EXPLORE_DRAG_AND_DROP";
    FeatureFlag["ENABLE_DND_WITH_CLICK_UX"] = "ENABLE_DND_WITH_CLICK_UX";
    FeatureFlag["FORCE_DATABASE_CONNECTIONS_SSL"] = "FORCE_DATABASE_CONNECTIONS_SSL";
    FeatureFlag["ENABLE_TEMPLATE_REMOVE_FILTERS"] = "ENABLE_TEMPLATE_REMOVE_FILTERS";
    FeatureFlag["DASHBOARD_RBAC"] = "DASHBOARD_RBAC";
    FeatureFlag["ALERTS_ATTACH_REPORTS"] = "ALERTS_ATTACH_REPORTS";
    FeatureFlag["ALLOW_FULL_CSV_EXPORT"] = "ALLOW_FULL_CSV_EXPORT";
    FeatureFlag["UX_BETA"] = "UX_BETA";
})(FeatureFlag || (FeatureFlag = {}));
export function isFeatureEnabled(feature) {
    return window && window.featureFlags && !!window.featureFlags[feature];
}
//# sourceMappingURL=featureFlags.js.map