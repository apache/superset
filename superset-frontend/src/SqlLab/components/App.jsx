/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t, supersetTheme, ThemeProvider } from '@superset-ui/core';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import throttle from 'lodash/throttle';
import TabbedSqlEditors from './TabbedSqlEditors';
import QueryAutoRefresh from './QueryAutoRefresh';
import QuerySearch from './QuerySearch';
import ToastPresenter from '../../messageToasts/containers/ToastPresenter';
import {
  LOCALSTORAGE_MAX_USAGE_KB,
  LOCALSTORAGE_WARNING_THRESHOLD,
  LOCALSTORAGE_WARNING_MESSAGE_THROTTLE_MS,
} from '../constants';
import * as Actions from '../actions/sqlLab';

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hash: window.location.hash,
    };

    this.showLocalStorageUsageWarning = throttle(
      this.showLocalStorageUsageWarning,
      LOCALSTORAGE_WARNING_MESSAGE_THROTTLE_MS,
      { trailing: false },
    );
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.onHashChanged.bind(this));
  }

  componentDidUpdate() {
    if (
      this.props.localStorageUsageInKilobytes >=
      LOCALSTORAGE_WARNING_THRESHOLD * LOCALSTORAGE_MAX_USAGE_KB
    ) {
      this.showLocalStorageUsageWarning(
        this.props.localStorageUsageInKilobytes,
      );
    }
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHashChanged.bind(this));
  }

  onHashChanged() {
    this.setState({ hash: window.location.hash });
  }

  showLocalStorageUsageWarning(currentUsage) {
    this.props.actions.addDangerToast(
      t(
        "SQL Lab uses your browser's local storage to store queries and results." +
          `\n Currently, you are using ${currentUsage.toFixed(
            2,
          )} KB out of ${LOCALSTORAGE_MAX_USAGE_KB} KB. storage space.` +
          '\n To keep SQL Lab from crashing, please delete some query tabs.' +
          '\n You can re-access these queries by using the Save feature before you delete the tab. ' +
          'Note that you will need to close other SQL Lab windows before you do this.',
      ),
    );
  }

  render() {
    let content;
    if (this.state.hash && this.state.hash === '#search') {
      if (isFeatureEnabled(FeatureFlag.ENABLE_REACT_CRUD_VIEWS)) {
        return window.location.replace('/superset/sqllab/history/');
      }
      content = (
        <QuerySearch
          actions={this.props.actions}
          displayLimit={this.props.common.conf.DISPLAY_MAX_ROW}
        />
      );
    } else {
      content = (
        <>
          <QueryAutoRefresh />
          <TabbedSqlEditors />
        </>
      );
    }
    return (
      <ThemeProvider theme={supersetTheme}>
        <div className="App SqlLab">
          {content}
          <ToastPresenter />
        </div>
      </ThemeProvider>
    );
  }
}

App.propTypes = {
  actions: PropTypes.object,
  common: PropTypes.object,
  localStorageUsageInKilobytes: PropTypes.number.isRequired,
};

function mapStateToProps(state) {
  const { common, localStorageUsageInKilobytes } = state;
  return {
    common,
    localStorageUsageInKilobytes,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(App);
