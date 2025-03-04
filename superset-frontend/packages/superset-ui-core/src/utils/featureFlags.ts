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
  AlertReportSlackV2 = 'ALERT_REPORT_SLACK_V2',
  AllowFullCsvExport = 'ALLOW_FULL_CSV_EXPORT',
  AvoidColorsCollision = 'AVOID_COLORS_COLLISION',
  ChartPluginsExperimental = 'CHART_PLUGINS_EXPERIMENTAL',
  ConfirmDashboardDiff = 'CONFIRM_DASHBOARD_DIFF',
  DashboardVirtualization = 'DASHBOARD_VIRTUALIZATION',
  DashboardRbac = 'DASHBOARD_RBAC',
  DatapanelClosedByDefault = 'DATAPANEL_CLOSED_BY_DEFAULT',
  /** @deprecated */
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
  ListviewsDefaultCardView = 'LISTVIEWS_DEFAULT_CARD_VIEW',
  ScheduledQueries = 'SCHEDULED_QUERIES',
  SqllabBackendPersistence = 'SQLLAB_BACKEND_PERSISTENCE',
  SqlValidatorsByEngine = 'SQL_VALIDATORS_BY_ENGINE',
  SshTunneling = 'SSH_TUNNELING',
  TaggingSystem = 'TAGGING_SYSTEM',
  Thumbnails = 'THUMBNAILS',
  UseAnalogousColors = 'USE_ANALOGOUS_COLORS',
  ForceSqlLabRunAsync = 'SQLLAB_FORCE_RUN_ASYNC',
  SlackEnableAvatars = 'SLACK_ENABLE_AVATARS',
  EnableDashboardScreenshotEndpoints = 'ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS',
  EnableDashboardDownloadWebDriverScreenshot = 'ENABLE_DASHBOARD_DOWNLOAD_WEBDRIVER_SCREENSHOT',
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
    return !!window.featureFlags[feature as keyof FeatureFlagMap];
  } catch (error) {
    logger.error(`Failed to query feature flag ${feature}`);
  }
  return false;
}
