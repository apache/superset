const $ = window.$ = require('jquery');
const jQuery = window.jQuery = $; // eslint-disable-line
require('bootstrap');

import React from 'react';
import { render } from 'react-dom';
import * as Actions from './actions';

import TabbedSqlEditors from './components/TabbedSqlEditors';
import QueryAutoRefresh from './components/QueryAutoRefresh';
import QuerySearch from './components/QuerySearch';
import Alerts from './components/Alerts';

import { bindActionCreators, createStore } from 'redux';
import { connect, Provider } from 'react-redux';

import { initialState, sqlLabReducer } from './reducers';
import { enhancer } from '../reduxUtils';

require('./main.css');

let store = createStore(sqlLabReducer, initialState, enhancer());

// jquery hack to highlight the navbar menu
$('a:contains("SQL Lab")').parent().addClass('active');

const App = function (props) {
  if (window.location.search) {
    return (
      <div className="container-fluid">
        <div className="row">
          <div className="col-md-12">
            <QuerySearch />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="App SqlLab">
      <div className="container-fluid">
        <QueryAutoRefresh />
        <Alerts alerts={props.alerts} />
        <div className="row">
          <div className="col-md-12">
            <TabbedSqlEditors />
          </div>
        </div>
      </div>
    </div>
  );
};

App.propTypes = {
  alerts: React.PropTypes.array,
};

function mapStateToProps(state) {
  return {
    alerts: state.alerts,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

const ReduxedApp = connect(mapStateToProps, mapDispatchToProps)(App);

render(
  <Provider store={store}>
    <ReduxedApp />
  </Provider>,
  document.getElementById('app')
);
