/* eslint-disable no-magic-numbers, sort-keys */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import WorldMapChartPlugin from '@superset-ui/legacy-plugin-chart-world-map';
import data from './data';

new WorldMapChartPlugin().configure({ key: 'world-map' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-world-map',
};

export const basic = () => (
  <SuperChart
    chartType="world-map"
    width={400}
    height={400}
    queriesData={[{ data }]}
    formData={{
      maxBubbleSize: '25',
      showBubbles: true,
    }}
  />
);
