// DODO was here
export const DATETIME_WITH_TIME_ZONE = 'YYYY-MM-DD HH:mm:ssZ';
export const TIME_WITH_MS = 'HH:mm:ss.SSS';

export const BOOL_TRUE_DISPLAY = 'True';
export const BOOL_FALSE_DISPLAY = 'False';

/*
 ** APP VERSION BASE is a base from which the app inherited the code base
 ** (i.e. 1.3 => was inherited from Superset 1.3)
 */
const APP_VERSION_BASE = '2.0.1';
const date = new Date();
const month = date.getMonth() + 1;
const day = date.getDate();
const hours = date.getHours();
export const APP_VERSION = `${APP_VERSION_BASE}.${month}-${day}:${hours}`;

export const URL_PARAMS = {
  migrationState: {
    name: 'migration_state',
    type: 'string',
  },
  standalone: {
    name: 'standalone',
    type: 'number',
  },
  uiConfig: {
    name: 'uiConfig',
    type: 'number',
  },
  preselectFilters: {
    name: 'preselect_filters',
    type: 'object',
  },
  nativeFilters: {
    name: 'native_filters',
    type: 'rison',
  },
  nativeFiltersKey: {
    name: 'native_filters_key',
    type: 'string',
  },
  filterSet: {
    name: 'filter_set',
    type: 'string',
  },
  showFilters: {
    name: 'show_filters',
    type: 'boolean',
  },
  expandFilters: {
    name: 'expand_filters',
    type: 'boolean',
  },
  formDataKey: {
    name: 'form_data_key',
    type: 'string',
  },
  sliceId: {
    name: 'slice_id',
    type: 'string',
  },
  datasourceId: {
    name: 'datasource_id',
    type: 'string',
  },
  datasetId: {
    name: 'dataset_id',
    type: 'string',
  },
  datasourceType: {
    name: 'datasource_type',
    type: 'string',
  },
  dashboardId: {
    name: 'dashboard_id',
    type: 'string',
  },
  force: {
    name: 'force',
    type: 'boolean',
  },
  permalinkKey: {
    name: 'permalink_key',
    type: 'string',
  },
} as const;

export const RESERVED_CHART_URL_PARAMS: string[] = [
  URL_PARAMS.formDataKey.name,
  URL_PARAMS.sliceId.name,
  URL_PARAMS.datasourceId.name,
  URL_PARAMS.datasourceType.name,
  URL_PARAMS.datasetId.name,
];
export const RESERVED_DASHBOARD_URL_PARAMS: string[] = [
  URL_PARAMS.nativeFilters.name,
  URL_PARAMS.nativeFiltersKey.name,
  URL_PARAMS.permalinkKey.name,
  URL_PARAMS.preselectFilters.name,
];

/**
 * Faster debounce delay for inputs without expensive operation.
 */
export const FAST_DEBOUNCE = 250;

/**
 * Slower debounce delay for inputs with expensive API calls.
 */
export const SLOW_DEBOUNCE = 500;

/**
 * Display null as `N/A`
 */
export const NULL_DISPLAY = 'N/A';

/**
 * CSV format
 */
export const CSV = 'csv';

/**
 * XLSX format
 */
export const XLSX = 'xlsx';
