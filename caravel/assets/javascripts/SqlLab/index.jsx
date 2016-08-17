var $ = window.$ = require('jquery');
var jQuery = window.jQuery = $;
require('bootstrap');

import React from 'react';
import { render } from 'react-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from './actions';

import SplitPane from 'react-split-pane';
import { Label, Tab, Tabs } from 'react-bootstrap';

import LeftPane from './components/LeftPane';
import TabbedSqlEditors from './components/TabbedSqlEditors';
import Alerts from './components/Alerts';

import { compose, createStore } from 'redux';
import { Provider } from 'react-redux';

import { initialState, sqlLabReducer } from './reducers';
import persistState from 'redux-localstorage';

require('./main.css');

let store = createStore(sqlLabReducer, initialState, compose(persistState(), window.devToolsExtension && window.devToolsExtension()));

// jquery hack to highlight the navbar menu
$('a[href="/caravel/sqllab"]').parent().addClass('active');

class App extends React.Component {
  render() {
    return (
      <div className="App SqlLab">
        <div className="container-fluid">
          <Alerts alerts={this.props.alerts} />
          <SplitPane split="vertical" minSize={200} defaultSize={300}>
            <div className="pane-cell pane-west m-t-5">
              <LeftPane />
            </div>
            <div className="pane-cell">
              <TabbedSqlEditors />
            </div>
          </SplitPane>
        </div>
      </div>
    );
  }
}

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

App = connect(mapStateToProps, mapDispatchToProps)(App);

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('app')
);

