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
export enum FeatureFlag {
  ALLOW_DASHBOARD_DOMAIN_SHARDING = 'ALLOW_DASHBOARD_DOMAIN_SHARDING',
  ALERT_REPORTS = 'ALERT_REPORTS',
  CLIENT_CACHE = 'CLIENT_CACHE',
  DYNAMIC_PLUGINS = 'DYNAMIC_PLUGINS',
  SCHEDULED_QUERIES = 'SCHEDULED_QUERIES',
  SQL_VALIDATORS_BY_ENGINE = 'SQL_VALIDATORS_BY_ENGINE',
  ESTIMATE_QUERY_COST = 'ESTIMATE_QUERY_COST',
  SHARE_QUERIES_VIA_KV_STORE = 'SHARE_QUERIES_VIA_KV_STORE',
  SQLLAB_BACKEND_PERSISTENCE = 'SQLLAB_BACKEND_PERSISTENCE',
  THUMBNAILS = 'THUMBNAILS',
  LISTVIEWS_DEFAULT_CARD_VIEW = 'LISTVIEWS_DEFAULT_CARD_VIEW',
  DISABLE_LEGACY_DATASOURCE_EDITOR = 'DISABLE_LEGACY_DATASOURCE_EDITOR',
  DISABLE_DATASET_SOURCE_EDIT = 'DISABLE_DATASET_SOURCE_EDIT',
  DISPLAY_MARKDOWN_HTML = 'DISPLAY_MARKDOWN_HTML',
  ESCAPE_MARKDOWN_HTML = 'ESCAPE_MARKDOWN_HTML',
  DASHBOARD_NATIVE_FILTERS = 'DASHBOARD_NATIVE_FILTERS',
  DASHBOARD_CROSS_FILTERS = 'DASHBOARD_CROSS_FILTERS',
  DASHBOARD_NATIVE_FILTERS_SET = 'DASHBOARD_NATIVE_FILTERS_SET',
  DASHBOARD_FILTERS_EXPERIMENTAL = 'DASHBOARD_FILTERS_EXPERIMENTAL',
  EMBEDDED_SUPERSET = 'EMBEDDED_SUPERSET',
  ENABLE_FILTER_BOX_MIGRATION = 'ENABLE_FILTER_BOX_MIGRATION',
  VERSIONED_EXPORT = 'VERSIONED_EXPORT',
  GLOBAL_ASYNC_QUERIES = 'GLOBAL_ASYNC_QUERIES',
  ENABLE_TEMPLATE_PROCESSING = 'ENABLE_TEMPLATE_PROCESSING',
  ENABLE_EXPLORE_DRAG_AND_DROP = 'ENABLE_EXPLORE_DRAG_AND_DROP',
  ENABLE_DND_WITH_CLICK_UX = 'ENABLE_DND_WITH_CLICK_UX',
  FORCE_DATABASE_CONNECTIONS_SSL = 'FORCE_DATABASE_CONNECTIONS_SSL',
  ENABLE_TEMPLATE_REMOVE_FILTERS = 'ENABLE_TEMPLATE_REMOVE_FILTERS',
  ENABLE_JAVASCRIPT_CONTROLS = 'ENABLE_JAVASCRIPT_CONTROLS',
  DASHBOARD_RBAC = 'DASHBOARD_RBAC',
  ALERTS_ATTACH_REPORTS = 'ALERTS_ATTACH_REPORTS',
  ALLOW_FULL_CSV_EXPORT = 'ALLOW_FULL_CSV_EXPORT',
  UX_BETA = 'UX_BETA',
  GENERIC_CHART_AXES = 'GENERIC_CHART_AXES',
}
export type ScheduleQueriesProps = {
  JSONSCHEMA: {
    [key: string]: string;
  };
  UISCHEMA: {
    [key: string]: string;
  };
  VALIDATION: {
    [key: string]: string;
  };
};
export type FeatureFlagMap = {
  [key in Exclude<FeatureFlag, FeatureFlag.SCHEDULED_QUERIES>]?: boolean;
} & {
  SCHEDULED_QUERIES?: ScheduleQueriesProps;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare global {
  interface Window {
    featureFlags: FeatureFlagMap;
  }
}

export function isFeatureEnabled(feature: FeatureFlag) {
  return window && window.featureFlags && !!window.featureFlags[feature];
}
