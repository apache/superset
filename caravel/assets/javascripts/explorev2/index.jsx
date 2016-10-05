import React from 'react';
import ReactDOM from 'react-dom';
import ExploreViewContainer from './components/ExploreViewContainer';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

import { initialState } from './stores/store';

const exploreViewContainer = document.getElementById('js-explore-view-container');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));

import { exploreReducer } from './reducers/exploreReducer';

const bootstrappedState = Object.assign(initialState, {
  datasources: bootstrapData.datasources,
  datasourceId: parseInt(bootstrapData.datasource_id, 10),
  datasourceType: bootstrapData.datasource_type,
  sliceName: bootstrapData.viz.form_data.slice_name,
  sliceId: bootstrapData.viz.form_data.slice_id,
  vizType: bootstrapData.viz.form_data.viz_type,
  timeColumn: bootstrapData.viz.form_data.granularity_sqla,
  timeGrain: bootstrapData.viz.form_data.time_grain_sqla,
  metrics: bootstrapData.viz.form_data.metrics.map((m) => ({ value: m, label: m })),
  since: bootstrapData.viz.form_data.since,
  until: bootstrapData.viz.form_data.until,
  havingClause: bootstrapData.viz.form_data.having,
  whereClause: bootstrapData.viz.form_data.where,
  lineStyle: bootstrapData.viz.form_data.line_interpolation,
  xLabel: bootstrapData.viz.form_data.x_axis_label,
  yLabel: bootstrapData.viz.form_data.y_axis_label,
  xFormat: bootstrapData.viz.form_data.x_axis_format,
  yFormat: bootstrapData.viz.form_data.y_axis_format,
  showBrush: bootstrapData.viz.form_data.show_brush,
  showLegend: bootstrapData.viz.form_data.show_legend,
  richTooltip: bootstrapData.viz.form_data.rich_tooltip,
  yAxisZero: bootstrapData.viz.form_data.y_axis_zero,
  yLogScale: bootstrapData.viz.form_data.y_log_scale,
  contribution: bootstrapData.viz.form_data.contribution,
  showMarkers: bootstrapData.viz.form_data.show_makers,
  xAxisShowminmax: bootstrapData.viz.form_data.x_axis_showminmax,
  rolling: bootstrapData.viz.form_data.rolling_type,
  periodRatioType: bootstrapData.viz.form_data.period_ratio_type,
  resampleHow: bootstrapData.viz.form_data.resample_how,
  resampleRule: bootstrapData.viz.form_data.resample_rule,
  resampleFill: bootstrapData.viz.form_data.resample_fillmethod,
});
const store = createStore(exploreReducer, bootstrappedState,
  compose(applyMiddleware(thunk))
);

ReactDOM.render(
  <Provider store={store}>
    <ExploreViewContainer
      data={bootstrapData}
    />
  </Provider>,
  exploreViewContainer
);

