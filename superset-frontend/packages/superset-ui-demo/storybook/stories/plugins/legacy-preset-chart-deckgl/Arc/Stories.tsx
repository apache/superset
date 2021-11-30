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
        chartType="deck_arc"
        width={400}
        height={400}
        datasource={dummyDatasource}
        queriesData={[payload]}
        formData={{
          datasource: '10__table',
          viz_type: 'deck_arc',
          granularity_sqla: 'dttm',
          time_grain_sqla: null,
          time_range: ' : ',
          start_spatial: {
            latCol: 'LATITUDE',
            lonCol: 'LONGITUDE',
            type: 'latlong',
          },
          end_spatial: {
            latCol: 'LATITUDE_DEST',
            lonCol: 'LONGITUDE_DEST',
            type: 'latlong',
          },
          row_limit: 5000,
          filter_nulls: true,
          adhoc_filters: [],
          mapbox_style: 'mapbox://styles/mapbox/light-v9',
          viewport: {
            altitude: 1.5,
            bearing: 8.546256357301871,
            height: 642,
            latitude: 44.596651438714254,
            longitude: -91.84340711201104,
            maxLatitude: 85.05113,
            maxPitch: 60,
            maxZoom: 20,
            minLatitude: -85.05113,
            minPitch: 0,
            minZoom: 0,
            pitch: 60,
            width: 997,
            zoom: 2.929837070560775,
          },
          autozoom: true,
          color_picker: {
            a: 1,
            b: 135,
            g: 122,
            r: 0,
          },
          target_color_picker: {
            r: 0,
            g: 122,
            b: 135,
            a: 1,
          },
          dimension: null,
          label_colors: {},
          stroke_width: 1,
          legend_position: 'tr',
          legend_format: null,
          js_columns: [],
          js_data_mutator: '',
          js_tooltip: '',
          js_onclick_href: '',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-preset-chart-deckgl|ArcChartPlugin',
  },
];
