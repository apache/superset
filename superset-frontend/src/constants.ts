// DODO was here
import { t, DEFAULT_D3_FORMAT } from '@superset-ui/core';

import { BootstrapData, CommonBootstrapData } from './types/bootstrapTypes';

import BASE_VERSION from './version/base';
import CHANGE_VERSION from './version/change';
/*
 ** APP VERSION BASE is a base from which the app inherited the code base
 ** (i.e. 1.3 => was inherited from Superset 1.3)
 */
export const APP_VERSION = `${BASE_VERSION}_${CHANGE_VERSION}`;

export const DATETIME_WITH_TIME_ZONE = 'YYYY-MM-DD HH:mm:ssZ';
export const TIME_WITH_MS = 'HH:mm:ss.SSS';

export const BOOL_TRUE_DISPLAY = 'True';
export const BOOL_FALSE_DISPLAY = 'False';

export const URL_PARAMS = {
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
    type: 'number',
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
  vizType: {
    name: 'viz_type',
    type: 'string',
  },
  showDatabaseModal: {
    name: 'show_database_modal',
    type: 'boolean',
  },
  saveAction: {
    name: 'save_action',
    type: 'string',
  },
  dashboardPageId: {
    name: 'dashboard_page_id',
    type: 'string',
  },
  dashboardFocusedChart: {
    name: 'focused_chart',
    type: 'number',
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
export const NULL_DISPLAY = t('N/A');

export const DEFAULT_COMMON_BOOTSTRAP_DATA: CommonBootstrapData = {
  flash_messages: [],
  conf: {},
  locale: 'en',
  feature_flags: {},
  language_pack: {
    domain: '',
    locale_data: {
      superset: {
        '': {
          domain: 'superset',
          lang: 'en',
          plural_forms: '',
        },
      },
    },
  },
  extra_categorical_color_schemes: [],
  extra_sequential_color_schemes: [],
  theme_overrides: {},
  menu_data: {
    menu: [],
    brand: {
      path: '',
      icon: '',
      alt: '',
      tooltip: '',
      text: '',
    },
    navbar_right: {
      show_watermark: true,
      languages: {},
      show_language_picker: true,
      user_is_anonymous: false,
      user_info_url: '',
      user_login_url: '',
      user_logout_url: '',
      user_profile_url: '',
      locale: '',
    },
    settings: [],
    environment_tag: {
      text: '',
      color: '',
    },
  },
  d3_format: DEFAULT_D3_FORMAT,
};

export const DEFAULT_BOOTSTRAP_DATA: BootstrapData = {
  common: DEFAULT_COMMON_BOOTSTRAP_DATA,
};

// DODO added

/**
 * CSV format
 */
export const CSV = 'csv';
export const CSV_MIME = 'text/csv';

/**
 * XLSX format
 */
export const XLSX = 'xlsx';
export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
