const $ = window.$ = require('jquery');
const jQuery = window.jQuery = $; // eslint-disable-line
require('bootstrap');

import React from 'react';
import { render } from 'react-dom';
import * as Actions from './actions';

import TabbedSqlEditors from './components/TabbedSqlEditors';
import QueryAutoRefresh from './components/QueryAutoRefresh';
import Alerts from './components/Alerts';

import { bindActionCreators, compose, createStore } from 'redux';
import { connect, Provider } from 'react-redux';

import { initialState, sqlLabReducer } from './reducers';
import persistState from 'redux-localstorage';

require('./main.css');

let enhancer = compose(persistState());
if (process.env.NODE_ENV === 'dev') {
  enhancer = compose(
    persistState(), window.devToolsExtension && window.devToolsExtension()
  );
}
let store = createStore(sqlLabReducer, initialState, enhancer);

// jquery hack to highlight the navbar menu
$('a[href="/caravel/sqllab"]').parent().addClass('active');

const App = function (props) {
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
