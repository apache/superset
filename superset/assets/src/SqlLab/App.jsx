import React from 'react';
import { createStore, compose, applyMiddleware } from 'redux';
import { Provider } from 'react-redux';
import thunkMiddleware from 'redux-thunk';
import { hot } from 'react-hot-loader';
import $ from 'jquery';

import getInitialState from './getInitialState';
import rootReducer from './reducers';
import { initEnhancer } from '../reduxUtils';
import { initJQueryAjax } from '../modules/utils';
import App from './components/App';
import { appSetup } from '../common';

import './main.less';
import '../../stylesheets/reactable-pagination.css';
import '../components/FilterableTable/FilterableTableStyles.css';

appSetup();
initJQueryAjax();

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
const state = getInitialState(bootstrapData);

const store = createStore(
  rootReducer,
  state,
  compose(
    applyMiddleware(thunkMiddleware),
    initEnhancer(),
  ),
);

// jquery hack to highlight the navbar menu
$('a:contains("SQL Lab")')
  .parent()
  .addClass('active');

const Application = () => (
  <Provider store={store}>
    <App />
  </Provider>
);

export default hot(module)(Application);
