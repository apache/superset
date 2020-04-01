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
import { t } from '@superset-ui/translation';
import React from 'react';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [['metric'], ['adhoc_filters']],
    },
    {
      label: t('Options'),
      expanded: true,
      controlSetRows: [
        ['compare_lag', 'compare_suffix'],
        ['y_axis_format'],
        ['show_trend_line', 'start_y_axis_at_zero'],
        ['time_range_fixed'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_picker', null],
        ['header_font_size'],
        ['subheader_font_size'],
      ],
    },
    {
      label: t('Advanced Analytics'),
      expanded: false,
      controlSetRows: [
        [<h1 className="section-header">{t('Rolling Window')}</h1>],
        ['rolling_type', 'rolling_periods', 'min_periods'],
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
    },
    header_font_size: {
      label: t('Big Number Font Size'),
    },
  },
  sectionOverrides: {
    druidTimeSeries: {
      controlSetRows: [['granularity', 'druid_time_origin'], ['time_range']],
    },
    sqlaTimeSeries: {
      controlSetRows: [['granularity_sqla', 'time_grain_sqla'], ['time_range']],
    },
  },
};
