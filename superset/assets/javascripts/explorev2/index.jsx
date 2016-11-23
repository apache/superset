import React from 'react';
import ReactDOM from 'react-dom';
import ExploreViewContainer from './components/ExploreViewContainer';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

// jquery and bootstrap required to make bootstrap dropdown menu's work
const $ = window.$ = require('jquery'); // eslint-disable-line
const jQuery = window.jQuery = require('jquery'); // eslint-disable-line
require('bootstrap');

import { initialState } from './stores/store';

const exploreViewContainer = document.getElementById('js-explore-view-container');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));

import { exploreReducer } from './reducers/exploreReducer';

const bootstrappedState = Object.assign(initialState(bootstrapData.viz.form_data.viz_type), {
  can_edit: bootstrapData.can_edit,
  can_download: bootstrapData.can_download,
  datasources: bootstrapData.datasources,
  datasource_type: bootstrapData.datasource_type,
  viz: bootstrapData.viz,
  user_id: bootstrapData.user_id,
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

