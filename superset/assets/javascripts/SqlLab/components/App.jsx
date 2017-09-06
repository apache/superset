import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import TabbedSqlEditors from './TabbedSqlEditors';
import QueryAutoRefresh from './QueryAutoRefresh';
import QuerySearch from './QuerySearch';
import AlertsWrapper from '../../components/AlertsWrapper';
import * as Actions from '../actions';

const $ = window.$ = require('jquery');

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hash: window.location.hash,
      contentHeight: '0px',
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
  onHashChanged() {
    this.setState({ hash: window.location.hash });
  }
  getHeight() {
    const warningEl = $('#navbar-warning');
    const navTabsEl = $('.nav-tabs');
    const searchHeaderEl = $('#search-header');
    const alertEl = $('#sqllab-alerts');
    const headerNavEl = $('header .navbar');
    const navHeight = headerNavEl.outerHeight() + parseInt(headerNavEl.css('marginBottom'), 10);
    const searchHeaderHeight = searchHeaderEl.outerHeight() + parseInt(searchHeaderEl.css('marginBottom'), 10);
    const headerHeight = navTabsEl.outerHeight() ? navTabsEl.outerHeight() : searchHeaderHeight;
    const warningHeight = warningEl.length > 0 ? warningEl.outerHeight() : 0;
    const alertHeight = alertEl.length > 0 ? alertEl.outerHeight() : 0;
    return `${window.innerHeight - navHeight - headerHeight - warningHeight - alertHeight}px`;
  }
  handleResize() {
    this.setState({ contentHeight: this.getHeight() });
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
        <AlertsWrapper initMessages={this.props.initMessages} />
        <div className="container-fluid">
          {content}
        </div>
      </div>
    );
  }
}

App.propTypes = {
  alerts: PropTypes.array,
  actions: PropTypes.object,
  initMessages: PropTypes.array,
};

function mapStateToProps(state) {
  return {
    alerts: state.alerts,
    initMessages: state.flash_messages,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { App };
export default connect(mapStateToProps, mapDispatchToProps)(App);
