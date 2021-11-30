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
        chartType="deck_path"
        width={400}
        height={400}
        datasource={dummyDatasource}
        queriesData={[payload]}
        formData={{
          datasource: '11__table',
          viz_type: 'deck_path',
          slice_id: 72,
          url_params: {},
          granularity_sqla: null,
          time_grain_sqla: null,
          time_range: '+:+',
          line_column: 'path_json',
          line_type: 'json',
          row_limit: 5000,
          filter_nulls: true,
          adhoc_filters: [],
          mapbox_style: 'mapbox://styles/mapbox/light-v9',
          viewport: {
            altitude: 1.5,
            bearing: 0,
            height: 1094,
            latitude: 37.73671752604488,
            longitude: -122.18885402582598,
            maxLatitude: 85.05113,
            maxPitch: 60,
            maxZoom: 20,
            minLatitude: -85.05113,
            minPitch: 0,
            minZoom: 0,
            pitch: 0,
            width: 669,
            zoom: 9.51847667620428,
          },
          color_picker: { a: 1, b: 135, g: 122, r: 0 },
          line_width: 150,
          reverse_long_lat: false,
          autozoom: true,
          js_columns: ['color'],
          js_data_mutator: '',
          js_tooltip: '',
          js_onclick_href: '',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-preset-chart-deckgl|PathChartPlugin',
  },
];
