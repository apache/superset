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
        chartType="deck_screengrid"
        width={400}
        height={400}
        datasource={dummyDatasource}
        queriesData={[payload]}
        formData={{
          datasource: '5__table',
          viz_type: 'deck_screengrid',
          slice_id: 67,
          url_params: {},
          granularity_sqla: 'dttm',
          time_grain_sqla: null,
          time_range: '+:+',
          spatial: { latCol: 'LAT', lonCol: 'LON', type: 'latlong' },
          size: 'count',
          row_limit: 5000,
          filter_nulls: true,
          adhoc_filters: [],
          mapbox_style: 'mapbox://styles/mapbox/dark-v9',
          viewport: {
            bearing: -4.952916738791771,
            latitude: 37.76024135844065,
            longitude: -122.41827069521386,
            pitch: 4.750411100577438,
            zoom: 14.161641703941438,
          },
          autozoom: true,
          grid_size: 20,
          color_picker: { a: 1, b: 0, g: 255, r: 14 },
          js_columns: [],
          js_data_mutator: '',
          js_tooltip: '',
          js_onclick_href: '',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-preset-chart-deckgl|ScreengridChartPlugin',
  },
];
