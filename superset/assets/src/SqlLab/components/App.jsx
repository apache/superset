import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import $ from 'jquery';

import TabbedSqlEditors from './TabbedSqlEditors';
import QueryAutoRefresh from './QueryAutoRefresh';
import QuerySearch from './QuerySearch';
import ToastPresenter from '../../messageToasts/containers/ToastPresenter';
import * as Actions from '../actions/sqlLab';

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
    const tabsEl = $('.nav-tabs');
    const searchHeaderEl = $('#search-header');
    const alertEl = $('#sqllab-alerts');
    const headerEl = $('header .navbar');
    const headerHeight = headerEl.outerHeight() + parseInt(headerEl.css('marginBottom'), 10);
    const searchHeaderHeight =
      searchHeaderEl.length > 0
        ? searchHeaderEl.outerHeight() + parseInt(searchHeaderEl.css('marginBottom'), 10)
        : 0;
    const tabsHeight = tabsEl.length > 0 ? tabsEl.outerHeight() : searchHeaderHeight;
    const warningHeight = warningEl.length > 0 ? warningEl.outerHeight() : 0;
    const alertHeight = alertEl.length > 0 ? alertEl.outerHeight() : 0;
    return `${window.innerHeight - headerHeight - tabsHeight - warningHeight - alertHeight}px`;
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
          <TabbedSqlEditors getHeight={this.getHeight} />
        </div>
      );
    }
    return (
      <div className="App SqlLab">
        <div className="container-fluid">{content}</div>
        <ToastPresenter />
      </div>
    );
  }
}

App.propTypes = {
  actions: PropTypes.object,
};

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export { App };
export default connect(
  null,
  mapDispatchToProps,
)(App);
