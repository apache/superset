import React from 'react';
import ReactDOM from 'react-dom';
import ExploreViewContainer from './components/ExploreViewContainer';

import { createStore } from 'redux';
import { Provider } from 'react-redux';
import { enhancer } from '../../utils/common';

import { initialState } from './stores/store';

const exploreViewContainer = document.getElementById('js-explore-view-container');

import { exploreReducer } from './reducers/exploreReducer';

const store = createStore(exploreReducer, initialState, enhancer);

ReactDOM.render(
  <Provider store={store}>
    <ExploreViewContainer />
  </Provider>,
  exploreViewContainer
);
