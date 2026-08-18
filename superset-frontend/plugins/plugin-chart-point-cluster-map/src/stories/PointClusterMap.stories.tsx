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

/* eslint-disable sort-keys, no-magic-numbers */
import { SuperChart } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/theme';
import ScatterMapChartPlugin from '@superset-ui/plugin-chart-point-cluster-map';
import { withResizableChartDemo } from '@storybook-shared';
import { generateData } from './data';

new ScatterMapChartPlugin().configure({ key: 'point_cluster_map' }).register();

export default {
  title: 'Chart Plugins/plugin-chart-point-cluster-map',
  decorators: [withResizableChartDemo],
  args: {
    clusteringRadius: 60,
    globalOpacity: 1,
    pointRadius: 'Auto',
    renderWhileDragging: true,
    mapRenderer: 'maplibre',
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
    mapRenderer: {
      control: 'select',
      options: ['maplibre', 'mapbox'],
      description:
        'Map renderer. MapLibre is open-source. Mapbox requires MAPBOX_API_KEY.',
    },
  },
};

export const InteractiveSuperclusterMap = ({
  clusteringRadius,
  globalOpacity,
  pointRadius,
  renderWhileDragging,
  mapRenderer,
  width,
  height,
}: {
  clusteringRadius: number;
  globalOpacity: number;
  pointRadius: string | number;
  renderWhileDragging: boolean;
  mapRenderer: string;
  width: number;
  height: number;
}) => {
  const theme = useTheme();
  return (
    <SuperChart
      chartType="point_cluster_map"
      width={width}
      height={height}
      queriesData={[{ data: generateData(theme) }]}
      formData={{
        clustering_radius: String(clusteringRadius),
        global_opacity: globalOpacity,
        map_color: '#008b8b',
        map_label: [],
        map_renderer: mapRenderer,
        maplibre_style: 'https://tiles.openfreemap.org/styles/liberty',
        mapbox_style: 'mapbox://styles/mapbox/light-v11',
        pandas_aggfunc: 'sum',
        point_radius: pointRadius,
        point_radius_unit: 'Pixels',
        render_while_dragging: renderWhileDragging,
        viewport_latitude: 37.78,
        viewport_longitude: -122.42,
        viewport_zoom: 12,
      }}
    />
  );
};

export const WithMetricLabels = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => {
  const theme = useTheme();
  return (
    <SuperChart
      chartType="point_cluster_map"
      width={width}
      height={height}
      queriesData={[{ data: generateData(theme) }]}
      formData={{
        clustering_radius: '60',
        global_opacity: 1,
        map_color: '#dc143c',
        map_label: ['metric'],
        map_renderer: 'maplibre',
        maplibre_style:
          'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        pandas_aggfunc: 'sum',
        point_radius: 'Auto',
        point_radius_unit: 'Pixels',
        render_while_dragging: true,
        viewport_latitude: 37.78,
        viewport_longitude: -122.42,
        viewport_zoom: 12,
      }}
    />
  );
};

export const NoClustering = ({
  width,
  height,
}: {
  width: number;
  height: number;
}) => {
  const theme = useTheme();
  return (
    <SuperChart
      chartType="point_cluster_map"
      width={width}
      height={height}
      queriesData={[{ data: generateData(theme) }]}
      formData={{
        clustering_radius: '0',
        global_opacity: 0.8,
        map_color: '#228b22',
        map_label: [],
        map_renderer: 'maplibre',
        maplibre_style:
          'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        pandas_aggfunc: 'sum',
        point_radius: 'Auto',
        point_radius_unit: 'Pixels',
        render_while_dragging: true,
        viewport_latitude: 37.78,
        viewport_longitude: -122.42,
        viewport_zoom: 12,
      }}
    />
  );
};
