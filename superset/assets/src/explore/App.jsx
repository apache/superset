import React from 'react';
import { hot } from 'react-hot-loader';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

import { initEnhancer } from '../reduxUtils';
import ToastPresenter from '../messageToasts/containers/ToastPresenter';
import ExploreViewContainer from './components/ExploreViewContainer';
import getInitialState from './reducers/getInitialState';
import rootReducer from './reducers/index';

import { appSetup } from '../common';
import './main.css';
import '../../stylesheets/reactable-pagination.css';

appSetup();

const exploreViewContainer = document.getElementById('app');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));
const initState = getInitialState(bootstrapData);

const store = createStore(
  rootReducer,
  initState,
  compose(
    applyMiddleware(thunk),
    initEnhancer(false),
  ),
);

const App = () => (
  <Provider store={store}>
    <div>
      <ExploreViewContainer />
      <ToastPresenter />
    </div>
  </Provider>
);

export default hot(module)(App);
