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
import {
  t,
  DEFAULT_D3_FORMAT,
  DEFAULT_D3_TIME_FORMAT,
} from '@superset-ui/core';

import { BootstrapData, CommonBootstrapData } from './types/bootstrapTypes';

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
      locale: '',
    },
    settings: [],
    environment_tag: {
      text: '',
      color: '',
    },
  },
  d3_format: DEFAULT_D3_FORMAT,
  d3_time_format: DEFAULT_D3_TIME_FORMAT,
};

export const DEFAULT_BOOTSTRAP_DATA: BootstrapData = {
  common: DEFAULT_COMMON_BOOTSTRAP_DATA,
};

export enum FilterPlugins {
  Select = 'filter_select',
  Range = 'filter_range',
  Time = 'filter_time',
  TimeColumn = 'filter_timecolumn',
  TimeGrain = 'filter_timegrain',
}
