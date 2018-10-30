import React from 'react';
import { hot } from 'react-hot-loader';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

import { initFeatureFlags } from 'src/featureFlags';
import { initEnhancer } from '../reduxUtils';
import ToastPresenter from '../messageToasts/containers/ToastPresenter';
import ExploreViewContainer from './components/ExploreViewContainer';
import getInitialState from './reducers/getInitialState';
import rootReducer from './reducers/index';

import setupApp from '../setup/setupApp';
import setupPlugins from '../setup/setupPlugins';
import './main.css';
import '../../stylesheets/reactable-pagination.css';

setupApp();
setupPlugins();

const exploreViewContainer = document.getElementById('app');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));
initFeatureFlags(bootstrapData.common.feature_flags);
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
