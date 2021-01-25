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
