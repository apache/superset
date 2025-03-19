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
import { ensureIsArray, t, validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  getStandardizedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['columns'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
        ['sort_by_metric'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [['y_axis_format', null], ['color_scheme']],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
      description: t('Choose a number format'),
    },
    groupby: {
      label: t('Source'),
      multi: false,
      validators: [validateNonEmpty],
      description: t('Choose a source'),
    },
    columns: {
      label: t('Target'),
      multi: false,
      validators: [validateNonEmpty],
      description: t('Choose a target'),
    },
  },
  formDataOverrides: formData => {
    const groupby = getStandardizedControls()
      .popAllColumns()
      .filter(col => !ensureIsArray(formData.columns).includes(col));
    return {
      ...formData,
      groupby,
      metric: getStandardizedControls().shiftMetric(),
    };
  },
};

export default config;
