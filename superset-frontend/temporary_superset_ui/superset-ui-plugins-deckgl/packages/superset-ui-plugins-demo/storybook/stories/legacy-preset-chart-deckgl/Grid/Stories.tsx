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
        chartType="deck_grid"
        width={400}
        height={400}
        datasource={dummyDatasource}
        queriesData={[payload]}
        formData={{
          datasource: '5__table',
          viz_type: 'deck_grid',
          slice_id: 69,
          url_params: {},
          granularity_sqla: 'dttm',
          time_grain_sqla: null,
          time_range: '+:+',
          spatial: { latCol: 'LAT', lonCol: 'LON', type: 'latlong' },
          size: 'count',
          row_limit: 5000,
          filter_nulls: true,
          adhoc_filters: [],
          mapbox_style: 'mapbox://styles/mapbox/satellite-streets-v9',
          viewport: {
            bearing: 155.80099696026355,
            latitude: 37.7942314882596,
            longitude: -122.42066918995666,
            pitch: 53.470800300695146,
            zoom: 12.699690845482069,
          },
          color_picker: { a: 1, b: 0, g: 255, r: 14 },
          autozoom: true,
          grid_size: 120,
          extruded: true,
          js_columns: [],
          js_data_mutator: '',
          js_tooltip: '',
          js_onclick_href: '',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-preset-chart-deckgl|GridChartPlugin',
  },
];
