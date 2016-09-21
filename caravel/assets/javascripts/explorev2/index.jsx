import React from 'react';
import ReactDOM from 'react-dom';
import ExploreViewContainer from './components/ExploreViewContainer';

import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { enhancer } from '../../utils/common';

import { initialState } from './stores/store';

const exploreViewContainer = document.getElementById('js-explore-view-container');
const bootstrapData = exploreViewContainer.getAttribute('data-bootstrap');

import { exploreReducer } from './reducers/exploreReducer';

const bootstrappedState = Object.assign(initialState, {
  datasources: bootstrapData.datasources,
  viz: bootstrapData.viz,
});
const store = createStore(exploreReducer, bootstrappedState, enhancer);

ReactDOM.render(
  <Provider store={store}>
    <ExploreViewContainer
      data={bootstrapData}
    />
  </Provider>,
  exploreViewContainer
);
