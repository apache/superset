const $ = window.$ = require('jquery');
const jQuery = window.jQuery = $; // eslint-disable-line
require('bootstrap');

import React from 'react';
import { render } from 'react-dom';
import { initialState, sqlLabReducer } from './reducers';
import { enhancer } from '../reduxUtils';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import App from './components/App';


require('./main.css');

let store = createStore(sqlLabReducer, initialState, enhancer());

// jquery hack to highlight the navbar menu
$('a:contains("SQL Lab")').parent().addClass('active');

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('app')
);
