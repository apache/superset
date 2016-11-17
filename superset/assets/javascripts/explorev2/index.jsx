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

const bootstrappedState = Object.assign(initialState(bootstrapData.viz.form_data.viz_type), {
  can_download: bootstrapData.can_download,
  datasources: bootstrapData.datasources,
  datasource_type: bootstrapData.datasource_type,
  viz: bootstrapData.viz,
});
bootstrappedState.viz.form_data.datasource = parseInt(bootstrapData.datasource_id, 10);
bootstrappedState.viz.form_data.datasource_name = bootstrapData.datasource_name;

const store = createStore(exploreReducer, bootstrappedState,
  compose(applyMiddleware(thunk))
);

ReactDOM.render(
  <Provider store={store}>
    <ExploreViewContainer />
  </Provider>,
  exploreViewContainer
);

