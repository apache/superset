var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
require('bootstrap');

import React from 'react';
import { render } from 'react-dom';

import { Label, Tab, Tabs } from 'react-bootstrap';

import LeftPane from './components/LeftPane';
import TabbedSqlEditors from './components/TabbedSqlEditors';

import { compose, createStore } from 'redux';
import { Provider } from 'react-redux';

import { initialState, sqlLabReducer } from './reducers';
import persistState from 'redux-localstorage';

require('./main.css');

let store = createStore(sqlLabReducer, initialState, compose(persistState(), window.devToolsExtension && window.devToolsExtension()));

// jquery hack to highlight the navbar menu
$('a[href="/caravel/sqllab"]').parent().addClass('active');

const App = React.createClass({
  render() {
    return (
      <div className="App SqlLab">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-3">
              <LeftPane />
            </div>
            <div className="col-md-9">
              <TabbedSqlEditors />
            </div>
          </div>
        </div>
      </div>
    );
  },
});

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('app')
);
