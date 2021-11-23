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
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import {
  LOCALSTORAGE_MAX_USAGE_KB,
  LOCALSTORAGE_WARNING_THRESHOLD,
  LOCALSTORAGE_WARNING_MESSAGE_THROTTLE_MS,
} from 'src/SqlLab/constants';
import * as Actions from 'src/SqlLab/actions/sqlLab';
import TabbedSqlEditors from '../TabbedSqlEditors';
import QueryAutoRefresh from '../QueryAutoRefresh';
import QuerySearch from '../QuerySearch';

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

    // Horrible hack to disable side swipe navigation when in SQL Lab. Even though the
    // docs say setting this style on any div will prevent it, turns out it only works
    // when set on the body element.
    document.body.style.overscrollBehaviorX = 'none';
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

    // And now we need to reset the overscroll behavior back to the default.
    document.body.style.overscrollBehaviorX = 'auto';
  }

  onHashChanged() {
    this.setState({ hash: window.location.hash });
  }

  showLocalStorageUsageWarning(currentUsage) {
    this.props.actions.addDangerToast(
      t(
        "SQL Lab uses your browser's local storage to store queries and results." +
          '\nCurrently, you are using %(currentUsage)s KB out of %(maxStorage)d KB storage space.' +
          '\nTo keep SQL Lab from crashing, please delete some query tabs.' +
          '\nYou can re-access these queries by using the Save feature before you delete the tab.' +
          '\nNote that you will need to close other SQL Lab windows before you do this.',
        {
          currentUsage: currentUsage.toFixed(2),
          maxStorage: LOCALSTORAGE_MAX_USAGE_KB,
        },
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
          <ToastContainer />
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
