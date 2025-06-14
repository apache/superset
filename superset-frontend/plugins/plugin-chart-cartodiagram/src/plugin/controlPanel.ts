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
import { t, validateNonEmpty } from '@superset-ui/core';
import { ControlPanelConfig } from '@superset-ui/chart-controls';
import { selectedChartMutator } from '../util/controlPanelUtil';

import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '../util/zoomUtil';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'selected_chart',
            config: {
              type: 'SelectAsyncControl',
              mutator: selectedChartMutator,
              multi: false,
              label: t('Chart'),
              validators: [validateNonEmpty],
              description: t('Choose a chart for displaying on the map'),
              placeholder: t('Select chart'),
              onAsyncErrorMessage: t('Error while fetching charts'),
              mapStateToProps: state => {
                if (state?.datasource?.id) {
                  const datasourceId = state.datasource.id;
                  const query = {
                    columns: ['id', 'slice_name', 'params', 'viz_type'],
                    filters: [
                      {
                        col: 'datasource_id',
                        opr: 'eq',
                        value: datasourceId,
                      },
                    ],
                    page: 0,
                    // TODO check why we only retrieve 100 items, even though there are more
                    page_size: 999,
                  };

                  const dataEndpoint = `/api/v1/chart/?q=${JSON.stringify(
                    query,
                  )}`;

                  return { dataEndpoint };
                }
                // could not extract datasource from map
                return {};
              },
            },
          },
        ],
        [
          {
            name: 'geom_column',
            config: {
              type: 'SelectControl',
              label: t('Geometry Column'),
              renderTrigger: false,
              description: t('The name of the geometry column'),
              mapStateToProps: state => ({
                choices: state.datasource?.columns.map(c => [
                  c.column_name,
                  c.column_name,
                ]),
              }),
              validators: [validateNonEmpty],
            },
          },
        ],
      ],
    },
    {
      label: t('Map Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'map_view',
            config: {
              type: 'MapViewControl',
              renderTrigger: true,
              description: t(
                'The extent of the map on application start. FIT DATA automatically sets the extent so that all data points are included in the viewport. CUSTOM allows users to define the extent manually.',
              ),
              label: t('Extent'),
              dontRefreshOnChange: true,
              default: {
                mode: 'FIT_DATA',
              },
            },
          },
        ],
        [
          {
            // name is referenced in 'index.ts' for setting default value
            name: 'layer_configs',
            config: {
              type: 'LayerConfigsControl',
              renderTrigger: true,
              label: t('Layers'),
              default: [],
              description: t('The configuration for the map layers'),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'chart_background_color',
            config: {
              label: t('Background Color'),
              description: t('The background color of the charts.'),
              type: 'ColorPickerControl',
              default: { r: 255, g: 255, b: 255, a: 0.2 },
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'chart_background_border_radius',
            config: {
              label: t('Corner Radius'),
              description: t('The corner radius of the chart background'),
              type: 'SliderControl',
              default: 10,
              min: 0,
              step: 1,
              max: 100,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'chart_size',
            config: {
              type: 'ZoomConfigControl',
              // set this to true, if we are able to render it fast
              renderTrigger: true,
              default: {
                type: 'FIXED',
                configs: {
                  zoom: 6,
                  width: 100,
                  height: 100,
                  slope: 30,
                  exponent: 2,
                },
                // create an object with keys MIN_ZOOM_LEVEL - MAX_ZOOM_LEVEL
                // that all contain the same initial value
                values: {
                  ...Array.from(
                    { length: MAX_ZOOM_LEVEL - MIN_ZOOM_LEVEL + 1 },
                    () => ({ width: 100, height: 100 }),
                  ),
                },
              },
              label: t('Chart size'),
              description: t('Configure the chart size for each zoom level'),
            },
          },
        ],
      ],
    },
  ],
};
export default config;
