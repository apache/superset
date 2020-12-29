import React from 'react';
import { SuperChart } from '@superset-ui/core';
import data from '../data/legacyData';
import { LINE_PLUGIN_LEGACY_TYPE } from '../constants';
import dummyDatasource from '../../../../../shared/dummyDatasource';

export default () => (
  <>
    <SuperChart
      key="line1"
      chartType={LINE_PLUGIN_LEGACY_TYPE}
      width={400}
      height={400}
      datasource={dummyDatasource}
      queriesData={[{ data }]}
      formData={{
        bottomMargin: 'auto',
        colorScheme: 'd3Category10',
        leftMargin: 'auto',
        lineInterpolation: 'linear',
        richTooltip: true,
        showBrush: 'auto',
        showLegend: true,
        showMarkers: false,
        vizType: 'line',
        xAxisFormat: '%Y',
        xAxisLabel: '',
        xAxisShowminmax: false,
        xTicksLayout: 'auto',
        yAxisBounds: [null, null],
        yAxisFormat: '',
        yAxisLabel: '',
        yAxisShowminmax: false,
        yLogScale: false,
      }}
    />
    ,
    <SuperChart
      key="line2"
      chartType={LINE_PLUGIN_LEGACY_TYPE}
      width={400}
      height={400}
      datasource={dummyDatasource}
      queriesData={[{ data }]}
      formData={{
        bottomMargin: 'auto',
        colorScheme: 'd3Category10',
        leftMargin: 'auto',
        lineInterpolation: 'linear',
        richTooltip: true,
        showBrush: 'auto',
        showLegend: true,
        showMarkers: false,
        vizType: 'line',
        xAxisFormat: '%Y-%m',
        xAxisLabel: '',
        xAxisShowminmax: false,
        xTicksLayout: 'auto',
        yAxisBounds: [null, null],
        yAxisFormat: '',
        yAxisLabel: '',
        yAxisShowminmax: false,
        yLogScale: false,
      }}
    />
  </>
);
