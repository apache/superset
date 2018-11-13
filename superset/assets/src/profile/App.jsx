import React from 'react';
import { hot } from 'react-hot-loader';
import thunk from 'redux-thunk';
import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import { Provider } from 'react-redux';

import App from './components/App';
import messageToastReducer from '../messageToasts/reducers';
import { initEnhancer } from '../reduxUtils';
import { appSetup } from '../common';

import './main.css';

appSetup();

const profileViewContainer = document.getElementById('app');
const bootstrap = JSON.parse(profileViewContainer.getAttribute('data-bootstrap'));

const store = createStore(
  combineReducers({
    messageToasts: messageToastReducer,
  }),
  {},
  compose(
    applyMiddleware(thunk),
    initEnhancer(false),
  ),
);

const Application = () => (
  <Provider store={store}>
    <App user={bootstrap.user} />
  </Provider>
);

export default hot(module)(Application);
