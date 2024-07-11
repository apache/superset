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
  AlertsAttachReports = 'ALERTS_ATTACH_REPORTS',
  AlertReports = 'ALERT_REPORTS',
  AlertReportTabs = 'ALERT_REPORT_TABS',
  AllowFullCsvExport = 'ALLOW_FULL_CSV_EXPORT',
  AvoidColorsCollision = 'AVOID_COLORS_COLLISION',
  ChartPluginsExperimental = 'CHART_PLUGINS_EXPERIMENTAL',
  ConfirmDashboardDiff = 'CONFIRM_DASHBOARD_DIFF',
  /** @deprecated */
  DashboardCrossFilters = 'DASHBOARD_CROSS_FILTERS',
  DashboardVirtualization = 'DASHBOARD_VIRTUALIZATION',
  DashboardRbac = 'DASHBOARD_RBAC',
  DatapanelClosedByDefault = 'DATAPANEL_CLOSED_BY_DEFAULT',
  DisableLegacyDatasourceEditor = 'DISABLE_LEGACY_DATASOURCE_EDITOR',
  DrillToDetail = 'DRILL_TO_DETAIL',
  DrillBy = 'DRILL_BY',
  DynamicPlugins = 'DYNAMIC_PLUGINS',
  EmbeddableCharts = 'EMBEDDABLE_CHARTS',
  EmbeddedSuperset = 'EMBEDDED_SUPERSET',
  EnableAdvancedDataTypes = 'ENABLE_ADVANCED_DATA_TYPES',
  /** @deprecated */
  EnableJavascriptControls = 'ENABLE_JAVASCRIPT_CONTROLS',
  EnableTemplateProcessing = 'ENABLE_TEMPLATE_PROCESSING',
  EscapeMarkdownHtml = 'ESCAPE_MARKDOWN_HTML',
  EstimateQueryCost = 'ESTIMATE_QUERY_COST',
  GlobalAsyncQueries = 'GLOBAL_ASYNC_QUERIES',
  HorizontalFilterBar = 'HORIZONTAL_FILTER_BAR',
  ListviewsDefaultCardView = 'LISTVIEWS_DEFAULT_CARD_VIEW',
  ScheduledQueries = 'SCHEDULED_QUERIES',
  ShareQueriesViaKvStore = 'SHARE_QUERIES_VIA_KV_STORE',
  SqllabBackendPersistence = 'SQLLAB_BACKEND_PERSISTENCE',
  SqlValidatorsByEngine = 'SQL_VALIDATORS_BY_ENGINE',
  SshTunneling = 'SSH_TUNNELING',
  TaggingSystem = 'TAGGING_SYSTEM',
  Thumbnails = 'THUMBNAILS',
  UseAnalagousColors = 'USE_ANALAGOUS_COLORS',
  ForceSqlLabRunAsync = 'SQLLAB_FORCE_RUN_ASYNC',
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
  [key in Exclude<FeatureFlag, FeatureFlag.ScheduledQueries>]?: boolean;
} & {
  ScheduledQueries?: ScheduleQueriesProps;
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
