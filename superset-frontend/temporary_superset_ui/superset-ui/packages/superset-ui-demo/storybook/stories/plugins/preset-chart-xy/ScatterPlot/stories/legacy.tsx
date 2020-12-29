import * as React from 'react';
import { SuperChart } from '@superset-ui/core';
import data from '../data/legacyData';
import { SCATTER_PLOT_PLUGIN_LEGACY_TYPE } from '../constants';
import dummyDatasource from '../../../../../shared/dummyDatasource';

export default () => (
  <SuperChart
    key="scatter-plot1"
    chartType={SCATTER_PLOT_PLUGIN_LEGACY_TYPE}
    width={400}
    height={400}
    datasource={dummyDatasource}
    queriesData={[{ data }]}
    formData={{
      annotationData: {},
      bottomMargin: 'auto',
      colorScheme: 'd3Category10',
      entity: 'country_name',
      leftMargin: 'auto',
      maxBubbleSize: '50',
      series: 'region',
      showLegend: true,
      size: 'sum__SP_POP_TOTL',
      vizType: 'bubble',
      x: 'sum__SP_RUR_TOTL_ZS',
      xAxisFormat: '.3s',
      xAxisLabel: 'x-axis label test',
      xAxisShowminmax: false,
      xLogScale: false,
      xTicksLayout: 'auto',
      y: 'sum__SP_DYN_LE00_IN',
      yAxisFormat: '.3s',
      yAxisLabel: '',
      yAxisShowminmax: false,
      yLogScale: false,
    }}
  />
);
