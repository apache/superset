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
import { ControlSetItem, Dataset } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import { isEmpty } from 'lodash';
import { isAggMode, isRawMode } from './shared';

export const orderByControlSetItem: ControlSetItem = {
  name: 'order_by_cols',
  config: {
    type: 'SelectControl',
    label: t('Ordering'),
    description: t('Order results by selected columns'),
    multi: true,
    default: [],
    mapStateToProps: ({ datasource }) => ({
      choices: datasource?.hasOwnProperty('order_by_choices')
        ? (datasource as Dataset)?.order_by_choices
        : datasource?.columns || [],
    }),
    visibility: isRawMode,
    resetOnHide: false,
  },
};

export const orderDescendingControlSetItem: ControlSetItem = {
  name: 'order_desc',
  config: {
    type: 'CheckboxControl',
    label: t('Sort descending'),
    default: true,
    description: t('Whether to sort descending or ascending'),
    visibility: ({ controls }) =>
      !!(
        isAggMode({ controls }) &&
        controls?.timeseries_limit_metric.value &&
        !isEmpty(controls?.timeseries_limit_metric.value)
      ),
    resetOnHide: false,
  },
};
