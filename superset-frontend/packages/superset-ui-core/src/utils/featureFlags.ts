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
import logger from './logging';

// We can codegen the enum definition based on a list of supported flags that we
// check into source control. We're hardcoding the supported flags for now.
export enum FeatureFlag {
  // PLEASE KEEP THE LIST SORTED ALPHABETICALLY
  ALERTS_ATTACH_REPORTS = 'ALERTS_ATTACH_REPORTS',
  ALERT_REPORTS = 'ALERT_REPORTS',
  ALLOW_FULL_CSV_EXPORT = 'ALLOW_FULL_CSV_EXPORT',
  CLIENT_CACHE = 'CLIENT_CACHE',
  DASHBOARD_CROSS_FILTERS = 'DASHBOARD_CROSS_FILTERS',
  DASHBOARD_FILTERS_EXPERIMENTAL = 'DASHBOARD_FILTERS_EXPERIMENTAL',
  CONFIRM_DASHBOARD_DIFF = 'CONFIRM_DASHBOARD_DIFF',
  DASHBOARD_NATIVE_FILTERS = 'DASHBOARD_NATIVE_FILTERS',
  DASHBOARD_NATIVE_FILTERS_SET = 'DASHBOARD_NATIVE_FILTERS_SET',
  DASHBOARD_VIRTUALIZATION = 'DASHBOARD_VIRTUALIZATION',
  DASHBOARD_RBAC = 'DASHBOARD_RBAC',
  DATAPANEL_CLOSED_BY_DEFAULT = 'DATAPANEL_CLOSED_BY_DEFAULT',
  DISABLE_DATASET_SOURCE_EDIT = 'DISABLE_DATASET_SOURCE_EDIT',
  DISABLE_LEGACY_DATASOURCE_EDITOR = 'DISABLE_LEGACY_DATASOURCE_EDITOR',
  DRILL_TO_DETAIL = 'DRILL_TO_DETAIL',
  DRILL_BY = 'DRILL_BY',
  DYNAMIC_PLUGINS = 'DYNAMIC_PLUGINS',
  EMBEDDABLE_CHARTS = 'EMBEDDABLE_CHARTS',
  EMBEDDED_SUPERSET = 'EMBEDDED_SUPERSET',
  ENABLE_ADVANCED_DATA_TYPES = 'ENABLE_ADVANCED_DATA_TYPES',
  ENABLE_EXPLORE_DRAG_AND_DROP = 'ENABLE_EXPLORE_DRAG_AND_DROP',
  ENABLE_JAVASCRIPT_CONTROLS = 'ENABLE_JAVASCRIPT_CONTROLS',
  ENABLE_TEMPLATE_PROCESSING = 'ENABLE_TEMPLATE_PROCESSING',
  ENABLE_TEMPLATE_REMOVE_FILTERS = 'ENABLE_TEMPLATE_REMOVE_FILTERS',
  ESCAPE_MARKDOWN_HTML = 'ESCAPE_MARKDOWN_HTML',
  ESTIMATE_QUERY_COST = 'ESTIMATE_QUERY_COST',
  GENERIC_CHART_AXES = 'GENERIC_CHART_AXES',
  GLOBAL_ASYNC_QUERIES = 'GLOBAL_ASYNC_QUERIES',
  HORIZONTAL_FILTER_BAR = 'HORIZONTAL_FILTER_BAR',
  LISTVIEWS_DEFAULT_CARD_VIEW = 'LISTVIEWS_DEFAULT_CARD_VIEW',
  SCHEDULED_QUERIES = 'SCHEDULED_QUERIES',
  SHARE_QUERIES_VIA_KV_STORE = 'SHARE_QUERIES_VIA_KV_STORE',
  SQLLAB_BACKEND_PERSISTENCE = 'SQLLAB_BACKEND_PERSISTENCE',
  SQL_VALIDATORS_BY_ENGINE = 'SQL_VALIDATORS_BY_ENGINE',
  THUMBNAILS = 'THUMBNAILS',
  USE_ANALAGOUS_COLORS = 'USE_ANALAGOUS_COLORS',
  TAGGING_SYSTEM = 'TAGGING_SYSTEM',
  VERSIONED_EXPORT = 'VERSIONED_EXPORT',
  SSH_TUNNELING = 'SSH_TUNNELING',
  AVOID_COLORS_COLLISION = 'AVOID_COLORS_COLLISION',
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

export function initFeatureFlags(featureFlags?: FeatureFlagMap) {
  if (!window.featureFlags) {
    window.featureFlags = featureFlags || {};
  }
}

export function isFeatureEnabled(feature: FeatureFlag): boolean {
  try {
    return !!window.featureFlags[feature];
  } catch (error) {
    logger.error(`Failed to query feature flag ${feature}`);
  }
  return false;
}
