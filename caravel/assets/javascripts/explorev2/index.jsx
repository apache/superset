import React from 'react';
import ReactDOM from 'react-dom';
import ExploreViewContainer from './components/ExploreViewContainer';

import { compose, createStore } from 'redux';
import { Provider } from 'react-redux';

import { initialState } from './stores/store';

const exploreViewContainer = document.getElementById('js-explore-view-container');
const bootstrapData = exploreViewContainer.getAttribute('data-bootstrap');


import { exploreReducer } from './reducers/exploreReducer';
import persistState from 'redux-localstorage';

let enhancer = compose(persistState());
if (process.env.NODE_ENV === 'dev') {
  enhancer = compose(
    persistState(), window.devToolsExtension && window.devToolsExtension()
  );
}
let store = createStore(exploreReducer, initialState, enhancer);

ReactDOM.render(
  <Provider store={store}>
    <ExploreViewContainer
      data={bootstrapData}
    />
  </Provider>,
  exploreViewContainer
);
