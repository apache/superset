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
import { NativeFiltersState } from 'src/dashboard/components/nativeFilters/types';

export const nativeFilters: NativeFiltersState = {
  filters: {
    'NATIVE_FILTER-e7Q8zKixx': {
      id: 'NATIVE_FILTER-e7Q8zKixx',
      name: 'region',
      type: 'text',
      targets: [
        {
          datasetId: 2,
          column: {
            name: 'region',
          },
        },
      ],
      defaultValue: null,
      cascadeParentIds: [],
      scope: {
        rootPath: ['ROOT_ID'],
        excluded: [],
      },
      inverseSelection: false,
      isInstant: true,
      allowsMultipleValues: false,
      isRequired: false,
    },
    'NATIVE_FILTER-x9QPw0so1': {
      id: 'NATIVE_FILTER-x9QPw0so1',
      name: 'country_code',
      type: 'text',
      targets: [
        {
          datasetId: 2,
          column: {
            name: 'country_code',
          },
        },
      ],
      defaultValue: null,
      cascadeParentIds: [],
      scope: {
        rootPath: ['ROOT_ID'],
        excluded: [],
      },
      inverseSelection: false,
      isInstant: true,
      allowsMultipleValues: false,
      isRequired: false,
    },
  },
  filtersState: {
    'NATIVE_FILTER-e7Q8zKixx': {
      id: 'NATIVE_FILTER-e7Q8zKixx',
      extraFormData: {
        append_form_data: {
          filters: [
            {
              col: 'region',
              op: 'IN',
              val: ['East Asia & Pacific'],
            },
          ],
        },
      },
    },
    'NATIVE_FILTER-x9QPw0so1': {
      id: 'NATIVE_FILTER-x9QPw0so1',
      extraFormData: {},
    },
  },
};

export const extraFormData = {
  append_form_data: {
    filters: [
      {
        col: 'ethnic_minority',
        op: 'IN',
        val: 'No, not an ethnic minority',
      },
    ],
  },
};

export const NATIVE_FILTER_ID = 'NATIVE_FILTER-p4LImrSgA';

export const singleNativeFiltersState = {
  filters: {
    [NATIVE_FILTER_ID]: {
      id: [NATIVE_FILTER_ID],
      name: 'eth',
      type: 'text',
      targets: [{ datasetId: 13, column: { name: 'ethnic_minority' } }],
      defaultValue: null,
      cascadeParentIds: [],
      scope: { rootPath: ['ROOT_ID'], excluded: [227, 229] },
      inverseSelection: false,
      isInstant: true,
      allowsMultipleValues: false,
      isRequired: false,
    },
  },
  filtersState: {
    [NATIVE_FILTER_ID]: {
      id: NATIVE_FILTER_ID,
      extraFormData,
    },
  },
};

export const layoutForSingleNativeFilter = {
  'CHART-ZHVS7YasaQ': {
    children: [],
    id: 'CHART-ZHVS7YasaQ',
    meta: {
      chartId: 230,
      height: 50,
      sliceName: 'Pie Chart',
      uuid: '05ef6145-3950-4f59-891f-160852613eca',
      width: 12,
    },
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-NweUz7oC0'],
    type: 'CHART',
  },
  'CHART-gsGu8NIKQT': {
    children: [],
    id: 'CHART-gsGu8NIKQT',
    meta: {
      chartId: 227,
      height: 50,
      sliceName: 'Another Chart',
      uuid: 'ddb78f6c-7876-47fc-ae98-70183b05ba90',
      width: 4,
    },
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-QkiTjeZGs'],
    type: 'CHART',
  },
  'CHART-hgYjD8axJX': {
    children: [],
    id: 'CHART-hgYjD8axJX',
    meta: {
      chartId: 229,
      height: 47,
      sliceName: 'Bar Chart',
      uuid: 'e1501e54-d632-4fdc-ae16-07cafee31093',
      width: 12,
    },
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-mcdVZi0rL'],
    type: 'CHART',
  },
  DASHBOARD_VERSION_KEY: 'v2',
  GRID_ID: {
    children: ['ROW-mcdVZi0rL', 'ROW-NweUz7oC0', 'ROW-QkiTjeZGs'],
    id: 'GRID_ID',
    parents: ['ROOT_ID'],
    type: 'GRID',
  },
  HEADER_ID: {
    id: 'HEADER_ID',
    type: 'HEADER',
    meta: { text: 'My Native Filter Dashboard' },
  },
  ROOT_ID: { children: ['GRID_ID'], id: 'ROOT_ID', type: 'ROOT' },
  'ROW-NweUz7oC0': {
    children: ['CHART-ZHVS7YasaQ'],
    id: 'ROW-NweUz7oC0',
    meta: { background: 'BACKGROUND_TRANSPARENT' },
    parents: ['ROOT_ID', 'GRID_ID'],
    type: 'ROW',
  },
  'ROW-QkiTjeZGs': {
    children: ['CHART-gsGu8NIKQT'],
    id: 'ROW-QkiTjeZGs',
    meta: { background: 'BACKGROUND_TRANSPARENT' },
    parents: ['ROOT_ID', 'GRID_ID'],
    type: 'ROW',
  },
  'ROW-mcdVZi0rL': {
    children: ['CHART-hgYjD8axJX'],
    id: 'ROW-mcdVZi0rL',
    meta: { '0': 'ROOT_ID', background: 'BACKGROUND_TRANSPARENT' },
    parents: ['ROOT_ID', 'GRID_ID'],
    type: 'ROW',
  },
};
