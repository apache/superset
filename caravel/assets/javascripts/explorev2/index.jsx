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
  metrics: [bootstrapData.viz.form_data.metrics].map((m) => ({ value: m, label: m })),
  since: bootstrapData.viz.form_data.since,
  until: bootstrapData.viz.form_data.until,
  havingClause: bootstrapData.viz.form_data.having,
  whereClause: bootstrapData.viz.form_data.where,
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

