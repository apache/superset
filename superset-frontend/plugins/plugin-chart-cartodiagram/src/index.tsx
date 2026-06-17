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
import { createRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import OlMap from 'ol/Map';
import {
  validateNonEmpty,
  ChartPlugin,
  QueryFormData,
  getChartBuildQueryRegistry,
  getChartTransformPropsRegistry,
} from '@superset-ui/core';
import { defineChart } from '@superset-ui/glyph-core';
import {
  CartodiagramPluginConstructorOpts,
  CartodiagramPluginProps,
  CartodiagramPluginStylesProps,
  LayerConf,
} from './types';
import OlChartMap from './components/OlChartMap';
import { parseSelectedChart, getChartConfigs } from './util/transformPropsUtil';
import { selectedChartMutator } from './util/controlPanelUtil';
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from './util/zoomUtil';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example1 from './images/example1.png';
import example1Dark from './images/example1-dark.png';
import example2 from './images/example2.png';
import example2Dark from './images/example2-dark.png';

import 'ol/ol.css';

// ── CartodiagramPlugin component ──────────────────────────────────────────────

const Styles = styled.div<CartodiagramPluginStylesProps>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

function CartodiagramPlugin(props: CartodiagramPluginProps) {
  const { height, width } = props;
  const theme = useTheme();

  const rootElem = createRef<HTMLDivElement>();

  const [mapId] = useState(
    `cartodiagram-plugin-${Math.floor(Math.random() * 1000000)}`,
  );
  const [olMap] = useState(new OlMap({}));

  return (
    <Styles ref={rootElem} height={height} width={width} theme={theme}>
      <OlChartMap mapId={mapId} olMap={olMap} {...props} />
    </Styles>
  );
}

// ── buildQuery ────────────────────────────────────────────────────────────────

export function buildQuery(formData: QueryFormData) {
  const {
    selected_chart: selectedChartString,
    geom_column: geometryColumn,
    extra_form_data: extraFormData,
  } = formData;
  const selectedChart = JSON.parse(selectedChartString);
  const vizType = selectedChart.viz_type;
  const chartFormData = JSON.parse(selectedChart.params);
  // Pass extra_form_data to chartFormData so that
  // dashboard filters will also be applied to the charts
  // on the map.
  chartFormData.extra_form_data = {
    ...chartFormData.extra_form_data,
    ...extraFormData,
  };

  // adapt groupby property to ensure geometry column always exists
  // and is always at first position
  let { groupby } = chartFormData;
  if (!groupby) {
    groupby = [];
  }
  // add geometry column at the first place
  groupby?.unshift(geometryColumn);
  chartFormData.groupby = groupby;

  // TODO: find way to import correct type "InclusiveLoaderResult"
  const buildQueryRegistry = getChartBuildQueryRegistry();
  const chartQueryBuilder = buildQueryRegistry.get(vizType) as any;

  const chartQuery = chartQueryBuilder(chartFormData);
  return chartQuery;
}

// ── Plugin definition ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CartodiagramExtra = Record<string, any>;

// Standalone transformProps exported for testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformProps(chartProps: any) {
  const { formData, hooks, width, height, queriesData } = chartProps;
  const {
    geomColumn,
    selectedChart: selectedChartString,
    chartSize,
    layerConfigs,
    mapView,
    chartBackgroundColor,
    chartBackgroundBorderRadius,
  } = formData as Record<string, unknown>;
  const { setControlValue = () => {} } = (hooks ?? {}) as {
    setControlValue?: (key: string, value: unknown) => void;
  };
  const selectedChart = parseSelectedChart(selectedChartString as string);
  const transformPropsRegistry = getChartTransformPropsRegistry();
  const chartTransformer = transformPropsRegistry.get(selectedChart.viz_type);
  const chartConfigs = getChartConfigs(
    selectedChart,
    geomColumn as string,
    chartProps,
    chartTransformer,
  );

  return {
    width,
    height,
    queriesData,
    geomColumn,
    selectedChart,
    chartConfigs,
    chartVizType: selectedChart.viz_type,
    chartSize,
    layerConfigs,
    mapView,
    chartBackgroundColor,
    chartBackgroundBorderRadius,
    setControlValue,
  };
}

export function createCartodiagramPlugin(
  opts: CartodiagramPluginConstructorOpts = {},
): new () => ChartPlugin {
  const layerConfigsDefault: LayerConf[] = opts.defaultLayers ?? [];

  return defineChart<Record<string, never>, CartodiagramExtra>({
    metadata: {
      name: t('Cartodiagram'),
      description:
        'Display charts on a map. For using this plugin, users first have to create any other chart that can then be placed on the map.',
      category: t('Map'),
      tags: [t('Geo'), t('2D'), t('Spatial'), t('Experimental')],
      thumbnail,
      thumbnailDark,
      exampleGallery: [
        {
          url: example1,
          urlDark: example1Dark,
          caption: t('Pie charts on a map'),
        },
        {
          url: example2,
          urlDark: example2Dark,
          caption: t('Line charts on a map'),
        },
      ],
    },
    arguments: {},
    buildQuery,
    suppressQuerySection: true,
    prependSections: [
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mapStateToProps: (state: any) => {
                  if (state?.datasource?.id) {
                    const { id: datasourceId } = state.datasource;
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
                      page_size: 999,
                    };
                    return {
                      dataEndpoint: `/api/v1/chart/?q=${JSON.stringify(query)}`,
                    };
                  }
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mapStateToProps: (state: any) => ({
                  choices: state.datasource?.columns?.map(
                    (c: { column_name: string }) => [
                      c.column_name,
                      c.column_name,
                    ],
                  ),
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
              name: 'layer_configs',
              config: {
                type: 'LayerConfigsControl',
                renderTrigger: true,
                label: t('Layers'),
                default: layerConfigsDefault,
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
    transform: chartProps => {
      const { formData, hooks } = chartProps;
      const {
        geomColumn,
        selectedChart: selectedChartString,
        chartSize,
        layerConfigs,
        mapView,
        chartBackgroundColor,
        chartBackgroundBorderRadius,
      } = formData as Record<string, unknown>;
      const { setControlValue = () => {} } = (hooks ?? {}) as {
        setControlValue?: (key: string, value: unknown) => void;
      };
      const selectedChart = parseSelectedChart(selectedChartString as string);
      const transformPropsRegistry = getChartTransformPropsRegistry();
      const chartTransformer = transformPropsRegistry.get(
        selectedChart.viz_type,
      );
      const chartConfigs = getChartConfigs(
        selectedChart,
        geomColumn as string,
        chartProps,
        chartTransformer,
      );

      return {
        geomColumn,
        selectedChart,
        chartConfigs,
        chartVizType: selectedChart.viz_type,
        chartSize,
        layerConfigs,
        mapView,
        chartBackgroundColor,
        chartBackgroundBorderRadius,
        setControlValue,
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: (props: any) => <CartodiagramPlugin {...props} />,
  });
}
