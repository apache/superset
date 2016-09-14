import React from 'react';
import ReactDOM from 'react-dom';
import ExploreViewContainer from './components/ExploreViewContainer';

import { compose, createStore } from 'redux';
import { Provider } from 'react-redux';

const exploreViewContainer = document.getElementById('js-explore-view-container');
const bootstrapData = exploreViewContainer.getAttribute('data-bootstrap');


import { initialState, exploreReducer } from './reducers';
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
