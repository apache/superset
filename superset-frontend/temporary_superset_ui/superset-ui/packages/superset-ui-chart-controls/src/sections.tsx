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
import { t } from '@superset-ui/core';
import { ControlPanelSectionConfig } from './types';

// A few standard controls sections that are used internally.
// Not recommended for use in third-party plugins.

const baseTimeSection = {
  label: t('Time'),
  expanded: true,
  description: t('Time related form attributes'),
};

export const legacyTimeseriesTime: ControlPanelSectionConfig = {
  ...baseTimeSection,
  controlSetRows: [
    ['granularity'],
    ['druid_time_origin'],
    ['granularity_sqla'],
    ['time_grain_sqla'],
    ['time_range'],
  ],
};

export const legacyRegularTime: ControlPanelSectionConfig = {
  ...baseTimeSection,
  controlSetRows: [['granularity_sqla'], ['time_range']],
};

export const datasourceAndVizType: ControlPanelSectionConfig = {
  label: t('Datasource & Chart Type'),
  expanded: true,
  controlSetRows: [
    ['datasource'],
    ['viz_type'],
    [
      {
        name: 'slice_id',
        config: {
          type: 'HiddenControl',
          label: t('Chart ID'),
          hidden: true,
          description: t('The id of the active chart'),
        },
      },
      {
        name: 'cache_timeout',
        config: {
          type: 'HiddenControl',
          label: t('Cache Timeout (seconds)'),
          hidden: true,
          description: t('The number of seconds before expiring the cache'),
        },
      },
      {
        name: 'url_params',
        config: {
          type: 'HiddenControl',
          label: t('URL Parameters'),
          hidden: true,
          description: t('Extra parameters for use in jinja templated queries'),
        },
      },
      {
        name: 'time_range_endpoints',
        config: {
          type: 'HiddenControl',
          label: t('Time range endpoints'),
          hidden: true,
          description: t('Time range endpoints (SIP-15)'),
        },
      },
    ],
  ],
};

export const colorScheme: ControlPanelSectionConfig = {
  label: t('Color Scheme'),
  controlSetRows: [['color_scheme', 'label_colors']],
};

export const annotations: ControlPanelSectionConfig = {
  label: t('Annotations and Layers'),
  tabOverride: 'data',
  expanded: true,
  controlSetRows: [
    [
      {
        name: 'annotation_layers',
        config: {
          type: 'AnnotationLayerControl',
          label: '',
          default: [],
          description: 'Annotation Layers',
          renderTrigger: true,
        },
      },
    ],
  ],
};
