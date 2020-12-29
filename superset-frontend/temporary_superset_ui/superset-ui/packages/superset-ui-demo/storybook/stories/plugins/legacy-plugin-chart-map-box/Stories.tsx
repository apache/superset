/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import MapBoxChartPlugin from '@superset-ui/legacy-plugin-chart-map-box';
import data from './data';

new MapBoxChartPlugin().configure({ key: 'map-box' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-map-box',
};

export const basic = () => (
  <SuperChart
    chartType="map-box"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      allColumnsX: 'LON',
      allColumnsY: 'LAT',
      clusteringRadius: '60',
      globalOpacity: 1,
      mapboxColor: 'rgb(0, 122, 135)',
      mapboxLabel: [],
      mapboxStyle: 'mapbox://styles/mapbox/light-v9',
      pandasAggfunc: 'sum',
      pointRadius: 'Auto',
      pointRadiusUnit: 'Pixels',
      renderWhileDragging: true,
      viewportLatitude: 37.78711146014447,
      viewportLongitude: -122.37633433151713,
      viewportZoom: 10.026425338292782,
    }}
  />
);
