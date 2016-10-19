import React from 'react';
import ReactDOM from 'react-dom';
import ExploreViewContainer from './components/ExploreViewContainer';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import { formatSelectOptions } from '../../utils/common';

import { initialState } from './stores/store';

const exploreViewContainer = document.getElementById('js-explore-view-container');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));

import { exploreReducer } from './reducers/exploreReducer';

const bootstrappedState = Object.assign(initialState, {
  datasources: bootstrapData.datasources,
  datasourceId: parseInt(bootstrapData.datasource_id, 10),
  datasourceType: bootstrapData.datasource_type,
  sliceName: bootstrapData.viz.form_data.slice_name,
  viz: {
    jsonEndPoint: bootstrapData.viz.json_endpoint,
    data: bootstrapData.viz.data,
    formData: {
      sliceId: bootstrapData.viz.form_data.slice_id,
      vizType: bootstrapData.viz.form_data.viz_type,
      timeColumn: bootstrapData.viz.form_data.granularity_sqla,
      timeGrain: bootstrapData.viz.form_data.time_grain_sqla,
      metrics: formatSelectOptions(bootstrapData.viz.form_data.metrics),
      since: bootstrapData.viz.form_data.since,
      until: bootstrapData.viz.form_data.until,
      having: bootstrapData.viz.form_data.having,
      where: bootstrapData.viz.form_data.where,
      rowLimit: parseInt(bootstrapData.viz.form_data.row_limit, 10),
      timeStampFormat: bootstrapData.viz.form_data.table_timestamp_format,
      lineInterpolation: bootstrapData.viz.form_data.line_interpolation,
      stackedStyle: bootstrapData.viz.form_data.stacked_style,
      xAxisLabel: bootstrapData.viz.form_data.x_axis_label,
      yAxisLabel: bootstrapData.viz.form_data.y_axis_label,
      xAxisFormat: bootstrapData.viz.form_data.x_axis_format,
      yAxisFormat: bootstrapData.viz.form_data.y_axis_format,
      showBrush: bootstrapData.viz.form_data.show_brush,
      showLegend: bootstrapData.viz.form_data.show_legend,
      richTooltip: bootstrapData.viz.form_data.rich_tooltip,
      yAxisZero: bootstrapData.viz.form_data.y_axis_zero,
      yLogScale: bootstrapData.viz.form_data.y_log_scale,
      contribution: bootstrapData.viz.form_data.contribution,
      showMarkers: bootstrapData.viz.form_data.show_markers,
      showControls: bootstrapData.viz.form_data.show_controls,
      xAxisShowminmax: bootstrapData.viz.form_data.x_axis_showminmax,
      rolling: bootstrapData.viz.form_data.rolling_type,
      periodRatioType: bootstrapData.viz.form_data.period_ratio_type,
      resampleHow: bootstrapData.viz.form_data.resample_how,
      resampleRule: bootstrapData.viz.form_data.resample_rule,
      resampleFill: bootstrapData.viz.form_data.resample_fillmethod,
      seriesLimit: parseInt(bootstrapData.viz.form_data.limit, 10),
      groupByColumns: formatSelectOptions(bootstrapData.viz.form_data.groupby),
    },
  },
});

const store = createStore(exploreReducer, bootstrappedState,
  compose(applyMiddleware(thunk))
);

ReactDOM.render(
  <Provider store={store}>
    <ExploreViewContainer />
  </Provider>,
  exploreViewContainer
);

