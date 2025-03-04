// DODO was here
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
  SlackEnableAvatars = 'SLACK_ENABLE_AVATARS',
  EnableDashboardScreenshotEndpoints = 'ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS',
  EnableDashboardDownloadWebDriverScreenshot = 'ENABLE_DASHBOARD_DOWNLOAD_WEBDRIVER_SCREENSHOT',
  DashboardNativeFiltersSet = 'DASHBOARD_NATIVE_FILTERS_SET', // DODO added 44211751
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

interface WindowDodoExtended {
  htmlSanitization: boolean; // DODO added 44611022
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare global {
  interface Window extends WindowDodoExtended {
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
