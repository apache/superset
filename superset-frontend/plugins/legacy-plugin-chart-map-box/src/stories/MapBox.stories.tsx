/*
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

/* eslint-disable no-magic-numbers */
import { SuperChart } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/ui';
import MapBoxChartPlugin from '@superset-ui/legacy-plugin-chart-map-box';
import { withResizableChartDemo } from '@storybook-shared';
import { generateData } from './data';

new MapBoxChartPlugin().configure({ key: 'map-box' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-map-box',
  decorators: [withResizableChartDemo],
  args: {
    clusteringRadius: 60,
    globalOpacity: 1,
    pointRadius: 'Auto',
    renderWhileDragging: true,
  },
  argTypes: {
    clusteringRadius: {
      control: { type: 'range', min: 0, max: 200, step: 10 },
      description: 'Radius in pixels for clustering points',
    },
    globalOpacity: {
      control: { type: 'range', min: 0, max: 1, step: 0.1 },
      description: 'Opacity of map markers',
    },
    pointRadius: {
      control: 'select',
      options: ['Auto', 1, 2, 5, 10, 20, 50],
      description: 'Size of point markers',
    },
    renderWhileDragging: {
      control: 'boolean',
      description: 'Render markers while dragging the map',
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Note: This chart requires a Mapbox API key to display. Without a valid key, the map background will not render.',
      },
    },
  },
};

export const MapBoxViz = ({
  clusteringRadius,
  globalOpacity,
  pointRadius,
  renderWhileDragging,
  width,
  height,
}: {
  clusteringRadius: number;
  globalOpacity: number;
  pointRadius: string | number;
  renderWhileDragging: boolean;
  width: number;
  height: number;
}) => {
  const theme = useTheme();
  return (
    <SuperChart
      theme={theme}
      chartType="map-box"
      width={width}
      height={height}
      queriesData={[{ data: generateData(theme) }]}
      formData={{
        all_columns_x: 'LON',
        all_columns_y: 'LAT',
        clustering_radius: String(clusteringRadius),
        global_opacity: globalOpacity,
        mapbox_color: 'rgb(244, 176, 42)',
        mapbox_label: [],
        mapbox_style: 'mapbox://styles/mapbox/light-v9',
        pandas_aggfunc: 'sum',
        point_radius: pointRadius,
        point_radius_unit: 'Pixels',
        render_while_dragging: renderWhileDragging,
        viewport_latitude: 37.78711146014447,
        viewport_longitude: -122.37633433151713,
        viewport_zoom: 10.026425338292782,
      }}
    />
  );
};
