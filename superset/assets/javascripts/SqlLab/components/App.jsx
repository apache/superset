const $ = window.$ = require('jquery');
import * as Actions from '../actions';
import React from 'react';

import TabbedSqlEditors from './TabbedSqlEditors';
import QueryAutoRefresh from './QueryAutoRefresh';
import QuerySearch from './QuerySearch';
import Alerts from './Alerts';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hash: window.location.hash,
      contentHeight: this.getHeight(),
    };
  }
  componentDidMount() {
    /* eslint-disable react/no-did-mount-set-state */
    this.setState({ contentHeight: this.getHeight() });
    window.addEventListener('hashchange', this.onHashChanged.bind(this));
    window.addEventListener('resize', this.handleResize.bind(this));
  }
  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHashChanged.bind(this));
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
  getHeight() {
    const navHeight = 90;
    const headerHeight = $('.nav-tabs').outerHeight() ?
      $('.nav-tabs').outerHeight() : $('#search-header').outerHeight();
    const warningHeight = $('#navbar-warning').outerHeight();
    const alertHeight = $('#sqllab-alerts').outerHeight();
    return `${window.innerHeight - navHeight - headerHeight - warningHeight - alertHeight}px`;
  }
  handleResize() {
    this.setState({ contentHeight: this.getHeight() });
  }
  onHashChanged() {
    this.setState({ hash: window.location.hash });
  }
  render() {
    let content;
    if (this.state.hash) {
      content = (
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-12">
              <QuerySearch height={this.state.contentHeight} actions={this.props.actions} />
            </div>
          </div>
        </div>
      );
    } else {
      content = (
        <div>
          <QueryAutoRefresh />
          <TabbedSqlEditors editorHeight={this.state.contentHeight} />
        </div>
      );
    }
    return (
      <div className="App SqlLab">
        <Alerts id="sqllab-alerts" alerts={this.props.alerts} actions={this.props.actions} />
        <div className="container-fluid">
          {content}
        </div>
      </div>
    );
  }
}

App.propTypes = {
  alerts: React.PropTypes.array,
  actions: React.PropTypes.object,
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

export { App };
export default connect(mapStateToProps, mapDispatchToProps)(App);
