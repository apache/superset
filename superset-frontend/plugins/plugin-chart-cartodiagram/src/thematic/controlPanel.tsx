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
import React from 'react';
import {
  QueryColumn,
  QueryFormData,
  QueryMode,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  ColumnOption,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  sharedControls,
} from '@superset-ui/chart-controls';
import { ColTypeMapping } from './types';
import { GeometryFormat, TimesliderTooltipFormat } from './constants';
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from '../util/zoomUtil';
import MapMaxExtentViewControl from './components/MapMaxExtentControl/MapMaxExtentViewControl';
import {
  geojsonDataToFeatureCollection,
  wkbDataToFeatureCollection,
} from '../util/dataUtil';
import { MapViewConfigs } from '../types';

const columnsControl: typeof sharedControls.groupby = {
  ...sharedControls.groupby,
  label: t('Columns'),
  description: t('Columns to display'),
  multi: true,
  freeForm: true,
  allowAll: true,
  commaChoosesOption: false,
  optionRenderer: c => <ColumnOption showType column={c} />,
  valueRenderer: c => <ColumnOption column={c} />,
  valueKey: 'column_name',
  validators: [validateNonEmpty],
  queryMode: QueryMode.Raw,
  mapStateToProps: ({ datasource }) => ({
    options: datasource?.columns || [],
    default: datasource?.columns.map(c => c.column_name),
  }),
  resetOnHide: false,
};

const config: ControlPanelConfig = {
  /**
   * The control panel is split into two tabs: "Data" and
   * "Customize". The controls that define the inputs to
   * the chart data request, such as columns and metrics, usually
   * reside within "Data", while controls that affect the visual
   * appearance or functionality of the chart are under the
   * "Customize" section.
   */

  // For control input types, see: superset-frontend/src/explore/components/controls/index.js
  controlPanelSections: [
    {
      label: t('Configuration'),
      expanded: true,
      controlSetRows: [
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
        [
          {
            name: 'geom_format',
            config: {
              type: 'SelectControl',
              label: t('Geometry Format'),
              renderTrigger: false,
              description: t(
                'The format of the geometry column. GeoJSON columns are expected to use WGS84 coordinates. The (E)WKB format allows for arbitrary projections, which will be read from the data.',
              ),
              default: GeometryFormat.GEOJSON,
              choices: [
                [GeometryFormat.GEOJSON, t('GeoJSON')],
                [GeometryFormat.WKB, t('(E)WKB')],
              ],
              clearable: false,
              validators: [validateNonEmpty],
            },
          },
        ],
        [
          {
            name: 'columns',
            config: columnsControl,
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
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
                'The map center on application start. FIT DATA automatically sets the center so that all data points are included in the viewport. CUSTOM allows users to define the center manually.',
              ),
              label: t('Initial Map Center'),
              dontRefreshOnChange: true,
              default: {
                mode: 'FIT_DATA',
              },
            },
          },
        ],
        [
          {
            name: 'map_extent_padding',
            config: {
              type: 'SliderControl',
              renderTrigger: true,
              label: t('Map Padding'),
              description: t(
                'Set the map extent padding. The selected value is applied to all edges of the map.',
              ),
              default: 60,
              min: 0,
              max: 100,
              step: 10,
              visibility: ({
                controls,
              }: {
                controls: ControlPanelsContainerProps['controls'] & {
                  map_view?: { value?: Partial<MapViewConfigs> };
                };
              }) => Boolean(controls?.map_view?.value?.mode === 'FIT_DATA'),
            },
          },
        ],
        [
          {
            name: 'min_zoom',
            config: {
              type: 'SliderControl',
              renderTrigger: true,
              label: t('Min Zoom'),
              description: t('The minimal zoom of the map'),
              default: MIN_ZOOM_LEVEL,
              min: MIN_ZOOM_LEVEL,
              max: MAX_ZOOM_LEVEL,
              step: 1,
            },
          },
        ],
        [
          {
            name: 'max_zoom',
            config: {
              type: 'SliderControl',
              renderTrigger: true,
              label: t('Max Zoom'),
              description: t('The maximal zoom of the map'),
              default: MAX_ZOOM_LEVEL,
              min: MIN_ZOOM_LEVEL,
              max: MAX_ZOOM_LEVEL,
              step: 1,
            },
          },
        ],
        [
          {
            name: 'map_max_extent',
            config: {
              type: MapMaxExtentViewControl,
              renderTrigger: true,
              description: t(
                "The constrained extent of the map on application start. NONE won't set any constrained extent. CUSTOM allows users to define the extent manually based on the current shown map extent.",
              ),
              label: t('Max. Extent'),
              dontRefreshOnChange: true,
              default: {
                extentMode: 'NONE',
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
              enableDataLayer: true,
              description: t('The configuration for the map layers'),
              formWatchers: [
                'adhoc_filters',
                'columns',
                'geom_column',
                'geom_format',
                'row_limit',
              ],
              featureCollectionTransformer: (
                data: any,
                formData: QueryFormData,
              ) => {
                if (formData.geom_format === GeometryFormat.WKB) {
                  return wkbDataToFeatureCollection(data, formData.geom_column);
                }
                return geojsonDataToFeatureCollection(
                  data,
                  formData.geom_column,
                );
              },
              shouldMapStateToProps: () => true,
              mapStateToProps: state => ({
                formData: state.form_data,
                colTypeMapping: (
                  state.datasource?.columns as QueryColumn[]
                ).reduce((prev: ColTypeMapping, cur: QueryColumn) => {
                  const reduced = { ...prev };
                  if (
                    Array.isArray(state.controls.columns?.value) &&
                    state.controls.columns?.value?.includes(cur.column_name) &&
                    cur.type
                  ) {
                    reduced[cur.column_name] = cur.type;
                  }
                  return reduced;
                }, {}),
              }),
            },
          },
        ],
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Show Legend'),
              renderTrigger: true,
              default: true,
              description: t('Whether to display the legend'),
            },
          },
        ],
        [
          {
            name: 'show_tooltip',
            config: {
              type: 'CheckboxControl',
              label: t('Show Tooltip'),
              renderTrigger: true,
              default: true,
              description: t('Whether to display the tooltip'),
            },
          },
        ],
        [
          {
            name: 'tooltip_template',
            config: {
              type: 'TextAreaControl',
              renderTrigger: true,
              label: t('Tooltip Template'),
              language: 'html',
              description: t(
                'Allows user to make custom queries to display user-specified data in the tooltip.',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.show_tooltip?.value),
              default: `{{#each this}}
  <div>
    <strong>{{@key}}:</strong>
    <span>{{this}}</span>
  </div>
{{/each}}`,
            },
          },
        ],
      ],
    },
    {
      label: t('Timeseries Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_timeslider',
            config: {
              type: 'CheckboxControl',
              description: t('Whether to show the timeslider'),
              label: t('Show timeslider'),
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'time_column',
            config: {
              type: 'SelectControl',
              label: t('Time Column'),
              description: t('The name of the time column'),
              renderTrigger: true,
              visibility: ({ controls }) =>
                Boolean(controls?.show_timeslider?.value),
              clearable: false,
              mapStateToProps: state => {
                const currentColumns: string[] = state.controls.columns
                  ?.value as string[];
                return {
                  choices: currentColumns
                    ?.filter((c: string) =>
                      state.datasource?.columns.some(
                        sourceCol =>
                          sourceCol.column_name === c && sourceCol.is_dttm,
                      ),
                    )
                    .map((c: string) => [c, c]),
                };
              },
            },
          },
        ],
        [
          {
            name: 'timeslider_tooltip_format',
            config: {
              type: 'SelectControl',
              label: t('Tooltip Format'),
              description: t('Format for the tooltip of the timeslider.'),
              renderTrigger: true,
              visibility: ({ controls }) =>
                Boolean(controls?.show_timeslider?.value),
              clearable: false,
              default: TimesliderTooltipFormat.DATETIME,
              choices: [
                [TimesliderTooltipFormat.DATETIME, t('Date & Time')],
                [TimesliderTooltipFormat.DATE, t('Date')],
                [TimesliderTooltipFormat.TIME, t('Time')],
              ],
            },
          },
        ],
      ],
    },
  ],
};
export default config;
