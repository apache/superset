/* eslint-disable sort-keys */
/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import payload from './payload';
import dummyDatasource from '../../../shared/dummyDatasource';

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="deck_hex"
        width={400}
        height={400}
        datasource={dummyDatasource}
        queriesData={[payload]}
        formData={{
          datasource: '5__table',
          viz_type: 'deck_hex',
          slice_id: 68,
          url_params: {},
          granularity_sqla: 'dttm',
          time_grain_sqla: null,
          time_range: '+:+',
          spatial: { latCol: 'LAT', lonCol: 'LON', type: 'latlong' },
          size: 'count',
          row_limit: 5000,
          filter_nulls: true,
          adhoc_filters: [],
          mapbox_style: 'mapbox://styles/mapbox/streets-v9',
          viewport: {
            bearing: -2.3984797349335167,
            latitude: 37.789795085160335,
            longitude: -122.40632230075536,
            pitch: 54.08961642447763,
            zoom: 13.835465702403654,
          },
          color_picker: { a: 1, b: 0, g: 255, r: 14 },
          autozoom: true,
          grid_size: 40,
          extruded: true,
          js_agg_function: 'sum',
          js_columns: [],
          js_data_mutator: '',
          js_tooltip: '',
          js_onclick_href: '',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-preset-chart-deckgl|HexChartPlugin',
  },
];
